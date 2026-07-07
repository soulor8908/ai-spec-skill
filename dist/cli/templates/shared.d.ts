import type { GenerateOptions } from '../options.js';
import type { WriteOp } from '../../src/spi/adapter.js';
export declare const __dirname: string;
/**
 * 包名规范化：小写 + 仅允许 [a-z0-9-]。
 */
export declare function normalizePkgName(name: string): string;
/**
 * 从适配器目录加载模板文件。
 * 路径：adapters/<type>/<id>/files/<fileName>
 * 失败时抛错（适配器缺失是开发期问题，不应静默回退，建议 1）。
 *
 * 注意：本文件位于 cli/templates/，向上一级到 cli/，再向上一级到 skill/，再进入 adapters/。
 */
export declare function loadAdapterFileOrThrow(type: string, id: string, fileName: string): string;
/** 旧别名：保持向后兼容 */
export declare const loadAdapterFile: typeof loadAdapterFileOrThrow;
/**
 * 检查适配器文件是否存在（不抛错）。
 */
export declare function adapterFileExists(type: string, id: string, fileName: string): boolean;
/**
 * 渲染适配器模板：替换 {{var}} 占位符。
 * 当前实现最小化（只替换 project-name），未来可扩展为 handlebars。
 *
 * 建议 4：渲染后校验，无 {{...}} 残留（在 renderProject 末尾统一检测）。
 */
export declare function renderAdapterTemplate(template: string, opts: GenerateOptions): string;
/**
 * 递归拷贝目录为 WriteOp 清单（用于从 kernel/ 拷贝规则/角色/模板到生成项目的 .ai-spec/）。
 */
export declare function walkCopy(srcDir: string, destDir: string): WriteOp[];
//# sourceMappingURL=shared.d.ts.map