// src/delta/archive.ts —— 归档变更 → 更新主 spec
// P1 产出：delta 应用成功后，把 delta 文件归档到 .ai-spec/delta-archive/，
// 并记录一条 changelog，使变更可追溯（参考 OpenSpec 的 archive 流程）。
//
// 归档目录结构：
//   .ai-spec/delta-archive/
//   ├─ 2026-07-07T10-30-00-add-user-profile.md   ← 归档的 delta 副本
//   └─ changelog.jsonl                            ← 追加一条变更记录

import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ApplyDeltaInput, DeltaSpec } from './types.js';
import { applyDelta } from './apply.js';
import type { ApplyDeltaResult } from './types.js';

export interface ArchiveResult {
  /** 归档文件绝对路径 */
  archived_to: string;
  /** changelog 文件绝对路径 */
  changelog_path: string;
  /** apply 结果（含写入文件清单） */
  apply_result: ApplyDeltaResult;
}

export interface ApplyAndArchiveOptions {
  /** 归档目录（相对项目根，默认 .ai-spec/delta-archive） */
  archiveDir?: string;
  /** 自定义时间戳（测试用），默认当前时间 */
  timestamp?: Date;
}

/**
 * 应用 delta 并归档（原子操作：apply 成功后才归档）。
 *
 * 流程：
 * 1. applyDelta（apply=true）写回主 spec/contract/rules
 * 2. 若 apply 成功，把 delta 序列化归档到 archiveDir
 * 3. 追加一条 changelog 记录
 */
export function applyAndArchive(
  input: ApplyDeltaInput,
  options: ApplyAndArchiveOptions = {},
): ArchiveResult {
  const { projectRoot, delta } = input;
  const archiveDirRel = options.archiveDir ?? '.ai-spec/delta-archive';
  const archiveDir = join(projectRoot, archiveDirRel);
  const ts = options.timestamp ?? new Date();
  const tsStr = formatTimestamp(ts);

  // 1. 应用 delta（强制 apply=true）
  const apply_result = applyDelta({ ...input, apply: true });
  if (!apply_result.written) {
    throw new Error('delta 应用未产生任何写入（检查 target 声明是否为空）');
  }

  // 2. 归档 delta 副本
  mkdirSync(archiveDir, { recursive: true });
  const slug = slugify(delta.title);
  const archiveFileName = `${tsStr}-${slug}.md`;
  const archived_to = join(archiveDir, archiveFileName);
  writeFileSync(archived_to, serializeDeltaForArchive(delta, ts));

  // 3. 追加 changelog（JSONL）
  const changelog_path = join(archiveDir, 'changelog.jsonl');
  const entry = {
    timestamp: ts.toISOString(),
    title: delta.title,
    archive_file: archiveFileName,
    applied_count: {
      spec: apply_result.spec?.applied_count ?? 0,
      contract: apply_result.contract?.applied_count ?? 0,
      rules: apply_result.rules?.applied_count ?? 0,
    },
    written_files: apply_result.written_files.map((p) => p.replace(projectRoot + '/', '')),
  };
  appendFileSync(changelog_path, JSON.stringify(entry) + '\n');

  return { archived_to, changelog_path, apply_result };
}

/**
 * 读取归档 changelog（按时间倒序）。
 */
export function readArchiveChangelog(projectRoot: string, archiveDir?: string): Array<{
  timestamp: string;
  title: string;
  archive_file: string;
  applied_count: Record<string, number>;
  written_files: string[];
}> {
  const dir = join(projectRoot, archiveDir ?? '.ai-spec/delta-archive');
  const path = join(dir, 'changelog.jsonl');
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim());
  const entries = lines.map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter((e): e is NonNullable<typeof e> => e != null);
  return entries.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

/** 序列化 delta 为归档 markdown（含归档元信息头） */
function serializeDeltaForArchive(delta: DeltaSpec, ts: Date): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push(`title: ${yamlQuote(delta.title)}`);
  if (delta.description) lines.push(`description: ${yamlQuote(delta.description)}`);
  lines.push('target:');
  if (delta.target.spec) lines.push(`  spec: ${yamlQuote(delta.target.spec)}`);
  if (delta.target.contract) lines.push(`  contract: ${yamlQuote(delta.target.contract)}`);
  if (delta.target.rules) lines.push(`  rules: ${yamlQuote(delta.target.rules)}`);
  lines.push(`archived_at: ${ts.toISOString()}`);
  if (delta._source_file) lines.push(`source_file: ${yamlQuote(delta._source_file)}`);
  lines.push('---');
  lines.push('');
  for (const op of delta.operations) {
    const head = op.renamed_to
      ? `## ${op.kind} ${op.section}: ${op.target} -> ${op.renamed_to}`
      : `## ${op.kind} ${op.section}: ${op.target}`;
    lines.push(head);
    if (op.content) {
      lines.push('');
      lines.push(op.content);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function formatTimestamp(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  );
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'delta'
  );
}

function yamlQuote(s: string): string {
  if (/[:#\[\]{}&'*!|>%@`,]/.test(s) || s.includes('\n')) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}
