// test/store.test.ts —— Store 跨仓库协作测试
//
// 覆盖：
// - LocalStoreManager 创建/注册/查询 store
// - snapshot 读取规则与契约
// - syncRules：pushed / skipped / conflicts 三种情况
// - syncContracts：pushed / skipped / conflicts 三种情况
// - 目标 store 不存在 → errors
// - 序列化稳定性（规则/契约往返）

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalStoreManager } from '../src/store/local-store.js';
import type { StoreConfig } from '../src/store/types.js';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load as parseYaml } from 'js-yaml';

describe('Store 管理器', () => {
  it('createLocalStore 应注册并返回 store', () => {
    const mgr = new LocalStoreManager();
    const store = mgr.createLocalStore({ id: 'a', rootDir: '/tmp/a' });
    expect(store.id).toBe('a');
    expect(store.rootDir).toBe('/tmp/a');
    expect(mgr.get('a')).toBe(store);
    expect(mgr.list()).toHaveLength(1);
  });

  it('register 应注册外部 store 实例', () => {
    const mgr = new LocalStoreManager();
    const inner = mgr.createLocalStore({ id: 'a', rootDir: '/tmp/a' });
    const mgr2 = new LocalStoreManager();
    mgr2.register(inner);
    expect(mgr2.get('a')).toBe(inner);
  });

  it('get 未注册 id 返回 undefined', () => {
    const mgr = new LocalStoreManager();
    expect(mgr.get('nonexistent')).toBeUndefined();
  });
});

describe('Store snapshot', () => {
  let tmpDir: string;

  function setup(): void {
    tmpDir = mkdtempSync(join(tmpdir(), 'ai-spec-store-snap-'));
  }

  function teardown(): void {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  }

  beforeEach(setup);
  afterEach(teardown);

  it('空 store 应返回空规则与契约', () => {
    const mgr = new LocalStoreManager();
    const store = mgr.createLocalStore({ id: 'empty', rootDir: tmpDir });
    const snap = store.snapshot();
    expect(snap.rules).toEqual([]);
    expect(snap.contracts).toEqual([]);
    expect(snap.storeId).toBe('empty');
  });

  it('应读取已存在的规则文件', () => {
    const rulesDir = join(tmpDir, '.ai-spec', 'store', 'rules');
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(
      join(rulesDir, 'SEC-001.yaml'),
      `rules:
  - id: 'SEC-001'
    title: '禁止 eval'
    category: 'security'
    severity: 'error'
    applies_to:
      file_patterns: ['**/*.ts']
      stacks: ['typescript']
    check:
      kind: 'regex'
      expr: 'eval\\\\('
    fix_hint: '移除 eval 调用'
    rationale_ref: 'security-001'
`,
    );

    const mgr = new LocalStoreManager();
    const store = mgr.createLocalStore({ id: 'rules-store', rootDir: tmpDir });
    const snap = store.snapshot();
    expect(snap.rules).toHaveLength(1);
    expect(snap.rules[0].id).toBe('SEC-001');
    expect(snap.rules[0].title).toBe('禁止 eval');
    expect(snap.rules[0].severity).toBe('error');
  });

  it('应读取已存在的契约文件（{ schemas: [...] } 格式）', () => {
    const contractsDir = join(tmpDir, '.ai-spec', 'store', 'contracts');
    mkdirSync(contractsDir, { recursive: true });
    writeFileSync(
      join(contractsDir, 'user.meta.yaml'),
      `schemas:
  - name: 'userOutput'
    kind: 'object'
    is_output: true
    fields:
      - { name: 'id', type: 'uuid' }
      - { name: 'email', type: 'email' }
`,
    );

    const mgr = new LocalStoreManager();
    const store = mgr.createLocalStore({ id: 'contracts-store', rootDir: tmpDir });
    const snap = store.snapshot();
    expect(snap.contracts).toHaveLength(1);
    expect(snap.contracts[0].name).toBe('userOutput');
    expect(snap.contracts[0].kind).toBe('object');
    expect(snap.contracts[0].fields).toHaveLength(2);
  });
});

describe('Store syncRules', () => {
  let sourceDir: string;
  let targetDir: string;

  function setup(): void {
    sourceDir = mkdtempSync(join(tmpdir(), 'ai-spec-store-src-'));
    targetDir = mkdtempSync(join(tmpdir(), 'ai-spec-store-tgt-'));
    // source 写入两条规则
    const srcRulesDir = join(sourceDir, '.ai-spec', 'store', 'rules');
    mkdirSync(srcRulesDir, { recursive: true });
    writeFileSync(
      join(srcRulesDir, 'CODE-001.yaml'),
      `rules:
  - id: 'CODE-001'
    title: '命名规范'
    category: 'coding'
    severity: 'warning'
    applies_to:
      file_patterns: ['**/*.ts']
    check:
      kind: 'regex'
    fix_hint: '使用 camelCase'
`,
    );
    writeFileSync(
      join(srcRulesDir, 'ARCH-001.yaml'),
      `rules:
  - id: 'ARCH-001'
    title: '分层约束'
    category: 'architecture'
    severity: 'error'
    applies_to:
      file_patterns: ['**/*.ts']
    check:
      kind: 'import-graph'
    fix_hint: '禁止跨层 import'
`,
    );
  }

  function teardown(): void {
    if (sourceDir) rmSync(sourceDir, { recursive: true, force: true });
    if (targetDir) rmSync(targetDir, { recursive: true, force: true });
  }

  beforeEach(setup);
  afterEach(teardown);

  it('首次同步 → 全部 pushed', async () => {
    const mgr = new LocalStoreManager();
    const source = mgr.createLocalStore({ id: 'src', rootDir: sourceDir });
    mgr.createLocalStore({ id: 'tgt', rootDir: targetDir });

    const result = await source.syncRules('tgt');
    expect(result.kind).toBe('rules');
    expect(result.source_store).toBe('src');
    expect(result.target_store).toBe('tgt');
    expect(result.pushed.sort()).toEqual(['ARCH-001', 'CODE-001']);
    expect(result.skipped).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(result.errors).toEqual([]);

    // 目标目录应有两条规则文件
    const tgtRulesDir = join(targetDir, '.ai-spec', 'store', 'rules');
    expect(existsSync(join(tgtRulesDir, 'CODE-001.yaml'))).toBe(true);
    expect(existsSync(join(tgtRulesDir, 'ARCH-001.yaml'))).toBe(true);
  });

  it('二次同步（内容相同）→ 全部 skipped', async () => {
    const mgr = new LocalStoreManager();
    const source = mgr.createLocalStore({ id: 'src', rootDir: sourceDir });
    mgr.createLocalStore({ id: 'tgt', rootDir: targetDir });

    await source.syncRules('tgt');
    const result2 = await source.syncRules('tgt');
    expect(result2.pushed).toEqual([]);
    expect(result2.skipped.sort()).toEqual(['ARCH-001', 'CODE-001']);
    expect(result2.conflicts).toEqual([]);
  });

  it('目标已存在不同版本 → conflicts', async () => {
    // 预先在 target 写入 CODE-001 但内容不同
    const tgtRulesDir = join(targetDir, '.ai-spec', 'store', 'rules');
    mkdirSync(tgtRulesDir, { recursive: true });
    writeFileSync(
      join(tgtRulesDir, 'CODE-001.yaml'),
      `rules:
  - id: 'CODE-001'
    title: '冲突的命名规范'
    category: 'coding'
    severity: 'error'
    applies_to:
      file_patterns: ['**/*.ts']
    check:
      kind: 'regex'
`,
    );

    const mgr = new LocalStoreManager();
    const source = mgr.createLocalStore({ id: 'src', rootDir: sourceDir });
    mgr.createLocalStore({ id: 'tgt', rootDir: targetDir });

    const result = await source.syncRules('tgt');
    expect(result.pushed).toEqual(['ARCH-001']);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].id).toBe('CODE-001');
    expect(result.conflicts[0].reason).toContain('CODE-001');

    // 目标文件不应被覆盖（仍是冲突版本）
    const tgtContent = parseYaml(readFileSync(join(tgtRulesDir, 'CODE-001.yaml'), 'utf8')) as {
      rules: Array<{ title: string }>;
    };
    expect(tgtContent.rules[0].title).toBe('冲突的命名规范');
  });

  it('目标 store 未注册 → errors', async () => {
    const mgr = new LocalStoreManager();
    const source = mgr.createLocalStore({ id: 'src', rootDir: sourceDir });

    const result = await source.syncRules('nonexistent');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('未注册');
    expect(result.pushed).toEqual([]);
  });
});

describe('Store syncContracts', () => {
  let sourceDir: string;
  let targetDir: string;

  function setup(): void {
    sourceDir = mkdtempSync(join(tmpdir(), 'ai-spec-store-csrc-'));
    targetDir = mkdtempSync(join(tmpdir(), 'ai-spec-store-ctgt-'));
    const srcContractsDir = join(sourceDir, '.ai-spec', 'store', 'contracts');
    mkdirSync(srcContractsDir, { recursive: true });
    writeFileSync(
      join(srcContractsDir, 'user.meta.yaml'),
      `schemas:
  - name: 'userOutput'
    kind: 'object'
    is_output: true
    fields:
      - { name: 'id', type: 'uuid' }
`,
    );
    writeFileSync(
      join(srcContractsDir, 'audit.meta.yaml'),
      `schemas:
  - name: 'auditLog'
    kind: 'object'
    fields:
      - { name: 'action', type: 'string' }
`,
    );
  }

  function teardown(): void {
    if (sourceDir) rmSync(sourceDir, { recursive: true, force: true });
    if (targetDir) rmSync(targetDir, { recursive: true, force: true });
  }

  beforeEach(setup);
  afterEach(teardown);

  it('首次同步 → 全部 pushed', async () => {
    const mgr = new LocalStoreManager();
    const source = mgr.createLocalStore({ id: 'src', rootDir: sourceDir });
    mgr.createLocalStore({ id: 'tgt', rootDir: targetDir });

    const result = await source.syncContracts('tgt');
    expect(result.kind).toBe('contracts');
    expect(result.pushed.sort()).toEqual(['auditLog', 'userOutput']);
    expect(result.conflicts).toEqual([]);

    const tgtContractsDir = join(targetDir, '.ai-spec', 'store', 'contracts');
    expect(existsSync(join(tgtContractsDir, 'userOutput.meta.yaml'))).toBe(true);
    expect(existsSync(join(tgtContractsDir, 'auditLog.meta.yaml'))).toBe(true);
  });

  it('二次同步（内容相同）→ 全部 skipped', async () => {
    const mgr = new LocalStoreManager();
    const source = mgr.createLocalStore({ id: 'src', rootDir: sourceDir });
    mgr.createLocalStore({ id: 'tgt', rootDir: targetDir });

    await source.syncContracts('tgt');
    const result2 = await source.syncContracts('tgt');
    expect(result2.pushed).toEqual([]);
    expect(result2.skipped.sort()).toEqual(['auditLog', 'userOutput']);
  });

  it('目标已存在不同版本契约 → conflicts', async () => {
    const tgtContractsDir = join(targetDir, '.ai-spec', 'store', 'contracts');
    mkdirSync(tgtContractsDir, { recursive: true });
    writeFileSync(
      join(tgtContractsDir, 'userOutput.meta.yaml'),
      `schemas:
  - name: 'userOutput'
    kind: 'object'
    description: '冲突版本'
    fields:
      - { name: 'different_field', type: 'string' }
`,
    );

    const mgr = new LocalStoreManager();
    const source = mgr.createLocalStore({ id: 'src', rootDir: sourceDir });
    mgr.createLocalStore({ id: 'tgt', rootDir: targetDir });

    const result = await source.syncContracts('tgt');
    expect(result.pushed).toEqual(['auditLog']);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].id).toBe('userOutput');
  });

  it('目标 store 未注册 → errors', async () => {
    const mgr = new LocalStoreManager();
    const source = mgr.createLocalStore({ id: 'src', rootDir: sourceDir });

    const result = await source.syncContracts('nonexistent');
    expect(result.errors).toHaveLength(1);
    expect(result.pushed).toEqual([]);
  });
});

describe('Store 配置：remote 字段', () => {
  it('remote URL 可选', () => {
    const mgr = new LocalStoreManager();
    const store = mgr.createLocalStore({
      id: 'remote-store',
      rootDir: '/tmp/x',
      remote: 'https://github.com/org/repo.git',
    });
    expect(store.remote).toBe('https://github.com/org/repo.git');
  });

  it('无 remote 时为 undefined', () => {
    const mgr = new LocalStoreManager();
    const store = mgr.createLocalStore({ id: 'local', rootDir: '/tmp/x' });
    expect(store.remote).toBeUndefined();
  });
});
