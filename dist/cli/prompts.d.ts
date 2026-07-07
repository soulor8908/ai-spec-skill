import { type StackSelection } from './options.js';
/**
 * 交互式收集技术栈选择。
 * 用户按 Ctrl+C 退出时抛出异常（调用方处理）。
 */
export declare function promptStack(initial?: Partial<StackSelection>): Promise<StackSelection>;
/**
 * 交互式确认生成。
 */
export declare function promptConfirm(projectName: string, stack: StackSelection): Promise<boolean>;
//# sourceMappingURL=prompts.d.ts.map