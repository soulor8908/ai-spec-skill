import type { RuleFinding, RuleCheckPlugin, ProjectProfile } from '../spi/adapter.js';
export interface EngineOptions {
    /** 规则目录（默认 'kernel/rules'） */
    rulesDir?: string;
    /** 项目根目录 */
    rootDir: string;
    /** 项目画像（detectProject 产出，决定 stacks 过滤） */
    profile: ProjectProfile;
    /** 只跑指定规则 ID（缺省跑全部） */
    ruleIds?: string[];
    /** 仅 advisory 模式（不阻断，只输出 finding） */
    advisoryMode?: boolean;
}
export interface EngineResult {
    findings: RuleFinding[];
    /** 已执行的规则 ID 清单 */
    executed_rules: string[];
    /** 已加载的规则总数 */
    loaded_rules: number;
    /** META-003 声明漂移清单 */
    meta003_violations: string[];
    /** META-004 反向缺口清单 */
    meta004_violations: string[];
    /** 退出码：0=全绿 / 1=有 error 级 finding */
    exit_code: number;
}
/**
 * 规则引擎核心。
 *
 * 用法：
 * ```ts
 * const engine = new RuleEngine({ rootDir: '/path/to/project', profile });
 * const result = await engine.run();
 * if (result.exit_code !== 0) process.exit(1);
 * ```
 */
export declare class RuleEngine {
    private plugins;
    private rules;
    private loadErrors;
    private loadWarnings;
    private options;
    private builtinRegistered;
    constructor(options: EngineOptions);
    /**
     * 加载规则后自动注册内置 plugin（builtin-regex）。
     * 问题 1 修复：核心不再直接执行 regex 检查，而是注册 BuiltinRegexPlugin 处理。
     */
    private ensureBuiltinPlugins;
    /**
     * 注册外部 plugin。允许在不修改核心代码的前提下扩展检查能力。
     * 同一 ID 重复注册抛错。
     */
    registerPlugin(plugin: RuleCheckPlugin): void;
    /**
     * 执行所有规则检查。
     */
    run(): Promise<EngineResult>;
    /**
     * 执行单条规则。
     * 问题 1 修复：核心只调度 plugin，不直接执行检查。
     *
     * 分派逻辑：
     * - manual kind：跳过机器检查（由 Reviewer 流程校验）
     * - 其他 kind：全部交给 plugin 处理
     *   - builtin-regex plugin 处理 regex/structure 类（非 plugin_required）
     *   - 外部 plugin（如 typescript）处理 plugin_required 类
     *   - 若无 plugin 注册且 plugin_required=true → 报缺失 warning
     */
    private executeRule;
    /**
     * META-003：声明漂移校验。
     * 声明式规则集里 check.plugin_required=true 的规则，对应 plugin 必须在 supported_rules 注册该 ID。
     * 注意：builtin-regex plugin 自动接管非 plugin_required 的规则，不在本检查范围。
     */
    private checkMeta003;
    /**
     * META-004：反向缺口校验。
     * plugin.supported_rules 中每个 ID 必须在声明式规则集里有对应规则定义。
     */
    private checkMeta004;
    /**
     * 查找支持某规则 ID 的 plugin。
     */
    private findPluginForRule;
}
//# sourceMappingURL=engine.d.ts.map