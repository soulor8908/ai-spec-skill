import type { LoadedSkill, SkillManifest } from './types.js';
import type { LocalRegistry } from '../registry/registry.js';
/**
 * 合并后的规则（命名空间隔离后）。
 */
export interface ComposedRule {
    /** 全局键：@<ns>/<skill-name>/<RULE-ID>，如 '@core/user-mgmt/USER-001' */
    namespaced_id: string;
    /** 原始规则 ID（同 skill 内唯一） */
    rule_id: string;
    /** 来源 skill name */
    source_skill: string;
    /** 规则标题 */
    title: string;
    /** 严重级别 */
    severity: string;
    /** 规则原始内容（YAML 解析后） */
    raw: Record<string, unknown>;
    /** 覆盖策略：'original'（原样）/ 'replaced'（被替换）/ 'extended'（被扩展）/ 'disabled'（被禁用） */
    override_strategy: 'original' | 'replaced' | 'extended' | 'disabled';
    /** 被哪个 skill 覆盖（如有） */
    overridden_by?: string;
}
export interface ComposedTemplate {
    /** 模板文件名 */
    filename: string;
    /** 来源 skill name */
    source_skill: string;
    /** 模板内容 */
    content: string;
    /** 覆盖策略：'original' / 'replaced' / 'patched' */
    override_strategy: 'original' | 'replaced' | 'patched';
    overridden_by?: string;
}
export interface ComposedContract {
    /** schema name（同 skill 内唯一） */
    name: string;
    /** 全局键：@<ns>/<skill-name>/<name> */
    namespaced_name: string;
    source_skill: string;
    raw: Record<string, unknown>;
}
export interface CompositionResult {
    /** 请求组合的 skill 名清单 */
    requested: string[];
    /** 实际加载的 skill（已通过依赖解析） */
    resolved: LoadedSkill[];
    /** 合并后的规则（已应用 overrides + 命名空间） */
    rules: ComposedRule[];
    /** 合并后的模板（已应用覆盖优先级） */
    templates: ComposedTemplate[];
    /** 合并后的契约元模型 */
    contracts: ComposedContract[];
    /** 错误清单（非空 = 阻断） */
    errors: string[];
    /** 警告清单（不阻断） */
    warnings: string[];
}
export declare class SkillComposer {
    private readonly registry;
    constructor(registry: LocalRegistry);
    /**
     * 组合多个 skill，返回合并后的规则 / 模板 / 契约。
     * @param skillNames 须组合的 skill 名清单（须已安装）
     */
    compose(skillNames: string[]): CompositionResult;
    private mergeRules;
    private mergeTemplates;
    private mergeContracts;
}
export type { LoadedSkill, SkillManifest };
//# sourceMappingURL=composer.d.ts.map