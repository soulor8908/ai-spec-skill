// src/index.ts —— @ai-spec/skill 主入口
//
// 导出规则引擎、规则加载器、SPI 类型、注入管线、三个契约 renderer。
// 消费方（如 AIAdmin）通过 `import { RuleEngine, ... } from '@ai-spec/skill'` 使用。

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 返回内置规则目录（包内 src/kernel/rules/ 绝对路径）。
 * 消费方可用 `loadRules(getBuiltinRulesDir())` 加载 13 项声明式规则。
 */
export function getBuiltinRulesDir(): string {
  // dist/src/index.js → dist/src/ → dist/ → package root → src/kernel/rules
  return join(__dirname, '..', '..', 'src', 'kernel', 'rules');
}

// 规则引擎
export { RuleEngine } from './engine/engine.js';
export type { EngineOptions, EngineResult } from './engine/engine.js';

// 规则加载器
export { loadRules } from './engine/loader.js';
export type { DeclarativeRule, LoadResult } from './engine/loader.js';

// 内置 plugin
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

// 注入管线
export { InjectPipeline } from './inject/index.js';
export type {
  InjectPipelineOptions,
  InjectPipelineResult,
  GateUpResult,
  RollbackResult,
} from './inject/index.js';

// 契约 renderer（三个）
export { renderContract as renderZodContract } from './adapters/contract/zod/renderer.js';
export { renderContract as renderPydanticContract } from './adapters/contract/pydantic/renderer.js';
export { renderContract as renderJsonSchemaContract } from './adapters/contract/json-schema/renderer.js';

// Spec 完整性评分器
export { scoreSpec } from './intelligence/spec-completeness.js';
