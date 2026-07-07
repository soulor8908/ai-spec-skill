// src/engine/index.ts —— 引擎子路径聚合入口（@ai-spec/skill/engine）
//
// 消费方可 `import { RuleEngine, BuiltinRegexPlugin } from '@ai-spec/skill/engine'`
// 按需加载，避免拉入 inject / adapters 等无关代码。

export { RuleEngine } from './engine.js';
export type { EngineOptions, EngineResult } from './engine.js';
export { loadRules } from './loader.js';
export type { DeclarativeRule, LoadResult } from './loader.js';
export { BuiltinRegexPlugin } from './builtin-regex-plugin.js';
export { collectFiles, extractMatches } from './glob.js';
export type { RuleCheckPlugin, RuleCheckInput, RuleFinding } from '../spi/adapter.js';
