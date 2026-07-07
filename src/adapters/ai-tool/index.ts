// src/adapters/ai-tool/index.ts —— AI 工具适配器模块聚合入口
// P0 产出：导出 SPI 接口、注册表、生成器、6 个内置适配器。
//
// 用法：
//   import { generateAiToolFiles, getAiToolAdapter } from '@ai-spec/skill/ai-tool';
//   const writes = generateAiToolFiles({
//     rules, commands, toolIds: ['cursor', 'claude'], outDir: '/path/to/project',
//   });

export type {
  AiToolCommandAdapter,
  CommandContent,
  CommandArgument,
  AiToolGenerateInput,
  AiToolWriteOp,
} from './types.js';
export type { DeclarativeRule } from './types.js';

export {
  generateAiToolFiles,
} from './generator.js';

export {
  registerAiToolAdapter,
  getAiToolAdapter,
  listAiToolAdapters,
  registerBuiltinAiToolAdapters,
  clearAiToolAdapters,
} from './registry.js';

export { cursorAdapter } from './adapters/cursor.js';
export { claudeAdapter } from './adapters/claude.js';
export { copilotAdapter } from './adapters/copilot.js';
export { windsurfAdapter } from './adapters/windsurf.js';
export { clineAdapter } from './adapters/cline.js';
export { opencodeAdapter } from './adapters/opencode.js';
