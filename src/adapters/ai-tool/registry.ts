// src/adapters/ai-tool/registry.ts —— AI 工具适配器注册表
// P0 产出：维护 toolId → 适配器映射，支持注册/查询/列举。
//
// 与 src/registry/registry.ts（Skill Registry）区别：
// - Skill Registry 管"方法论 skill 包"（user-mgmt / audit-log ...）
// - 本 registry 管"AI 工具适配器"（cursor / claude / copilot ...），是 P0 新增维度
//
// 内置 6 个适配器通过 registerBuiltinAiToolAdapters() 一次性注册。

import type { AiToolCommandAdapter } from './types.js';
import { cursorAdapter } from './adapters/cursor.js';
import { claudeAdapter } from './adapters/claude.js';
import { copilotAdapter } from './adapters/copilot.js';
import { windsurfAdapter } from './adapters/windsurf.js';
import { clineAdapter } from './adapters/cline.js';
import { opencodeAdapter } from './adapters/opencode.js';

const registry = new Map<string, AiToolCommandAdapter>();

/** 注册一个 AI 工具适配器（toolId 重复则覆盖） */
export function registerAiToolAdapter(adapter: AiToolCommandAdapter): void {
  registry.set(adapter.toolId, adapter);
}

/** 按 toolId 获取适配器，未注册返回 undefined */
export function getAiToolAdapter(toolId: string): AiToolCommandAdapter | undefined {
  return registry.get(toolId);
}

/** 列出所有已注册适配器 */
export function listAiToolAdapters(): AiToolCommandAdapter[] {
  return [...registry.values()];
}

/** 注册内置 6 个适配器（幂等，重复调用无副作用） */
export function registerBuiltinAiToolAdapters(): void {
  for (const adapter of [
    cursorAdapter,
    claudeAdapter,
    copilotAdapter,
    windsurfAdapter,
    clineAdapter,
    opencodeAdapter,
  ]) {
    if (!registry.has(adapter.toolId)) {
      registry.set(adapter.toolId, adapter);
    }
  }
}

/** 清空注册表（仅供测试用） */
export function clearAiToolAdapters(): void {
  registry.clear();
}

// 模块加载即注册内置适配器，消费方 import 后可直接 getAiToolAdapter('cursor')
registerBuiltinAiToolAdapters();
