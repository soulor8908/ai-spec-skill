import type { RuleCheckPlugin, RuleCheckInput, RuleFinding } from '../spi/adapter.js';
import type { DeclarativeRule } from './loader.js';
/**
 * 内置 regex 检查 plugin。
 * 处理 check.kind='regex' 且 plugin_required=false 的规则。
 */
export declare class BuiltinRegexPlugin implements RuleCheckPlugin {
    readonly id = "builtin-regex";
    private rulesById;
    constructor(rules: DeclarativeRule[]);
    get supported_rules(): string[];
    check(input: RuleCheckInput): Promise<RuleFinding[]>;
    private runRegexCheck;
}
//# sourceMappingURL=builtin-regex-plugin.d.ts.map