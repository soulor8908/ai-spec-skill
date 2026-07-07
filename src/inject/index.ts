// src/inject/index.ts —— InjectPipeline 聚合类
//
// 把 detector → analyzer → reverser → injector → safety-net 五阶段串成可编程管线。
// CLI（cli/inject-command.ts）与本类共享底层函数，差异仅在入口（CLI 做交互日志，
// 本类做结构化返回）。
//
// 用法：
//   import { InjectPipeline } from '@ai-spec/skill';
//   const pipe = new InjectPipeline();
//   const result = await pipe.run({ rootDir: '/path/to/project', apply: true });
//   if (result.safetyReport?.new_failures.length) { ... }
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
 */
export class InjectPipeline {
  /**
   * 运行完整注入管线。
   */
  async run(opts: InjectPipelineOptions): Promise<InjectPipelineResult> {
    const rootDir = opts.rootDir;
    const apply = opts.apply ?? false;
    const severity = opts.severity ?? 'advisory';

    // 1. 探测
    const { profile, written_to } = detectAndWriteProfile(rootDir);

    // 2. 架构分析
    let architecture: ArchAnalysis | undefined;
    if (!opts.skipAnalyze) {
      architecture = analyzeArchitecture(rootDir, profile);
    }

    // 3. API 逆向
    let api_contract: ReverseResult | undefined;
    if (!opts.skipReverse) {
      api_contract = reverseApi(rootDir, profile);
    }

    // 4. 安全网 baseline（注入前，仅 apply 模式）
    let baseline: TestRunResult | undefined;
    if (!opts.skipSafetyNet && apply) {
      baseline = loadBaseline(rootDir) ?? captureBaseline(rootDir, profile);
    }

    // 5. 注入计划
    const config: InjectionConfig = {
      out_dir: '.ai-spec',
      default_level: severity,
      overrides: {},
      dry_run: !apply,
    };
    const plan = planInjection(rootDir, profile, config);

    // 6. 执行（仅 apply 模式）
    let execution: { written: number; backups: string[] } | undefined;
    let safety_report: SafetyNetReport | undefined;

    if (apply) {
      execution = executeInjection(rootDir, plan);

      // 7. 安全网 after + 对比
      if (!opts.skipSafetyNet && baseline) {
        safety_report = compareAfter(rootDir, profile, baseline);
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
}

// 透传底层函数，供高级用户直接调用
export {
  detectProject,
  detectAndWriteProfile,
  analyzeArchitecture,
  reverseApi,
  planInjection,
  executeInjection,
  rollbackInjection,
  gateUp,
  captureBaseline,
  compareAfter,
  loadBaseline,
};

// 透传类型
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
