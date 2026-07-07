// src/delta/parser.ts —— Delta Spec markdown 解析器
// P1 产出：把 delta markdown 解析为 DeltaSpec 结构。
//
// delta 文件格式：
//   ---                      ← YAML front matter
//   title: <标题>
//   description: <可选描述>
//   target:
//     spec: <主 spec 路径>
//     contract: <契约 yaml 路径>
//     rules: <规则 yaml 路径>
//   ---
//
//   ## ADDED spec: <章节标题>
//   <章节正文 markdown>
//
//   ## MODIFIED contract: <schema 名>
//   ```yaml
//   <schema 定义 yaml>
//   ```
//
//   ## REMOVED rule: <规则 ID>
//
//   ## RENAMED rule: <旧 ID> -> <新 ID>
//
// 解析规则：
// - front matter 用 js-yaml 解析（兼容多行/复杂结构）
// - 操作头：/^## (ADDED|MODIFIED|REMOVED|RENAMED) (spec|contract|rule):\s*(.+)$/
// - RENAMED 的 target 含 "->" / "→"，拆分为 target + renamed_to
// - contract/rule 的 ADDED/MODIFIED 正文须含 ```yaml 代码块，提取其内容并解析

import { load as parseYaml } from 'js-yaml';
import type {
  DeltaOpKind,
  DeltaSection,
  DeltaSpec,
  DeltaTarget,
  DeltaOperation,
} from './types.js';
import type { ContractSchemaMeta } from '../spi/adapter.js';
import type { DeclarativeRule } from '../engine/loader.js';

const OP_HEADER_RE = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+(spec|contract|rule):\s*(.+?)\s*$/;

/**
 * 解析 delta markdown 为 DeltaSpec。
 * @param content delta 文件全文
 * @param sourceFile 来源路径（报错定位用）
 */
export function parseDeltaSpec(content: string, sourceFile?: string): DeltaSpec {
  const { frontMatter, body, fmError } = splitFrontMatter(content);

  const fm = (frontMatter ? parseYaml(frontMatter) : {}) as {
    title?: string;
    description?: string;
    target?: DeltaTarget;
  };

  if (fmError) {
    // front matter 解析失败仍尝试解析 body，但 title 用占位
    return {
      title: fm.title ?? '(未命名 delta)',
      description: fm.description,
      target: fm.target ?? {},
      operations: parseOperations(body),
      _source_file: sourceFile,
    };
  }

  return {
    title: fm.title ?? '(未命名 delta)',
    description: fm.description,
    target: fm.target ?? {},
    operations: parseOperations(body),
    _source_file: sourceFile,
  };
}

/** 拆分 front matter 与正文，返回 front matter 文本、正文、是否解析异常 */
function splitFrontMatter(content: string): {
  frontMatter: string | null;
  body: string;
  fmError: boolean;
} {
  if (!content.startsWith('---')) {
    return { frontMatter: null, body: content, fmError: false };
  }
  // 找第二个 --- 作为 front matter 结束
  const endMatch = content.slice(3).match(/\n---\s*\n/);
  if (!endMatch) {
    return { frontMatter: null, body: content, fmError: true };
  }
  const endIdx = 3 + endMatch.index! + endMatch[0].length;
  const frontMatter = content.slice(3, 3 + endMatch.index!);
  const body = content.slice(endIdx);
  return { frontMatter, body, fmError: false };
}

/** 解析正文中的所有操作段 */
function parseOperations(body: string): DeltaOperation[] {
  const lines = body.split('\n');
  const ops: DeltaOperation[] = [];
  let current: (DeltaOperation & { _bodyLines: string[] }) | null = null;

  const flush = (): void => {
    if (!current) return;
    const rawBody = current._bodyLines.join('\n').trim();
    if (rawBody) {
      current.content = rawBody;
      // contract/rule ADDED/MODIFIED：提取 yaml 代码块并解析
      if (
        (current.section === 'contract' || current.section === 'rule') &&
        (current.kind === 'ADDED' || current.kind === 'MODIFIED')
      ) {
        current.parsed = parseYamlBlock(rawBody, current.section);
      }
    }
    delete (current as { _bodyLines?: string[] })._bodyLines;
    ops.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(OP_HEADER_RE);
    if (m) {
      flush();
      const [, kind, section, rest] = m;
      const { target, renamed_to } = parseTarget(rest);
      current = {
        kind: kind as DeltaOpKind,
        section: section as DeltaSection,
        target,
        renamed_to,
        _bodyLines: [],
        _line: i + 1,
      };
    } else if (current) {
      current._bodyLines.push(line);
    }
    // 操作头之前的游离行忽略
  }
  flush();

  return ops;
}

/** 解析操作头剩余部分，处理 RENAMED 的 "old -> new" / "old → new" */
function parseTarget(rest: string): { target: string; renamed_to?: string } {
  const arrow = rest.match(/^(.+?)\s*(?:->|→)\s*(.+)$/);
  if (arrow) {
    return { target: arrow[1].trim(), renamed_to: arrow[2].trim() };
  }
  return { target: rest.trim() };
}

/** 从正文中提取首个 ```yaml 代码块并解析为 contract schemas 或 rule */
function parseYamlBlock(
  body: string,
  section: 'contract' | 'rule',
): ContractSchemaMeta[] | DeclarativeRule | undefined {
  const block = extractYamlBlock(body);
  if (!block) return undefined;
  let parsed: unknown;
  try {
    parsed = parseYaml(block);
  } catch {
    return undefined;
  }
  if (section === 'contract') {
    return normalizeContractParsed(parsed);
  }
  return normalizeRuleParsed(parsed);
}

/** 提取首个 ```yaml ... ``` 代码块内容；若无则返回整个 body（兼容无围栏写法） */
function extractYamlBlock(body: string): string | null {
  const fenced = body.match(/```ya?ml\s*\n([\s\S]*?)```/);
  if (fenced) return fenced[1];
  // 兼容裸 yaml（无围栏）：整段当作 yaml
  return body;
}

/** 把解析结果归一为 ContractSchemaMeta[] */
function normalizeContractParsed(parsed: unknown): ContractSchemaMeta[] {
  if (!parsed || typeof parsed !== 'object') return [];
  const root = parsed as { schemas?: unknown };
  if (Array.isArray(root.schemas)) {
    return root.schemas as ContractSchemaMeta[];
  }
  // 单个 schema 对象
  if (Array.isArray(parsed)) return parsed as ContractSchemaMeta[];
  return [parsed as ContractSchemaMeta];
}

/** 把解析结果归一为 DeclarativeRule */
function normalizeRuleParsed(parsed: unknown): DeclarativeRule | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined;
  const root = parsed as { rules?: unknown };
  if (Array.isArray(root.rules) && root.rules.length > 0) {
    return root.rules[0] as DeclarativeRule;
  }
  return parsed as DeclarativeRule;
}
