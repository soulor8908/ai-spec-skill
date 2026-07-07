// src/delta/index.ts —— Delta Spec 模块聚合入口
// P1 产出：导出 delta 类型、解析器、应用器、校验器、归档器。
//
// 用法（增量更新主 spec）：
//   import { parseDeltaSpec, applyDelta, validateDelta } from '@ai-spec/skill/delta';
//   const delta = parseDeltaSpec(readFileSync('docs/delta/add-profile.md', 'utf8'));
//   const v = validateDelta(delta);
//   if (v.errors.length) throw new Error(v.errors.join('\n'));
//   const result = applyDelta({ projectRoot: '.', delta, apply: true });

export type {
  DeltaOpKind,
  DeltaSection,
  DeltaTarget,
  DeltaOperation,
  DeltaSpec,
  ChangeSchema,
  ApplyDeltaInput,
  ApplyDeltaResult,
  ApplySectionResult,
  ApplySpecResult,
} from './types.js';

export { parseDeltaSpec } from './parser.js';

export {
  applyDelta,
  applyDeltaToSpec,
  applyDeltaToContract,
  applyDeltaToRules,
  serializeContract,
  serializeRules,
} from './apply.js';

export { validateDelta, validateDeltaAgainst } from './validator.js';
export type { DeltaValidationResult } from './validator.js';

export { applyAndArchive, readArchiveChangelog } from './archive.js';
export type { ArchiveResult, ApplyAndArchiveOptions } from './archive.js';
