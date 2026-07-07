import type { GenerateOptions } from './options.js';
export interface GenerateResult {
    out_dir: string;
    files_written: number;
    deps_installed: boolean;
    git_inited: boolean;
    warnings: string[];
    next_steps: string[];
}
/**
 * 生成项目骨架。
 * 失败时抛异常，调用方负责清理部分生成的目录。
 */
export declare function generateProject(opts: GenerateOptions): Promise<GenerateResult>;
/**
 * 回滚：清理部分生成的目录（仅在用户明确选择"清理"时调用）。
 */
export declare function cleanupPartial(outDir: string): void;
//# sourceMappingURL=generate.d.ts.map