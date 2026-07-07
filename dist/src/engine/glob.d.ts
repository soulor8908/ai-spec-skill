/**
 * 匹配 glob 模式，返回所有匹配的文件绝对路径。
 *
 * @param rootDir 项目根目录（绝对路径）
 * @param pattern glob 模式，支持 `**` 多层通配、`*` 单层通配、`{a,b,c}` 选择。
 *                示例：`src/{router,service}/` 后跟多层通配再后跟 `.ts` 后缀。
 */
export declare function matchGlob(rootDir: string, pattern: string): string[];
/**
 * 从源码提取正则匹配位置，返回行号（1-based）+ 匹配文本。
 */
export declare function extractMatches(regex: RegExp, source: string): Array<{
    line: number;
    text: string;
}>;
/**
 * 收集规则适用文件清单（按多个 glob 模式匹配 + 去重）。
 * 抽自 engine.ts，使核心只做"调度 + 报告"，文件扫描集中在 glob.ts（建议 3）。
 *
 * @param rootDir 项目根目录
 * @param patterns glob 模式数组
 * @returns 去重后的绝对路径数组
 */
export declare function collectFiles(rootDir: string, patterns: string[]): string[];
//# sourceMappingURL=glob.d.ts.map