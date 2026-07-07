// test/mcp-server.test.ts —— MCP Server 测试
//
// 覆盖：
// - createMcpServer 创建成功，工具注册正确
// - 通过模拟 MCP 客户端调用三个工具，验证返回结构正确
// - profile-bridge：toSpiProfile 字段映射正确
//
// 不启动真实 stdio transport（避免测试阻塞），仅验证工具注册与回调逻辑。

import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../src/mcp/server.js';
import { toSpiProfile } from '../src/mcp/profile-bridge.js';
import type { ProjectProfile as InjectProfile } from '../src/inject/detector/types.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** 用 InMemoryTransport 连接 server 与 client，便于测试工具调用 */
async function connectClient() {
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return { server, client };
}

describe('MCP Server 工具注册', () => {
  it('tools/list 应返回 3 个工具', async () => {
    const { client, server } = await connectClient();
    try {
      const tools = await client.listTools();
      const names = tools.tools.map((t) => t.name).sort();
      expect(names).toEqual(['check-rules', 'inject-spec', 'score-spec']);
    } finally {
      await server.close();
      await client.close();
    }
  });

  it('check-rules 工具应有 rootDir + 可选 ruleIds 入参 schema', async () => {
    const { client, server } = await connectClient();
    try {
      const tools = await client.listTools();
      const check = tools.tools.find((t) => t.name === 'check-rules')!;
      expect(check).toBeDefined();
      expect(check.inputSchema).toBeDefined();
      const props = (check.inputSchema as { properties: Record<string, unknown> }).properties;
      expect(props).toHaveProperty('rootDir');
      expect(props).toHaveProperty('ruleIds');
    } finally {
      await server.close();
      await client.close();
    }
  });
});

describe('MCP score-spec 工具调用', () => {
  let tmpDir: string;

  function setup(): void {
    tmpDir = mkdtempSync(join(tmpdir(), 'ai-spec-mcp-score-'));
  }

  function teardown(): void {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  }

  it('对不存在的 Spec 文件应返回 0 分', async () => {
    setup();
    try {
      const { client, server } = await connectClient();
      try {
        const result = await client.callTool({
          name: 'score-spec',
          arguments: { specPath: join(tmpDir, 'nonexistent.md') },
        });
        expect(result.content).toBeDefined();
        const text = (result.content as Array<{ type: string; text: string }>)[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.total_score).toBe(0);
      } finally {
        await server.close();
        await client.close();
      }
    } finally {
      teardown();
    }
  });

  it('对完整 Spec 应返回 >0 分', async () => {
    setup();
    try {
      const specPath = join(tmpDir, 'spec.md');
      writeFileSync(
        specPath,
        `# Spec
## Context
项目目标：xxx
## Architecture
分层架构：xxx
## Contract
接口契约：xxx
## Rules
规则清单：xxx
## Data Model
数据模型：xxx
## Errors
错误处理：xxx
## Tests
测试策略：xxx
## Blocking
阻断条件：xxx
## Impact
影响范围：xxx
`,
      );
      const { client, server } = await connectClient();
      try {
        const result = await client.callTool({
          name: 'score-spec',
          arguments: { specPath },
        });
        const text = (result.content as Array<{ type: string; text: string }>)[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.total_score).toBeGreaterThan(0);
        expect(Array.isArray(parsed.sections)).toBe(true);
        expect(Array.isArray(parsed.suggestions)).toBe(true);
      } finally {
        await server.close();
        await client.close();
      }
    } finally {
      teardown();
    }
  });
});

describe('MCP inject-spec 工具调用（dry-run）', () => {
  let tmpDir: string;

  function setup(): void {
    tmpDir = mkdtempSync(join(tmpdir(), 'ai-spec-mcp-inject-'));
    // 造一个最小 TS 项目（让 detectProject 能识别）
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: { fastify: '^4.0.0' },
        devDependencies: { vitest: '^1.0.0' },
      }),
    );
    mkdirSync(join(tmpDir, 'src'), { recursive: true });
    writeFileSync(join(tmpDir, 'tsconfig.json'), '{}');
    writeFileSync(join(tmpDir, 'src', 'index.ts'), 'export {};\n');
  }

  function teardown(): void {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  }

  it('dry-run 应返回 plan 但无 execution', async () => {
    setup();
    try {
      const { client, server } = await connectClient();
      try {
        const result = await client.callTool({
          name: 'inject-spec',
          arguments: { rootDir: tmpDir, apply: false },
        });
        const text = (result.content as Array<{ type: string; text: string }>)[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.profile).toBeDefined();
        expect(parsed.profile.language).toBe('typescript');
        expect(parsed.plan).toBeDefined();
        expect(parsed.plan.dry_run).toBe(true);
        expect(parsed.execution).toBeUndefined();
      } finally {
        await server.close();
        await client.close();
      }
    } finally {
      teardown();
    }
  });
});

describe('MCP check-rules 工具调用', () => {
  let tmpDir: string;

  function setup(): void {
    tmpDir = mkdtempSync(join(tmpdir(), 'ai-spec-mcp-check-'));
    // 造一个最小 TS 项目（让 detectProject 能识别 + RuleEngine 能跑）
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'x', version: '1.0.0', devDependencies: { vitest: '^1.0.0' } }),
    );
    mkdirSync(join(tmpDir, 'src'), { recursive: true });
    writeFileSync(join(tmpDir, 'tsconfig.json'), '{}');
    writeFileSync(join(tmpDir, 'src', 'index.ts'), 'export {};\n');
  }

  function teardown(): void {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  }

  it('应返回 EngineResult 结构（findings/exit_code/loaded_rules）', async () => {
    setup();
    try {
      const { client, server } = await connectClient();
      try {
        const result = await client.callTool({
          name: 'check-rules',
          arguments: { rootDir: tmpDir },
        });
        const text = (result.content as Array<{ type: string; text: string }>)[0].text;
        const parsed = JSON.parse(text);
        expect(parsed).toHaveProperty('exit_code');
        expect(parsed).toHaveProperty('findings');
        expect(parsed).toHaveProperty('loaded_rules');
        expect(parsed).toHaveProperty('executed_rules');
        expect(Array.isArray(parsed.findings)).toBe(true);
      } finally {
        await server.close();
        await client.close();
      }
    } finally {
      teardown();
    }
  });
});

describe('profile-bridge：toSpiProfile', () => {
  it('应把 inject 版 ProjectProfile 转换为 SPI 版', () => {
    const injectProfile: InjectProfile = {
      root_dir: '/proj',
      detected_at: '2026-01-01T00:00:00Z',
      language: 'typescript',
      backend: { id: 'fastify', label: 'Fastify', confidence: 0.9, evidence: ['package.json'] },
      frontend: { id: 'react', label: 'React', confidence: 0.8, evidence: ['package.json'] },
      db: { id: 'postgresql', label: 'PostgreSQL', confidence: 0.7, evidence: ['compose.yml'] },
      orm: { id: 'prisma', label: 'Prisma', confidence: 0.8, evidence: ['schema.prisma'] },
      test_runner: { id: 'vitest', label: 'Vitest', confidence: 0.95, evidence: ['package.json'] },
      ci: { id: 'github-actions', label: 'GitHub Actions', confidence: 0.9, evidence: ['.github'] },
      overall_confidence: 0.85,
      signals: [
        { source: 'package.json', kind: 'manifest', detected: 'fastify', confidence: 0.9 },
      ],
      warnings: [],
    };

    const spi = toSpiProfile(injectProfile);
    expect(spi.language).toBe('typescript');
    expect(spi.backend_framework).toBe('fastify');
    expect(spi.frontend_framework).toBe('react');
    expect(spi.database).toBe('postgresql');
    expect(spi.orm).toBe('prisma');
    expect(spi.test_runner).toBe('vitest');
    expect(spi.ci_platform).toBe('github-actions');
    expect(spi.confidence).toBe(0.85);
    expect(spi.contract_lib).toBeNull(); // 无对应探测字段
    expect(spi.signals).toHaveLength(1);
    expect(spi.signals[0]).toEqual({ path: 'package.json', matched: 'fastify', weight: 0.9 });
  });

  it('空探测字段应映射为 null', () => {
    const injectProfile: InjectProfile = {
      root_dir: '/proj',
      detected_at: '2026-01-01T00:00:00Z',
      language: 'unknown',
      overall_confidence: 0,
      signals: [],
      warnings: [],
    };
    const spi = toSpiProfile(injectProfile);
    expect(spi.language).toBe('unknown');
    expect(spi.backend_framework).toBeNull();
    expect(spi.frontend_framework).toBeNull();
    expect(spi.database).toBeNull();
    expect(spi.orm).toBeNull();
    expect(spi.test_runner).toBeNull();
    expect(spi.ci_platform).toBeNull();
  });
});
