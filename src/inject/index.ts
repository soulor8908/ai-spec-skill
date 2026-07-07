// src/inject/index.ts —— InjectPipeline 聚合类
//
// 把 detector → analyzer → reverser → injector → safety-net 五阶段串成可编程管线。
// CLI（cli/inject-command.ts）通过 onStage 回调接入交互日志，不再重复编排逻辑（P1.5 DRY）。
//
// 用法：
//   import { InjectPipeline } from '@ai-spec/skill';
//   const pipe = new InjectPipeline();
//   const result = await pipe.run({
//     rootDir: '/path/to/project',
//     apply: true,
//     onStage: (stage, status, detail) => console.log(`${stage} ${status} ${detail ?? ''}`),
//   });
//   if (result.safety_report?.new_failures.length) { ... }
//   await pipe.rollback('/path/to/project');

import { detectProject, detectAndWriteProfile } from './detector/detector.js';
import type { ProjectProfile } from './detector/types.js';
import { analyzeArchitecture } from './arch-analyzer/analyzer.js';
import type { ArchAnalysis } from './arch-analyzer/types.js';
import { reverseApi } from './contract-reverser/reverser.js';
import type { ReverseResult } from './contract-reverser/types.js';
import {
  planInjection,
  executeInjection,
  rollbackInjection,
  gateUp,
} from './rule-injector/injector.js';
import type { InjectionConfig, InjectionPlan, SeverityLevel } from './rule-injector/types.js';
import { captureBaseline, compareAfter, loadBaseline } from './safety-net/runner.js';
import type { TestRunResult, SafetyNetReport } from './safety-net/runner.js';
import {
  ArtifactGraph,
  defaultInjectPipelineGraph,
  getInjectBuildOrder,
} from '../graph/index.js';
import type { InjectPipelineStage } from '../graph/defaults.js';

/** 注入管线阶段标识 */
export type InjectStage =
  | 'detect'
  | 'analyze'
  | 'reverse'
  | 'safety-baseline'
  | 'plan'
  | 'execute'
  | 'safety-after';

/** 阶段回调（CLI 用于接入交互日志） */
export type StageCallback = (
  stage: InjectStage,
  status: 'start' | 'done' | 'fail',
  detail?: string,
) => void;

export interface InjectPipelineOptions {
  /** 项目根目录（绝对路径） */
  rootDir: string;
  /** 是否实际执行写入（默认 false = dry-run） */
  apply?: boolean;
  /** 默认注入级别（默认 'advisory'） */
  severity?: SeverityLevel;
  /** 跳过测试安全网 */
  skipSafetyNet?: boolean;
  /** 跳过架构分析 */
  skipAnalyze?: boolean;
  /** 跳过 API 逆向 */
  skipReverse?: boolean;
  /** 阶段进度回调（P1.5：CLI 接入交互日志，不重复编排逻辑） */
  onStage?: StageCallback;
}

export interface InjectPipelineResult {
  /** 项目探测画像 */
  profile: ProjectProfile;
  /** 探测结果写入路径（.ai-spec/project-profile.json） */
  profile_written_to: string;
  /** 架构分析结果（skipAnalyze 时为 undefined） */
  architecture?: ArchAnalysis;
  /** API 逆向结果（skipReverse 时为 undefined） */
  api_contract?: ReverseResult;
  /** 注入计划（dry-run 也生成） */
  plan: InjectionPlan;
  /** 执行结果（仅 apply=true 时有值） */
  execution?: { written: number; backups: string[] };
  /** 安全网对比报告（仅 apply=true 且未跳过安全网时有值） */
  safety_report?: SafetyNetReport;
}

export interface GateUpResult {
  old_level: SeverityLevel;
  new_level: SeverityLevel;
  rule_file: string;
}

export interface RollbackResult {
  rolled_back: number;
  backup_dir: string;
}

/**
 * 注入管线聚合类。
 *
 * 串联五阶段：探测 → 架构分析 → API 逆向 → 注入计划/执行 → 安全网对比。
 * 每阶段可独立跳过，dry-run 模式只生成计划不写入。
 * onStage 回调在阶段边界触发，供 CLI 接入日志（P1.5 DRY：编排逻辑唯一）。
 */
export class InjectPipeline {
  /**
   * 运行完整注入管线。
   */
  async run(opts: InjectPipelineOptions): Promise<InjectPipelineResult> {
    const rootDir = opts.rootDir;
    const apply = opts.apply ?? false;
    const severity = opts.severity ?? 'advisory';
    const onStage = opts.onStage;

    // 1. 探测
    onStage?.('detect', 'start');
    const { profile, written_to } = detectAndWriteProfile(rootDir);
    onStage?.('detect', 'done', `${profile.language}${profile.language_version ? ' ' + profile.language_version : ''}`);

    // 2. 架构分析
    let architecture: ArchAnalysis | undefined;
    if (!opts.skipAnalyze) {
      onStage?.('analyze', 'start');
      try {
        architecture = analyzeArchitecture(rootDir, profile);
        onStage?.('analyze', 'done', `${architecture.layers.length} 层, ${architecture.violations.length} 违规`);
      } catch (e) {
        onStage?.('analyze', 'fail', (e as Error).message);
        throw e;
      }
    }

    // 3. API 逆向
    let api_contract: ReverseResult | undefined;
    if (!opts.skipReverse) {
      onStage?.('reverse', 'start');
      try {
        api_contract = reverseApi(rootDir, profile);
        onStage?.('reverse', 'done', `${api_contract.endpoints.length} 端点`);
      } catch (e) {
        onStage?.('reverse', 'fail', (e as Error).message);
        throw e;
      }
    }

    // 4. 安全网 baseline（注入前，仅 apply 模式）
    let baseline: TestRunResult | undefined;
    if (!opts.skipSafetyNet && apply) {
      onStage?.('safety-baseline', 'start');
      try {
        baseline = loadBaseline(rootDir) ?? captureBaseline(rootDir, profile);
        onStage?.('safety-baseline', 'done', `退出码 ${baseline.exit_code}, 失败 ${baseline.failed ?? 0}`);
      } catch (e) {
        onStage?.('safety-baseline', 'fail', (e as Error).message);
        // baseline 失败不阻断，继续注入（CLI 旧行为兼容）
      }
    }

    // 5. 注入计划
    onStage?.('plan', 'start');
    const config: InjectionConfig = {
      out_dir: '.ai-spec',
      default_level: severity,
      overrides: {},
      dry_run: !apply,
    };
    const plan = planInjection(rootDir, profile, config);
    onStage?.('plan', 'done', `${plan.impact.new_files} 新建 + ${plan.impact.modified_files} 修改`);

    // 6. 执行（仅 apply 模式）
    let execution: { written: number; backups: string[] } | undefined;
    let safety_report: SafetyNetReport | undefined;

    if (apply) {
      onStage?.('execute', 'start');
      execution = executeInjection(rootDir, plan);
      onStage?.('execute', 'done', `${execution.written} 文件, ${execution.backups.length} 备份`);

      // 7. 安全网 after + 对比
      if (!opts.skipSafetyNet && baseline) {
        onStage?.('safety-after', 'start');
        try {
          safety_report = compareAfter(rootDir, profile, baseline);
          onStage?.('safety-after', 'done', `新增失败 ${safety_report.new_failures.length}`);
        } catch (e) {
          onStage?.('safety-after', 'fail', (e as Error).message);
        }
      }
    }

    return {
      profile,
      profile_written_to: written_to,
      architecture,
      api_contract,
      plan,
      execution,
      safety_report,
    };
  }

  /**
   * 回滚最近一次注入。
   */
  async rollback(rootDir: string): Promise<RollbackResult> {
    return rollbackInjection(rootDir);
  }

  /**
   * 升级规则级别（advisory → warning → blocking）。
   */
  gateUp(rootDir: string, ruleId: string, level: SeverityLevel): GateUpResult {
    return gateUp(rootDir, ruleId, level);
  }

  /**
   * 返回本管线的制品依赖图（P2）。
   * 节点 = 阶段；边 = 阶段间依赖。可用于查询就绪/阻塞阶段，
   * 取代硬编码线性流程。
   */
  getArtifactGraph(): ArtifactGraph {
    return new ArtifactGraph(defaultInjectPipelineGraph());
  }

  /**
   * 返回拓扑构建顺序（依赖在前）。
   * 默认顺序：detect → analyze/reverse（可并行）→ safety-baseline → plan → execute → safety-after。
   */
  getBuildOrder(): InjectPipelineStage[] {
    return getInjectBuildOrder();
  }
}

// 类型透传（供消费者类型标注；底层函数不暴露公共 API，P0.4）
export type {
  ProjectProfile,
  ArchAnalysis,
  ReverseResult,
  InjectionConfig,
  InjectionPlan,
  SeverityLevel,
  TestRunResult,
  SafetyNetReport,
};
