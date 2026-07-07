import type { ProjectProfile } from '../detector/types.js';
export interface TestRunResult {
    /** 运行时间 ISO */
    run_at: string;
    /** 测试命令 */
    command: string;
    /** 退出码 */
    exit_code: number;
    /** stdout 行数 */
    stdout_lines: number;
    /** stderr 行数 */
    stderr_lines: number;
    /** 通过用例数（解析自输出，可能为 undefined） */
    passed?: number;
    /** 失败用例数 */
    failed?: number;
    /** 总用例数 */
    total?: number;
    /** 原始 stdout（截断 5KB） */
    stdout: string;
    /** 原始 stderr（截断 5KB） */
    stderr: string;
}
export interface SafetyNetReport {
    /** 项目根 */
    root_dir: string;
    /** baseline（注入前） */
    baseline: TestRunResult;
    /** after（注入后） */
    after: TestRunResult;
    /** 失败用例 diff（baseline 通过但 after 失败） */
    new_failures: string[];
    /** 失败用例归因 */
    attribution: Attribution[];
    /** markdown 报告 */
    markdown: string;
}
export interface Attribution {
    /** 失败用例标识 */
    test_id: string;
    /** 归因：注入导致 / 原有问题 / 未知 */
    cause: 'injection' | 'pre-existing' | 'unknown';
    /** 推断理由 */
    reason: string;
}
/**
 * 跑测试命令并返回结构化结果。
 */
export declare function runTests(rootDir: string, profile: ProjectProfile): TestRunResult;
/**
 * 注入前跑 baseline。
 */
export declare function captureBaseline(rootDir: string, profile: ProjectProfile): TestRunResult;
/**
 * 注入后跑测试 + 对比 baseline + 归因。
 */
export declare function compareAfter(rootDir: string, profile: ProjectProfile, baseline: TestRunResult): SafetyNetReport;
/**
 * 加载已留档的 baseline（避免重复跑）。
 */
export declare function loadBaseline(rootDir: string): TestRunResult | undefined;
//# sourceMappingURL=runner.d.ts.map