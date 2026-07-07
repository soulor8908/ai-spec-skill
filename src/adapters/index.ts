// src/adapters/index.ts —— 适配器子路径聚合入口（@ai-spec/skill/adapters）
//
// 导出三个契约 renderer（Zod / Pydantic / JSON Schema）。
// 消费方可 `import { renderZodContract } from '@ai-spec/skill/adapters'`。

export { renderContract as renderZodContract } from './contract/zod/renderer.js';
export { renderContract as renderPydanticContract } from './contract/pydantic/renderer.js';
export { renderContract as renderJsonSchemaContract } from './contract/json-schema/renderer.js';
export type {
  RenderContractInput,
  RenderContractResult,
  ContractFieldMeta,
  ContractSchemaMeta,
} from '../spi/adapter.js';
