// test/delta-spec.test.ts —— P1 Delta Spec 测试
// 覆盖：parser（front matter + 四操作 + RENAMED 箭头）、apply（spec/contract/rule 三维度）、
//       validator（冲突检测）、archive（归档 + changelog）。

import { describe, it, expect } from 'vitest';
import {
  parseDeltaSpec,
  applyDeltaToSpec,
  applyDeltaToContract,
  applyDeltaToRules,
  validateDelta,
  validateDeltaAgainst,
  applyDelta,
  applyAndArchive,
  readArchiveChangelog,
} from '../src/delta/index.js';
import type { DeltaSpec, DeltaOperation } from '../src/delta/index.js';
import type { ContractSchemaMeta, DeclarativeRule } from '../src/index.js';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeDelta(ops: DeltaOperation[], target: DeltaSpec['target'] = {}): DeltaSpec {
  return { title: 'test-delta', target, operations: ops };
}

describe('P1 parser', () => {
  it('解析 front matter + 四类操作', () => {
    const md = `---
title: 新增用户资料
description: 给 user 增加资料字段
target:
  spec: docs/spec/user.md
  contract: contracts/user.meta.yaml
  rules: rules/user.yaml
---

## ADDED spec: 用户资料
新增段落正文。

## MODIFIED contract: userOutput
\`\`\`yaml
schemas:
  - name: userOutput
    kind: object
    fields:
      - { name: id, type: uuid }
\`\`\`

## REMOVED rule: USER-OLD-001

## RENAMED rule: USER-001 -> USER-NEW-001
`;
    const delta = parseDeltaSpec(md, 'delta.md');
    expect(delta.title).toBe('新增用户资料');
    expect(delta.description).toBe('给 user 增加资料字段');
    expect(delta.target.spec).toBe('docs/spec/user.md');
    expect(delta.operations.length).toBe(4);

    expect(delta.operations[0]).toMatchObject({ kind: 'ADDED', section: 'spec', target: '用户资料' });
    expect(delta.operations[0].content).toContain('新增段落正文');

    expect(delta.operations[1]).toMatchObject({ kind: 'MODIFIED', section: 'contract', target: 'userOutput' });
    expect((delta.operations[1].parsed as ContractSchemaMeta[]).length).toBe(1);

    expect(delta.operations[2]).toMatchObject({ kind: 'REMOVED', section: 'rule', target: 'USER-OLD-001' });

    expect(delta.operations[3]).toMatchObject({
      kind: 'RENAMED',
      section: 'rule',
      target: 'USER-001',
      renamed_to: 'USER-NEW-001',
    });
  });

  it('兼容 → 箭头', () => {
    const md = `## RENAMED contract: oldSchema → newSchema`;
    const delta = parseDeltaSpec(md);
    expect(delta.operations[0].renamed_to).toBe('newSchema');
  });

  it('无 front matter 时仍解析操作', () => {
    const delta = parseDeltaSpec('## REMOVED rule: X-001');
    expect(delta.operations.length).toBe(1);
    expect(delta.title).toBe('(未命名 delta)');
  });
});

describe('P1 apply: spec 文本维度', () => {
  const spec = `# User Spec

## 概述
旧概述内容。

## 接口
旧接口内容。
`;

  it('ADDED 追加新章节', () => {
    const r = applyDeltaToSpec(spec, makeDelta([
      { kind: 'ADDED', section: 'spec', target: '用户资料', content: '新资料内容。' },
    ]));
    expect(r.applied_count).toBe(1);
    expect(r.content).toContain('## 用户资料');
    expect(r.content).toContain('新资料内容');
  });

  it('ADDED 已存在章节应跳过', () => {
    const r = applyDeltaToSpec(spec, makeDelta([
      { kind: 'ADDED', section: 'spec', target: '概述', content: 'x' },
    ]));
    expect(r.applied_count).toBe(0);
    expect(r.skipped[0].target).toBe('概述');
  });

  it('MODIFIED 替换章节正文', () => {
    const r = applyDeltaToSpec(spec, makeDelta([
      { kind: 'MODIFIED', section: 'spec', target: '概述', content: '新概述。' },
    ]));
    expect(r.content).toContain('新概述。');
    expect(r.content).not.toContain('旧概述内容');
  });

  it('REMOVED 删除章节', () => {
    const r = applyDeltaToSpec(spec, makeDelta([
      { kind: 'REMOVED', section: 'spec', target: '接口' },
    ]));
    expect(r.content).not.toContain('旧接口内容');
    expect(r.content).not.toContain('## 接口');
  });

  it('RENAMED 重命名标题（保留层级）', () => {
    const r = applyDeltaToSpec(spec, makeDelta([
      { kind: 'RENAMED', section: 'spec', target: '概述', renamed_to: '简介' },
    ]));
    expect(r.content).toContain('## 简介');
    expect(r.content).not.toContain('## 概述');
  });
});

describe('P1 apply: 契约 schema 维度', () => {
  const schemas: ContractSchemaMeta[] = [
    { name: 'userOutput', kind: 'object', fields: [{ name: 'id', type: 'uuid' }] },
    { name: 'userRole', kind: 'enum', enum_values: ['admin', 'user'] },
  ];

  it('ADDED 新 schema', () => {
    const r = applyDeltaToContract(schemas, makeDelta([
      {
        kind: 'ADDED',
        section: 'contract',
        target: 'userInput',
        parsed: [{ name: 'userInput', kind: 'object', fields: [{ name: 'email', type: 'email' }] }],
      },
    ]));
    expect(r.applied_count).toBe(1);
    expect(r.after.length).toBe(3);
    expect(r.after.some((s) => s.name === 'userInput')).toBe(true);
  });

  it('ADDED 重名 schema 跳过', () => {
    const r = applyDeltaToContract(schemas, makeDelta([
      { kind: 'ADDED', section: 'contract', target: 'userOutput', parsed: [{ name: 'userOutput', kind: 'object' }] },
    ]));
    expect(r.applied_count).toBe(0);
  });

  it('MODIFIED 替换 schema', () => {
    const r = applyDeltaToContract(schemas, makeDelta([
      {
        kind: 'MODIFIED',
        section: 'contract',
        target: 'userRole',
        parsed: [{ name: 'userRole', kind: 'enum', enum_values: ['admin', 'user', 'guest'] }],
      },
    ]));
    expect(r.after.find((s) => s.name === 'userRole')!.enum_values).toContain('guest');
  });

  it('REMOVED 删除 schema', () => {
    const r = applyDeltaToContract(schemas, makeDelta([
      { kind: 'REMOVED', section: 'contract', target: 'userOutput' },
    ]));
    expect(r.after.length).toBe(1);
    expect(r.after.every((s) => s.name !== 'userOutput')).toBe(true);
  });

  it('RENAMED 重命名 schema', () => {
    const r = applyDeltaToContract(schemas, makeDelta([
      { kind: 'RENAMED', section: 'contract', target: 'userOutput', renamed_to: 'userView' },
    ]));
    expect(r.after.some((s) => s.name === 'userView')).toBe(true);
    expect(r.after.every((s) => s.name !== 'userOutput')).toBe(true);
  });
});

describe('P1 apply: 规则集维度', () => {
  const rules: DeclarativeRule[] = [
    { id: 'USER-001', title: '注册校验', severity: 'warning', applies_to: { file_patterns: [] }, check: { kind: 'regex' } },
  ];

  it('ADDED 新规则', () => {
    const r = applyDeltaToRules(rules, makeDelta([
      {
        kind: 'ADDED',
        section: 'rule',
        target: 'USER-002',
        parsed: { id: 'USER-002', title: '登录限流', severity: 'error', applies_to: { file_patterns: [] }, check: { kind: 'regex' } },
      },
    ]));
    expect(r.after.length).toBe(2);
  });

  it('MODIFIED 改 severity', () => {
    const r = applyDeltaToRules(rules, makeDelta([
      {
        kind: 'MODIFIED',
        section: 'rule',
        target: 'USER-001',
        parsed: { id: 'USER-001', title: '注册校验', severity: 'error', applies_to: { file_patterns: [] }, check: { kind: 'regex' } },
      },
    ]));
    expect(r.after.find((x) => x.id === 'USER-001')!.severity).toBe('error');
  });

  it('REMOVED 删除规则', () => {
    const r = applyDeltaToRules(rules, makeDelta([
      { kind: 'REMOVED', section: 'rule', target: 'USER-001' },
    ]));
    expect(r.after.length).toBe(0);
  });

  it('RENAMED 改规则 ID', () => {
    const r = applyDeltaToRules(rules, makeDelta([
      { kind: 'RENAMED', section: 'rule', target: 'USER-001', renamed_to: 'USER-NEW-001' },
    ]));
    expect(r.after.some((x) => x.id === 'USER-NEW-001')).toBe(true);
  });
});

describe('P1 validator', () => {
  it('ADDED + REMOVED 同目标报错', () => {
    const v = validateDelta(makeDelta([
      { kind: 'ADDED', section: 'rule', target: 'X', parsed: { id: 'X', title: 't', severity: 'error', applies_to: { file_patterns: [] }, check: { kind: 'regex' } } },
      { kind: 'REMOVED', section: 'rule', target: 'X' },
    ]));
    expect(v.errors.some((e) => e.includes('ADDED') && e.includes('REMOVED'))).toBe(true);
  });

  it('RENAMED 缺 renamed_to 报错', () => {
    const v = validateDelta(makeDelta([
      { kind: 'RENAMED', section: 'rule', target: 'X' },
    ]));
    expect(v.errors.some((e) => e.includes('renamed_to'))).toBe(true);
  });

  it('ADDED 目标与 RENAMED 目标冲突报错', () => {
    const v = validateDelta(makeDelta([
      { kind: 'RENAMED', section: 'rule', target: 'OLD', renamed_to: 'NEW' },
      { kind: 'ADDED', section: 'rule', target: 'NEW', parsed: { id: 'NEW', title: 't', severity: 'error', applies_to: { file_patterns: [] }, check: { kind: 'regex' } } },
    ]));
    expect(v.errors.some((e) => e.includes('改名至此') || e.includes('ADDED'))).toBe(true);
  });

  it('contract ADDED 缺 parsed 报错', () => {
    const v = validateDelta(makeDelta([
      { kind: 'ADDED', section: 'contract', target: 'x' },
    ]));
    expect(v.errors.some((e) => e.includes('yaml'))).toBe(true);
  });

  it('validateDeltaAgainst 检测现存同名冲突', () => {
    const v = validateDeltaAgainst(
      makeDelta([
        { kind: 'ADDED', section: 'contract', target: 'userOutput', parsed: [{ name: 'userOutput', kind: 'object' }] },
      ]),
      { schemas: [{ name: 'userOutput', kind: 'object' }] },
    );
    expect(v.errors.some((e) => e.includes('已存在'))).toBe(true);
  });
});

describe('P1 applyDelta + applyAndArchive（文件 IO）', () => {
  let root: string;
  function setup(): void {
    root = join(tmpdir(), `ai-spec-delta-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(root, 'docs/spec'), { recursive: true });
    mkdirSync(join(root, 'contracts'), { recursive: true });
    writeFileSync(join(root, 'docs/spec/user.md'), '# User\n\n## 概述\n旧内容。\n');
    writeFileSync(
      join(root, 'contracts/user.meta.yaml'),
      'schemas:\n  - name: userOutput\n    kind: object\n',
    );
  }
  function teardown(): void {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  }

  it('applyDelta dry-run 不落盘', () => {
    setup();
    try {
      const delta = makeDelta(
        [{ kind: 'ADDED', section: 'spec', target: '用户资料', content: '新内容。' }],
        { spec: 'docs/spec/user.md' },
      );
      const r = applyDelta({ projectRoot: root, delta, apply: false });
      expect(r.written).toBe(false);
      expect(r.written_files.length).toBe(0);
      expect(r.spec?.content).toContain('用户资料');
      // 文件未变
      expect(readFileSync(join(root, 'docs/spec/user.md'), 'utf8')).not.toContain('用户资料');
    } finally {
      teardown();
    }
  });

  it('applyDelta apply=true 写回文件', () => {
    setup();
    try {
      const delta = makeDelta(
        [{ kind: 'ADDED', section: 'spec', target: '用户资料', content: '新内容。' }],
        { spec: 'docs/spec/user.md' },
      );
      const r = applyDelta({ projectRoot: root, delta, apply: true });
      expect(r.written).toBe(true);
      expect(readFileSync(join(root, 'docs/spec/user.md'), 'utf8')).toContain('用户资料');
    } finally {
      teardown();
    }
  });

  it('applyAndArchive 归档 + changelog', () => {
    setup();
    try {
      const delta: DeltaSpec = {
        title: 'add-profile',
        target: { spec: 'docs/spec/user.md' },
        operations: [{ kind: 'ADDED', section: 'spec', target: '用户资料', content: '新内容。' }],
      };
      const r = applyAndArchive(
        { projectRoot: root, delta },
        { timestamp: new Date('2026-07-07T10:30:00Z') },
      );
      expect(r.apply_result.written).toBe(true);
      expect(existsSync(r.archived_to)).toBe(true);
      expect(r.archived_to).toContain('add-profile');
      expect(existsSync(r.changelog_path)).toBe(true);
      const log = readArchiveChangelog(root);
      expect(log.length).toBe(1);
      expect(log[0].title).toBe('add-profile');
    } finally {
      teardown();
    }
  });
});
