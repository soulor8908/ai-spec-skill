/**
 * 返回内置规则目录（包内 src/kernel/rules/ 绝对路径）。
 * 消费方可用 `loadRules(getBuiltinRulesDir())` 加载 13 项声明式规则。
 */
export declare function getBuiltinRulesDir(): string;
export { RuleEngine } from './engine/engine.js';
export type { EngineOptions, EngineResult } from './engine/engine.js';
export { loadRules } from './engine/loader.js';
export type { DeclarativeRule, LoadResult } from './engine/loader.js';
export { BuiltinRegexPlugin } from './engine/builtin-regex-plugin.js';
export type { StackId, Confidence, WriteOp, ProjectProfile as SpiProjectProfile, AdapterCapabilities, DetectProjectSpi, ContractFieldMeta, ContractSchemaMeta, RenderContractInput, RenderContractResult, RenderContractSpi, RenderArchitectureInput, RenderArchitectureSpi, RuleFinding, RuleCheckPlugin, RuleCheckInput, GenerateCiConfigInput, GenerateCiConfigSpi, RenderRolePromptsInput, RenderRolePromptsSpi, Adapter, } from './spi/adapter.js';
export { InjectPipeline } from './inject/index.js';
export type { InjectPipelineOptions, InjectPipelineResult, GateUpResult, RollbackResult, } from './inject/index.js';
export { renderContract as renderZodContract } from './adapters/contract/zod/renderer.js';
export { renderContract as renderPydanticContract } from './adapters/contract/pydantic/renderer.js';
export { renderContract as renderJsonSchemaContract } from './adapters/contract/json-schema/renderer.js';
export { scoreSpec } from './intelligence/spec-completeness.js';
//# sourceMappingURL=index.d.ts.map