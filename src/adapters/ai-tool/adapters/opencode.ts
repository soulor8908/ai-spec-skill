// src/adapters/ai-tool/adapters/opencode.ts —— opencode 适配器
// 产出：
//   - 规则 → AGENTS.md（单文件，所有规则汇聚）
//   - 命令 → opencode.json（单文件 JSON，命令注册表）
//
// opencode 读取项目根 AGENTS.md 作为 agent 指令；opencode.json 声明可用命令。
// 由于 opencode.json 是 JSON（非 markdown），用 serializeFile 整文件序列化，
// 绕过 generator 的"分段拼接"默认行为。

import type { AiToolCommandAdapter, CommandContent, DeclarativeRule } from '../types.js';
import { renderRuleBody } from './shared.js';

const RULES_PATH = 'AGENTS.md';
const COMMANDS_PATH = 'opencode.json';

export const opencodeAdapter: AiToolCommandAdapter = {
  toolId: 'opencode',
  displayName: 'opencode',

  getFilePath(_ruleId: string): string {
    return RULES_PATH;
  },

  getCommandPath(_commandId: string): string {
    return COMMANDS_PATH;
  },

  formatRule(rule: DeclarativeRule): string {
    return renderRuleBody(rule);
  },

  // opencode.json 是 JSON，单条命令不直接拼接；serializeFile 统一序列化
  formatCommand(content: CommandContent): string {
    return content.prompt;
  },

  formatRulesHeader(): string {
    return [
      '# AGENTS.md（ai-spec 生成）',
      '',
      '## 规则边界',
      '',
      '> BLOCK 级为硬约束，违反即阻断；WARN 为强建议；INFO 为审计。',
      '',
    ].join('\n');
  },

  serializeFile(
    path: string,
    _rules: DeclarativeRule[],
    commands: CommandContent[],
  ): string | undefined {
    if (path !== COMMANDS_PATH) return undefined; // AGENTS.md 走默认分段拼接
    const config = {
      // opencode.json 命令注册表：每条命令一个 entry
      commands: commands.map((c) => ({
        name: c.id,
        description: c.description,
        arguments: c.arguments ?? [],
        prompt: c.prompt,
      })),
    };
    return JSON.stringify(config, null, 2) + '\n';
  },
};
