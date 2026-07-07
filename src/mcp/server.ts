// src/mcp/server.ts —— MCP Server（Model Context Protocol）
// 把 ai-spec-skill 的三大核心能力（规则检查 / 注入 / Spec 评分）暴露为 MCP 工具，
// 供 Claude Code / Cursor / Windsurf 等支持 MCP 的 AI 工具直接消费。
//
// 消费方式（Claude Code 示例）：
//   .claude/mcp.json →
//   { "mcpServers": { "ai-spec": { "command": "npx", "args": ["@ai-spec/skill", "mcp"] } } }
//
// 三个工具：
//   check-rules  → RuleEngine.run()（先 detectProject 再转 SPI profile）
//   inject-spec  → InjectPipeline.run()（默认 dry-run，apply=true 才写入）
//   score-spec   → scoreSpec()（Spec 完整性 0-100 评分）

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { RuleEngine } from '../engine/engine.js';
import { InjectPipeline } from '../inject/index.js';
import { detectProject } from '../inject/detector/detector.js';
import { scoreSpec } from '../intelligence/spec-completeness.js';
import { toSpiProfile } from './profile-bridge.js';

/** MCP 工具返回的文本内容块 */
interface TextContentBlock {
  type: 'text';
  text: string;
}

/**
 * 创建并配置 McpServer，注册三个工具。
 * 不连接 transport，便于测试与复用（调用方决定 stdio / http）。
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: '@ai-spec/skill',
    version: '0.2.0',
  });

  // ─── check-rules：对项目跑规则检查 ───
  server.tool(
    'check-rules',
    '对项目根目录跑 ai-spec 规则检查，返回 findings 与退出码。可选 ruleIds 只跑指定规则。',
    {
      rootDir: z.string().describe('项目根目录（绝对路径）'),
      ruleIds: z.array(z.string()).optional().describe('只跑指定规则 ID（缺省跑全部）'),
    },
    async ({ rootDir, ruleIds }) => {
      const profile = toSpiProfile(detectProject(rootDir));
      const engine = new RuleEngine({
        rootDir,
        profile,
        ruleIds: ruleIds ?? [],
        advisoryMode: true,
      });
      const result = await engine.run();
      return toText({
        exit_code: result.exit_code,
        executed_rules: result.executed_rules,
        loaded_rules: result.loaded_rules,
        findings_count: result.findings.length,
        findings: result.findings,
        meta003_violations: result.meta003_violations,
        meta004_violations: result.meta004_violations,
      });
    },
  );

  // ─── inject-spec：注入 spec-first 基础设施 ───
  server.tool(
    'inject-spec',
    '对既有项目注入 spec-first 基础设施（默认 dry-run，apply=true 才实际写入）。',
    {
      rootDir: z.string().describe('项目根目录（绝对路径）'),
      apply: z.boolean().describe('是否实际写入（false=仅生成计划）'),
    },
    async ({ rootDir, apply }) => {
      const pipe = new InjectPipeline();
      const result = await pipe.run({ rootDir, apply });
      // 注入结果含非可序列化字段（如 ArchAnalysis 嵌套函数），裁剪为可序列化摘要
      return toText({
        profile: {
          language: result.profile.language,
          backend: result.profile.backend?.label ?? null,
          frontend: result.profile.frontend?.label ?? null,
          overall_confidence: result.profile.overall_confidence,
        },
        plan: {
          writes_count: result.plan.writes.length,
          impact: result.plan.impact,
          dry_run: result.plan.dry_run,
        },
        execution: result.execution
          ? { written: result.execution.written, backups: result.execution.backups }
          : undefined,
        safety_report: result.safety_report
          ? {
              new_failures: result.safety_report.new_failures,
              baseline_passed: result.safety_report.baseline.passed,
              after_passed: result.safety_report.after.passed,
            }
          : undefined,
      });
    },
  );

  // ─── score-spec：Spec 完整性评分 ───
  server.tool(
    'score-spec',
    '对 Spec markdown 文件做完整性评分（0-100），返回章节覆盖与改进建议。',
    {
      specPath: z.string().describe('Spec 文件绝对路径'),
    },
    async ({ specPath }) => {
      const result = scoreSpec(specPath);
      return toText({
        total_score: result.total_score,
        sections: result.sections,
        suggestions: result.suggestions,
      });
    },
  );

  return server;
}

/**
 * 启动 stdio MCP Server（CLI `ai-spec mcp` 调用）。
 * 进程持续运行，通过 stdin/stdout 与 MCP 客户端通信。
 */
export async function startStdioMcpServer(): Promise<McpServer> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return server;
}

/** 把任意可序列化值包装为 MCP 文本内容块 */
function toText(payload: unknown): { content: TextContentBlock[] } {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}
