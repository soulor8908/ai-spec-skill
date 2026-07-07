import { detectProject, detectAndWriteProfile } from './detector/detector.js';
import type { ProjectProfile } from './detector/types.js';
import { analyzeArchitecture } from './arch-analyzer/analyzer.js';
import type { ArchAnalysis } from './arch-analyzer/types.js';
import { reverseApi } from './contract-reverser/reverser.js';
import type { ReverseResult } from './contract-reverser/types.js';
import { planInjection, executeInjection, rollbackInjection, gateUp } from './rule-injector/injector.js';
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
    execution?: {
        written: number;
        backups: string[];
    };
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
export declare class InjectPipeline {
    /**
     * 运行完整注入管线。
     */
    run(opts: InjectPipelineOptions): Promise<InjectPipelineResult>;
    /**
     * 回滚最近一次注入。
     */
    rollback(rootDir: string): Promise<RollbackResult>;
    /**
     * 升级规则级别（advisory → warning → blocking）。
     */
    gateUp(rootDir: string, ruleId: string, level: SeverityLevel): GateUpResult;
}
export { detectProject, detectAndWriteProfile, analyzeArchitecture, reverseApi, planInjection, executeInjection, rollbackInjection, gateUp, captureBaseline, compareAfter, loadBaseline, };
export type { ProjectProfile, ArchAnalysis, ReverseResult, InjectionConfig, InjectionPlan, SeverityLevel, TestRunResult, SafetyNetReport, };
//# sourceMappingURL=index.d.ts.map