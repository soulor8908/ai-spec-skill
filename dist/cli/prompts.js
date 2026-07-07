// cli/prompts.ts —— enquirer 交互式 prompt
// P1-1 产出：交互式技术栈选择，支持 recommended 默认 + experimental 标注。
import Enquirer from 'enquirer';
import { STACK_OPTIONS } from './options.js';
/**
 * 交互式收集技术栈选择。
 * 用户按 Ctrl+C 退出时抛出异常（调用方处理）。
 */
export async function promptStack(initial) {
    const result = { ...initial };
    for (const key of Object.keys(STACK_OPTIONS)) {
        const choices = STACK_OPTIONS[key];
        const initialIdx = Math.max(0, choices.findIndex((c) => c.value === (result[key] ?? (c.recommended ? c.value : ''))));
        const promptName = `${key}Prompt`;
        const answer = (await Enquirer.prompt({
            name: promptName,
            type: 'select',
            message: selectMessage(key),
            choices: choices
                .map((c) => ({
                name: c.value,
                message: c.label,
                value: c.value,
                hint: c.recommended ? '推荐' : c.experimental ? 'experimental' : undefined,
            })),
            result(value) {
                // select 类型 result 返回选中项的 name
                return value;
            },
            initial: initialIdx,
        }));
        result[key] = answer[promptName];
    }
    return result;
}
/**
 * 交互式确认生成。
 */
export async function promptConfirm(projectName, stack) {
    const answer = (await Enquirer.prompt({
        name: 'confirm',
        type: 'confirm',
        message: `将在 ${projectName}/ 生成项目（${stack.backend} + ${stack.db} + ${stack.frontend}），继续？`,
        initial: true,
    }));
    return answer.confirm;
}
function selectMessage(key) {
    const messages = {
        backend: '选择后端技术栈',
        db: '选择数据库',
        frontend: '选择前端技术栈',
        contract: '选择契约库',
        auth: '选择认证方案',
        ci: '选择 CI 平台',
    };
    return messages[key];
}
//# sourceMappingURL=prompts.js.map