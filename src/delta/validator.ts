// src/delta/validator.ts —— Delta 跨 section 冲突检测
// P1 产出：在 apply 前校验 DeltaSpec，捕获结构性冲突，避免脏 delta 损坏主 spec。
//
// 检测项（按 section+target 维度分组）：
// - ADDED + REMOVED 同一目标（语义矛盾）
// - ADDED + MODIFIED 同一目标（先加又改，应合并为一次 ADDED）
// - MODIFIED/REMOVED/RENAMED 作用于不存在的目标（需 caller 提供现有清单时才检测，见 validateDeltaAgainst）
// - RENAMED 缺少 renamed_to
// - RENAMED 的 renamed_to 与已有 ADDED 目标冲突
// - 同一目标被多次 MODIFIED/REMOVED/RENAMED（重复操作）
// - ADDED/MODIFIED contract/rule 缺少可解析的 parsed 内容

import type { DeltaOperation, DeltaSpec } from './types.js';
import type { ContractSchemaMeta } from '../spi/adapter.js';
import type { DeclarativeRule } from '../engine/loader.js';

export interface DeltaValidationResult {
  errors: string[];
  warnings: string[];
}

/**
 * 校验 delta 内部一致性（不依赖现有主 spec 内容）。
 */
export function validateDelta(delta: DeltaSpec): DeltaValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const key = (o: DeltaOperation): string => `${o.section}:${o.target}`;

  // 按目标分组
  const byTarget = new Map<string, DeltaOperation[]>();
  for (const op of delta.operations) {
    const k = key(op);
    const arr = byTarget.get(k);
    if (arr) arr.push(op);
    else byTarget.set(k, [op]);
  }

  // RENAMED renamed_to 收集（检测跨目标冲突）
  const renamedTo = new Map<string, string>(); // section:renamed_to -> original target
  for (const op of delta.operations) {
    if (op.kind === 'RENAMED') {
      if (!op.renamed_to) {
        errors.push(`RENAMED ${op.section}:${op.target} 缺少 renamed_to（用 "old -> new" 语法）`);
        continue;
      }
      const nk = `${op.section}:${op.renamed_to}`;
      if (renamedTo.has(nk)) {
        errors.push(
          `RENAMED 冲突：${op.target} 与 ${renamedTo.get(nk)} 都改名至 ${op.section}:${op.renamed_to}`,
        );
      } else {
        renamedTo.set(nk, op.target);
      }
    }
  }

  for (const [k, ops] of byTarget) {
    const kinds = new Set(ops.map((o) => o.kind));

    // ADDED + REMOVED 同一目标
    if (kinds.has('ADDED') && kinds.has('REMOVED')) {
      errors.push(`冲突：${k} 同时 ADDED 与 REMOVED（语义矛盾）`);
    }
    // ADDED + MODIFIED 同一目标
    if (kinds.has('ADDED') && kinds.has('MODIFIED')) {
      warnings.push(`冗余：${k} 同时 ADDED 与 MODIFIED，应合并为一次 ADDED`);
    }
    // 重复的 MODIFIED/REMOVED/RENAMED
    for (const kind of ['MODIFIED', 'REMOVED', 'RENAMED'] as const) {
      const cnt = ops.filter((o) => o.kind === kind).length;
      if (cnt > 1) {
        warnings.push(`重复：${k} 被 ${kind} ${cnt} 次，按顺序生效但建议合并`);
      }
    }
    // ADDED/MODIFIED contract/rule 须有 parsed
    for (const op of ops) {
      if (
        (op.kind === 'ADDED' || op.kind === 'MODIFIED') &&
        (op.section === 'contract' || op.section === 'rule') &&
        op.parsed == null
      ) {
        errors.push(
          `${op.kind} ${op.section}:${op.target} 缺少可解析的 yaml 内容（须提供 \`\`\`yaml 代码块）`,
        );
      }
    }
  }

  // ADDED 目标与 RENAMED renamed_to 冲突
  for (const op of delta.operations) {
    if (op.kind === 'ADDED') {
      const nk = `${op.section}:${op.target}`;
      if (renamedTo.has(nk)) {
        errors.push(
          `冲突：${op.section}:${op.target} 被 ADDED，同时 ${renamedTo.get(nk)} 被改名至此`,
        );
      }
    }
  }

  return { errors, warnings };
}

/**
 * 校验 delta 针对现有主 spec 内容的可行性（检测"改/删不存在的目标"）。
 *
 * @param delta 待校验 delta
 * @param existing.schemas 现有契约 schema 列表
 * @param existing.rules 现有规则列表
 * @param existing.specHeadings 现有 spec 章节标题列表
 */
export function validateDeltaAgainst(
  delta: DeltaSpec,
  existing: {
    schemas?: ContractSchemaMeta[];
    rules?: DeclarativeRule[];
    specHeadings?: string[];
  },
): DeltaValidationResult {
  const base = validateDelta(delta);
  const errors = [...base.errors];

  const schemaNames = new Set((existing.schemas ?? []).map((s) => s.name));
  const ruleIds = new Set((existing.rules ?? []).map((r) => r.id));
  const headings = new Set((existing.specHeadings ?? []).map((h) => h.trim()));

  for (const op of delta.operations) {
    // RENAMED/REMOVED/ADDED 改名后的目标不应与现存同名冲突
    if (op.kind === 'RENAMED' && op.renamed_to) {
      const exists = existsIn(op.section, op.renamed_to, schemaNames, ruleIds, headings);
      if (exists) {
        errors.push(`${op.section}:${op.renamed_to} 已存在于主 spec，RENAMED 目标冲突`);
      }
    }
    // ADDED 不应与现存同名冲突
    if (op.kind === 'ADDED') {
      const exists = existsIn(op.section, op.target, schemaNames, ruleIds, headings);
      if (exists) {
        errors.push(`${op.section}:${op.target} 已存在于主 spec，ADDED 应改用 MODIFIED`);
      }
    }
  }

  return { errors, warnings: base.warnings };
}

function existsIn(
  section: string,
  target: string,
  schemas: Set<string>,
  rules: Set<string>,
  headings: Set<string>,
): boolean {
  switch (section) {
    case 'contract':
      return schemas.has(target);
    case 'rule':
      return rules.has(target);
    case 'spec':
      return headings.has(target.trim());
    default:
      return false;
  }
}
