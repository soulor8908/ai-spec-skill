// src/mcp/index.ts —— MCP Server 模块聚合入口
//
// 用法（程序化）：
//   import { createMcpServer } from '@ai-spec/skill/mcp';
//   const server = createMcpServer();
//   await server.connect(transport);
//
// 用法（CLI）：
//   ai-spec mcp   ← 启动 stdio MCP Server

export { createMcpServer, startStdioMcpServer } from './server.js';
export { toSpiProfile } from './profile-bridge.js';
