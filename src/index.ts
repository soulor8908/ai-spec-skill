// src/index.ts —— @ai-spec/skill 主入口
//
// 导出规则引擎、规则加载器、SPI 类型、注入管线、三个契约 renderer、评分器。
// 消费方（如 AIAdmin）通过 `import { RuleEngine, ... } from '@ai-spec/skill'` 使用。
//
// 子路径导出（按需加载，见 package.json exports）：
//   - @ai-spec/skill/engine      规则引擎 + plugin + loader
//   - @ai-spec/skill/inject      注入管线
//   - @ai-spec/skill/adapters    三个契约 renderer
//   - @ai-spec/skill/intelligence spec 评分器

// 路径解析（P1.8/9：统一基于包根，不依赖 process.cwd()）
export { getBuiltinRulesDir, getPackageRoot, getAdaptersDir, getKernelDir } from './paths.js';

// 规则引擎
export { RuleEngine } from './engine/engine.js';
export type { EngineOptions, EngineResult } from './engine/engine.js';

// 规则加载器
export { loadRules } from './engine/loader.js';
export type { DeclarativeRule, LoadResult } from './engine/loader.js';

// 内置 plugin（无参构造，内部 auto-load；详见 engine/index.ts）
export { BuiltinRegexPlugin } from './engine/builtin-regex-plugin.js';

// SPI 类型（适配器契约）
export type {
  StackId,
  Confidence,
  WriteOp,
  ProjectProfile as SpiProjectProfile,
  AdapterCapabilities,
  DetectProjectSpi,
  ContractFieldMeta,
  ContractSchemaMeta,
  RenderContractInput,
  RenderContractResult,
  RenderContractSpi,
  RenderArchitectureInput,
  RenderArchitectureSpi,
  RuleFinding,
  RuleCheckPlugin,
  RuleCheckInput,
  GenerateCiConfigInput,
  GenerateCiConfigSpi,
  RenderRolePromptsInput,
  RenderRolePromptsSpi,
  Adapter,
} from './spi/adapter.js';

// 注入管线（仅聚合类，底层函数不暴露公共 API，P0.4）
export { InjectPipeline } from './inject/index.js';
export type {
  InjectPipelineOptions,
  InjectPipelineResult,
  InjectStage,
  StageCallback,
  GateUpResult,
  RollbackResult,
} from './inject/index.js';

// 契约 renderer（三个）—— 也可经 @ai-spec/skill/adapters 子路径导入
export { renderContract as renderZodContract } from './adapters/contract/zod/renderer.js';
export { renderContract as renderPydanticContract } from './adapters/contract/pydantic/renderer.js';
export { renderContract as renderJsonSchemaContract } from './adapters/contract/json-schema/renderer.js';

// Spec 完整性评分器 —— 也可经 @ai-spec/skill/intelligence 子路径导入
export { scoreSpec } from './intelligence/spec-completeness.js';
