// src/delta/apply.ts —— 将 delta 合并回主 spec（参考 OpenSpec specs-apply.ts）
// P1 产出：把 DeltaSpec 的四类操作（ADDED/MODIFIED/REMOVED/RENAMED）应用到三个维度：
//   1. spec 文本：按章节标题增/改/删/改名（markdown heading 定位）
//   2. 契约 schema：按 schema 名增/改/删/改名（user.meta.yaml 的 schemas 数组）
//   3. 规则集：按规则 ID 增/改/删/改名（rules yaml 的 rules 数组）
//
// 与 OpenSpec 的差异：OpenSpec 的 delta 只作用于 spec 文本；
// 本模块还须作用于契约 schema 和规则集（修改 severity / 新增字段等）。

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { load as parseYaml, dump as dumpYaml } from 'js-yaml';
import type {
  ApplyDeltaInput,
  ApplyDeltaResult,
  ApplySectionResult,
  ApplySpecResult,
  DeltaOperation,
  DeltaSpec,
} from './types.js';
import type { ContractSchemaMeta } from '../spi/adapter.js';
import type { DeclarativeRule } from '../engine/loader.js';

/**
 * 应用 delta 到主 spec 文本（markdown）。
 * 纯函数：不触碰文件系统，返回变更后的 markdown。
 */
export function applyDeltaToSpec(specMarkdown: string, delta: DeltaSpec): ApplySpecResult {
  const ops = delta.operations.filter((o) => o.section === 'spec');
  let lines = specMarkdown.split('\n');
  let applied = 0;
  const skipped: ApplySpecResult['skipped'] = [];

  for (const op of ops) {
    const result = applySpecOp(lines, op);
    if (result.applied) {
      lines = result.lines;
      applied++;
    } else {
      skipped.push({ target: op.target, reason: result.reason! });
    }
  }

  return {
    content: lines.join('\n'),
    applied_count: applied,
    skipped,
  };
}

interface SpecOpResult {
  applied: boolean;
  lines: string[];
  reason?: string;
}

function applySpecOp(lines: string[], op: DeltaOperation): SpecOpResult {
  switch (op.kind) {
    case 'ADDED':
      return specAdd(lines, op);
    case 'MODIFIED':
      return specModify(lines, op);
    case 'REMOVED':
      return specRemove(lines, op);
    case 'RENAMED':
      return specRename(lines, op);
  }
}

function specAdd(lines: string[], op: DeltaOperation): SpecOpResult {
  const range = findSectionRange(lines, op.target);
  if (range) {
    return { applied: false, lines, reason: `章节 "${op.target}" 已存在，ADDED 应仅用于新增` };
  }
  const body = (op.content ?? '').trim();
  const newLines = [...lines];
  if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== '') {
    newLines.push('');
  }
  newLines.push(`## ${op.target}`);
  if (body) newLines.push(body);
  newLines.push('');
  return { applied: true, lines: newLines };
}

function specModify(lines: string[], op: DeltaOperation): SpecOpResult {
  const range = findSectionRange(lines, op.target);
  if (!range) {
    return { applied: false, lines, reason: `章节 "${op.target}" 不存在，无法 MODIFIED` };
  }
  const body = (op.content ?? '').trim();
  const heading = lines[range.start];
  const newLines = [
    ...lines.slice(0, range.start),
    heading,
    ...(body ? [body] : []),
    ...lines.slice(range.end),
  ];
  return { applied: true, lines: newLines };
}

function specRemove(lines: string[], op: DeltaOperation): SpecOpResult {
  const range = findSectionRange(lines, op.target);
  if (!range) {
    return { applied: false, lines, reason: `章节 "${op.target}" 不存在，无法 REMOVED` };
  }
  const newLines = [...lines.slice(0, range.start), ...lines.slice(range.end)];
  return { applied: true, lines: newLines };
}

function specRename(lines: string[], op: DeltaOperation): SpecOpResult {
  if (!op.renamed_to) {
    return { applied: false, lines, reason: 'RENAMED 缺少 renamed_to（用 "old -> new" 语法）' };
  }
  const range = findSectionRange(lines, op.target);
  if (!range) {
    return { applied: false, lines, reason: `章节 "${op.target}" 不存在，无法 RENAMED` };
  }
  const heading = lines[range.start];
  const levelMatch = heading.match(/^(#{1,6})\s+/);
  const prefix = levelMatch ? levelMatch[1] : '##';
  const newLines = [
    ...lines.slice(0, range.start),
    `${prefix} ${op.renamed_to}`,
    ...lines.slice(range.start + 1),
  ];
  return { applied: true, lines: newLines };
}

/**
 * 定位章节范围：返回 [startIdx, endIdx)。
 * startIdx = 匹配标题行；endIdx = 下一个同级或更高级标题行（或文件末尾）。
 * 按标题文本匹配（忽略 # 级别）。
 */
function findSectionRange(lines: string[], headingText: string): { start: number; end: number } | null {
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) {
      if (start === -1) {
        if (m[2].trim() === headingText.trim()) {
          start = i;
          level = m[1].length;
        }
      } else if (m[1].length <= level) {
        // 遇到同级或更高级标题 → 当前章节结束
        return { start, end: i };
      }
    }
  }
  if (start === -1) return null;
  return { start, end: lines.length };
}

// ============================================================================
// 契约 schema 维度
// ============================================================================

/**
 * 应用 delta 到契约 schema 数组。
 * 纯函数：返回变更后的 schemas 列表 + 结果。
 */
export function applyDeltaToContract(
  schemas: ContractSchemaMeta[],
  delta: DeltaSpec,
): ApplySectionResult<ContractSchemaMeta> {
  const ops = delta.operations.filter((o) => o.section === 'contract');
  const before = [...schemas];
  let after = [...schemas];
  let applied = 0;
  const skipped: ApplySectionResult<ContractSchemaMeta>['skipped'] = [];

  for (const op of ops) {
    const result = applyContractOp(after, op);
    if (result.applied) {
      after = result.schemas;
      applied++;
    } else {
      skipped.push({ target: op.target, reason: result.reason! });
    }
  }

  return {
    content: serializeContract(after),
    before,
    after,
    applied_count: applied,
    skipped,
  };
}

interface ContractOpResult {
  applied: boolean;
  schemas: ContractSchemaMeta[];
  reason?: string;
}

function applyContractOp(schemas: ContractSchemaMeta[], op: DeltaOperation): ContractOpResult {
  switch (op.kind) {
    case 'ADDED': {
      const newSchemas = (op.parsed as ContractSchemaMeta[] | undefined) ?? [];
      if (newSchemas.length === 0) {
        return { applied: false, schemas, reason: 'ADDED contract 缺少可解析的 schema 定义' };
      }
      const existNames = new Set(schemas.map((s) => s.name));
      const conflicts = newSchemas.filter((s) => existNames.has(s.name));
      if (conflicts.length > 0) {
        return { applied: false, schemas, reason: `schema "${conflicts[0].name}" 已存在` };
      }
      return { applied: true, schemas: [...schemas, ...newSchemas] };
    }
    case 'MODIFIED': {
      const newSchemas = (op.parsed as ContractSchemaMeta[] | undefined) ?? [];
      const replacement = newSchemas.find((s) => s.name === op.target) ?? newSchemas[0];
      if (!replacement) {
        return { applied: false, schemas, reason: 'MODIFIED contract 缺少可解析的 schema 定义' };
      }
      const idx = schemas.findIndex((s) => s.name === op.target);
      if (idx === -1) {
        return { applied: false, schemas, reason: `schema "${op.target}" 不存在` };
      }
      const next = [...schemas];
      next[idx] = { ...replacement, name: op.target };
      return { applied: true, schemas: next };
    }
    case 'REMOVED': {
      const idx = schemas.findIndex((s) => s.name === op.target);
      if (idx === -1) {
        return { applied: false, schemas, reason: `schema "${op.target}" 不存在` };
      }
      return { applied: true, schemas: schemas.filter((s) => s.name !== op.target) };
    }
    case 'RENAMED': {
      if (!op.renamed_to) {
        return { applied: false, schemas, reason: 'RENAMED 缺少 renamed_to' };
      }
      const idx = schemas.findIndex((s) => s.name === op.target);
      if (idx === -1) {
        return { applied: false, schemas, reason: `schema "${op.target}" 不存在` };
      }
      if (schemas.some((s) => s.name === op.renamed_to)) {
        return { applied: false, schemas, reason: `schema "${op.renamed_to}" 已存在` };
      }
      const next = [...schemas];
      next[idx] = { ...next[idx], name: op.renamed_to! };
      return { applied: true, schemas: next };
    }
  }
}

// ============================================================================
// 规则集维度
// ============================================================================

/**
 * 应用 delta 到规则集数组。
 * 纯函数：返回变更后的 rules 列表 + 结果。
 */
export function applyDeltaToRules(
  rules: DeclarativeRule[],
  delta: DeltaSpec,
): ApplySectionResult<DeclarativeRule> {
  const ops = delta.operations.filter((o) => o.section === 'rule');
  const before = [...rules];
  let after = [...rules];
  let applied = 0;
  const skipped: ApplySectionResult<DeclarativeRule>['skipped'] = [];

  for (const op of ops) {
    const result = applyRuleOp(after, op);
    if (result.applied) {
      after = result.rules;
      applied++;
    } else {
      skipped.push({ target: op.target, reason: result.reason! });
    }
  }

  return {
    content: serializeRules(after),
    before,
    after,
    applied_count: applied,
    skipped,
  };
}

interface RuleOpResult {
  applied: boolean;
  rules: DeclarativeRule[];
  reason?: string;
}

function applyRuleOp(rules: DeclarativeRule[], op: DeltaOperation): RuleOpResult {
  switch (op.kind) {
    case 'ADDED': {
      const newRule = op.parsed as DeclarativeRule | undefined;
      if (!newRule) {
        return { applied: false, rules, reason: 'ADDED rule 缺少可解析的规则定义' };
      }
      if (rules.some((r) => r.id === op.target)) {
        return { applied: false, rules, reason: `规则 "${op.target}" 已存在` };
      }
      const rule: DeclarativeRule = { ...newRule, id: op.target };
      return { applied: true, rules: [...rules, rule] };
    }
    case 'MODIFIED': {
      const newRule = op.parsed as DeclarativeRule | undefined;
      if (!newRule) {
        return { applied: false, rules, reason: 'MODIFIED rule 缺少可解析的规则定义' };
      }
      const idx = rules.findIndex((r) => r.id === op.target);
      if (idx === -1) {
        return { applied: false, rules, reason: `规则 "${op.target}" 不存在` };
      }
      const next = [...rules];
      next[idx] = { ...newRule, id: op.target };
      return { applied: true, rules: next };
    }
    case 'REMOVED': {
      const idx = rules.findIndex((r) => r.id === op.target);
      if (idx === -1) {
        return { applied: false, rules, reason: `规则 "${op.target}" 不存在` };
      }
      return { applied: true, rules: rules.filter((r) => r.id !== op.target) };
    }
    case 'RENAMED': {
      if (!op.renamed_to) {
        return { applied: false, rules, reason: 'RENAMED 缺少 renamed_to' };
      }
      const idx = rules.findIndex((r) => r.id === op.target);
      if (idx === -1) {
        return { applied: false, rules, reason: `规则 "${op.target}" 不存在` };
      }
      if (rules.some((r) => r.id === op.renamed_to)) {
        return { applied: false, rules, reason: `规则 "${op.renamed_to}" 已存在` };
      }
      const next = [...rules];
      next[idx] = { ...next[idx], id: op.renamed_to! };
      return { applied: true, rules: next };
    }
  }
}

// ============================================================================
// 序列化
// ============================================================================

export function serializeContract(schemas: ContractSchemaMeta[]): string {
  return dumpYaml({ schemas }, { lineWidth: 120, noRefs: true }) + '\n';
}

export function serializeRules(rules: DeclarativeRule[]): string {
  // 规则加载器期望 { rules: [...] } 结构
  return dumpYaml({ rules }, { lineWidth: 120, noRefs: true }) + '\n';
}

// ============================================================================
// 顶层编排：读文件 → 应用 → 写回
// ============================================================================

/**
 * 应用 delta 到项目（读 target 声明的文件，应用变更，可选写回）。
 *
 * dry-run（apply=false）：只返回结果不落盘，供预览/CI 校验。
 * apply=true：写回 target 声明的文件（覆盖）。
 */
export function applyDelta(input: ApplyDeltaInput): ApplyDeltaResult {
  const { projectRoot, delta, apply = false } = input;
  const result: ApplyDeltaResult = { written: false, written_files: [] };

  // spec 维度
  if (delta.target.spec) {
    const specPath = join(projectRoot, delta.target.spec);
    const md = existsSync(specPath) ? readFileSync(specPath, 'utf8') : '';
    result.spec = applyDeltaToSpec(md, delta);
    if (apply) {
      writeFileSync(specPath, result.spec.content);
      result.written_files.push(specPath);
    }
  }

  // contract 维度
  if (delta.target.contract) {
    const cPath = join(projectRoot, delta.target.contract);
    const existing = existsSync(cPath) ? loadContractFile(cPath) : [];
    result.contract = applyDeltaToContract(existing, delta);
    if (apply) {
      ensureDir(cPath);
      writeFileSync(cPath, result.contract.content);
      result.written_files.push(cPath);
    }
  }

  // rules 维度
  if (delta.target.rules) {
    const rPath = join(projectRoot, delta.target.rules);
    const existing = existsSync(rPath) ? loadRulesFile(rPath) : [];
    result.rules = applyDeltaToRules(existing, delta);
    if (apply) {
      ensureDir(rPath);
      writeFileSync(rPath, result.rules.content);
      result.written_files.push(rPath);
    }
  }

  result.written = apply && result.written_files.length > 0;
  return result;
}

function loadContractFile(path: string): ContractSchemaMeta[] {
  try {
    const parsed = parseYaml(readFileSync(path, 'utf8')) as { schemas?: ContractSchemaMeta[] };
    return parsed.schemas ?? [];
  } catch {
    return [];
  }
}

function loadRulesFile(path: string): DeclarativeRule[] {
  try {
    const parsed = parseYaml(readFileSync(path, 'utf8')) as { rules?: DeclarativeRule[] };
    return parsed.rules ?? [];
  } catch {
    return [];
  }
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
