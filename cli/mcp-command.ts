// cli/mcp-command.ts —— `ai-spec mcp` 子命令：启动 stdio MCP Server
// 消费方式（Claude Code / Cursor）：
//   .claude/mcp.json →
//   { "mcpServers": { "ai-spec": { "command": "npx", "args": ["@ai-spec/skill", "mcp"] } } }
//
// 启动后进程持续运行，通过 stdin/stdout 与 MCP 客户端通信。
// 日志一律走 stderr（stdout 留给 MCP 协议帧）。

import { Command } from 'commander';
import { startStdioMcpServer } from '../src/mcp/server.js';
import { logger } from './log.js';

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('启动 MCP Server（stdio 模式），供 Claude Code / Cursor 等 AI 工具消费')
    .action(async () => {
      await runMcpServer();
    });
}

async function runMcpServer(): Promise<void> {
  // 日志走 stderr，避免污染 stdout（MCP 协议帧通道）
  logger.banner();
  logger.info('启动 MCP Server（stdio 模式）...');
  logger.info('工具：check-rules / inject-spec / score-spec');
  logger.info('等待 MCP 客户端连接（stdin/stdout）...');

  try {
    await startStdioMcpServer();
    // server.connect 后进程持续运行，直到客户端断开或收到 SIGINT
  } catch (e) {
    logger.error(`MCP Server 启动失败：${(e as Error).message}`);
    process.exit(1);
  }
}
