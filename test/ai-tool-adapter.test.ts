// test/ai-tool-adapter.test.ts —— P0 AI 工具适配器测试
// 覆盖：注册表、生成器（6 适配器）、单文件汇聚/多文件/JSON 序列化、规则+命令双下发。

import { describe, it, expect } from 'vitest';
import {
  generateAiToolFiles,
  getAiToolAdapter,
  listAiToolAdapters,
  registerBuiltinAiToolAdapters,
  cursorAdapter,
  opencodeAdapter,
} from '../src/adapters/ai-tool/index.js';
import type { CommandContent, DeclarativeRule } from '../src/adapters/ai-tool/index.js';

const rules: DeclarativeRule[] = [
  {
    id: 'CODE-001',
    title: '禁止 any / raw type',
    category: 'coding',
    severity: 'error',
    applies_to: { file_patterns: ['src/**/*.{ts,tsx}'] },
    check: { kind: 'regex', expr: ': any\\b', negative: true },
    fix_hint: '用 unknown + 类型守卫',
    rationale_ref: 'CODE-001 (forbidden-patterns.md)',
  },
  {
    id: 'ARCH-002',
    title: 'contracts 纯净层',
    category: 'architecture',
    severity: 'warning',
    applies_to: { file_patterns: ['packages/contracts/**/*.ts'] },
    check: { kind: 'import-graph', plugin_required: true },
  },
];

const commands: CommandContent[] = [
  {
    id: 'review-prd',
    description: '审阅 PRD 完整性',
    prompt: '请按 ai-spec 规则审阅 PRD...',
    arguments: [{ name: 'path', description: 'PRD 文件路径', required: true }],
  },
  {
    id: 'gen-tech-spec',
    description: '生成技术规格',
    prompt: '依据 PRD 生成 tech-spec...',
  },
];

describe('P0 AI 工具适配器注册表', () => {
  it('内置 6 个适配器全部注册', () => {
    registerBuiltinAiToolAdapters();
    const ids = listAiToolAdapters().map((a) => a.toolId).sort();
    expect(ids).toEqual(['claude', 'cline', 'copilot', 'cursor', 'opencode', 'windsurf']);
  });

  it('getAiToolAdapter 按 toolId 取回', () => {
    expect(getAiToolAdapter('cursor')).toBe(cursorAdapter);
    expect(getAiToolAdapter('unknown')).toBeUndefined();
  });
});

describe('P0 生成器：Cursor 多文件', () => {
  it('每条规则独立 .mdc 文件，含 frontmatter', () => {
    const writes = generateAiToolFiles({
      rules,
      commands: [],
      toolIds: ['cursor'],
      outDir: '/proj',
    });
    // 2 规则 → 2 个 .mdc 文件
    const ruleFiles = writes.filter((w) => w.path.endsWith('.mdc'));
    expect(ruleFiles.length).toBe(2);
    expect(ruleFiles.some((w) => w.path === '/proj/.cursor/rules/CODE-001.mdc')).toBe(true);
    expect(ruleFiles.some((w) => w.path === '/proj/.cursor/rules/ARCH-002.mdc')).toBe(true);
    const code001 = ruleFiles.find((w) => w.path.includes('CODE-001'))!;
    expect(code001.content).toContain('---');
    expect(code001.content).toContain('alwaysApply: true'); // error 级别
    expect(code001.content).toContain('CODE-001 — 禁止 any / raw type');
  });

  it('每条命令独立 .md 文件', () => {
    const writes = generateAiToolFiles({
      rules: [],
      commands,
      toolIds: ['cursor'],
      outDir: '/proj',
    });
    const cmdFiles = writes.filter((w) => w.path.endsWith('.md'));
    expect(cmdFiles.length).toBe(2);
    expect(cmdFiles.some((w) => w.path === '/proj/.cursor/commands/review-prd.md')).toBe(true);
  });
});

describe('P0 生成器：单文件工具汇聚规则+命令', () => {
  it('Copilot 规则与命令写入同一 copilot-instructions.md', () => {
    const writes = generateAiToolFiles({
      rules,
      commands,
      toolIds: ['copilot'],
      outDir: '/proj',
    });
    expect(writes.length).toBe(1);
    expect(writes[0].path).toBe('/proj/.github/copilot-instructions.md');
    const c = writes[0].content;
    // 规则段
    expect(c).toContain('## 规则边界');
    expect(c).toContain('CODE-001 — 禁止 any / raw type');
    // 命令段
    expect(c).toContain('## 可用命令');
    expect(c).toContain('/review-prd');
  });

  it('Windsurf/Cline 同样汇聚单文件', () => {
    const w = generateAiToolFiles({
      rules,
      commands: [],
      toolIds: ['windsurf', 'cline'],
      outDir: '/proj',
    });
    expect(w.some((x) => x.path === '/proj/.windsurfrules')).toBe(true);
    expect(w.some((x) => x.path === '/proj/.clinerules')).toBe(true);
  });
});

describe('P0 生成器：Claude 规则→CLAUDE.md，命令→独立文件', () => {
  it('规则汇聚 CLAUDE.md，命令独立 .claude/commands/*.md', () => {
    const writes = generateAiToolFiles({
      rules,
      commands,
      toolIds: ['claude'],
      outDir: '/proj',
    });
    const claudeMd = writes.find((w) => w.path === '/proj/CLAUDE.md');
    expect(claudeMd).toBeDefined();
    expect(claudeMd!.content).toContain('CODE-001');
    // 命令独立文件
    const cmdFiles = writes.filter((w) => w.path.startsWith('/proj/.claude/commands/'));
    expect(cmdFiles.length).toBe(2);
  });
});

describe('P0 生成器：opencode JSON 序列化', () => {
  it('规则→AGENTS.md（markdown），命令→opencode.json（JSON）', () => {
    const writes = generateAiToolFiles({
      rules,
      commands,
      toolIds: ['opencode'],
      outDir: '/proj',
    });
    const agents = writes.find((w) => w.path === '/proj/AGENTS.md');
    expect(agents).toBeDefined();
    expect(agents!.content).toContain('CODE-001');

    const json = writes.find((w) => w.path === '/proj/opencode.json');
    expect(json).toBeDefined();
    const parsed = JSON.parse(json!.content);
    expect(parsed.commands.length).toBe(2);
    expect(parsed.commands[0].name).toBe('review-prd');
    expect(parsed.commands[0].arguments[0].name).toBe('path');
  });

  it('opencode 无命令时仅生成 AGENTS.md（无命令 = 无 opencode.json）', () => {
    const writes = generateAiToolFiles({
      rules,
      commands: [],
      toolIds: ['opencode'],
      outDir: '/proj',
    });
    // 规则仍写入 AGENTS.md
    const agents = writes.find((w) => w.path === '/proj/AGENTS.md');
    expect(agents).toBeDefined();
    expect(agents!.content).toContain('CODE-001');
    // 无命令 → 不生成 opencode.json（与"无内容=无文件"一致）
    const json = writes.find((w) => w.path === '/proj/opencode.json');
    expect(json).toBeUndefined();
  });

  it('serializeFile 直接调用返回 JSON 字符串', () => {
    const out = opencodeAdapter.serializeFile?.('opencode.json', [], commands);
    expect(out).toBeDefined();
    expect(JSON.parse(out!).commands.length).toBe(2);
  });
});

describe('P0 生成器：全工具 + 异常', () => {
  it('toolIds 空 = 全部 6 适配器', () => {
    const writes = generateAiToolFiles({
      rules,
      commands,
      toolIds: [],
      outDir: '/proj',
    });
    // 至少覆盖 6 个工具的代表文件
    expect(writes.some((w) => w.path.endsWith('.mdc'))).toBe(true); // cursor
    expect(writes.some((w) => w.path === '/proj/CLAUDE.md')).toBe(true);
    expect(writes.some((w) => w.path === '/proj/.github/copilot-instructions.md')).toBe(true);
    expect(writes.some((w) => w.path === '/proj/.windsurfrules')).toBe(true);
    expect(writes.some((w) => w.path === '/proj/.clinerules')).toBe(true);
    expect(writes.some((w) => w.path === '/proj/AGENTS.md')).toBe(true);
  });

  it('未知 toolId 抛错', () => {
    expect(() =>
      generateAiToolFiles({ rules, commands: [], toolIds: ['nope'], outDir: '/proj' }),
    ).toThrow(/未注册/);
  });

  it('WriteOp reason 含工具 ID 与计数', () => {
    const writes = generateAiToolFiles({
      rules,
      commands,
      toolIds: ['copilot'],
      outDir: '/proj',
    });
    expect(writes[0].reason).toContain('[copilot]');
    expect(writes[0].reason).toContain('2 规则');
    expect(writes[0].reason).toContain('2 命令');
  });
});
