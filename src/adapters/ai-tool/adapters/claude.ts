// src/adapters/ai-tool/adapters/claude.ts —— Claude Code 适配器
// 产出：
//   - 规则 → CLAUDE.md（所有规则汇聚单文件，追加到现有内容后）
//   - 命令 → .claude/commands/<id>.md（每条命令独立文件，slash command）
//
// Claude Code 读取项目根 CLAUDE.md 作为持久指令；规则作为"行为边界"段落写入。
// .claude/commands/ 下每份 .md 即一个 /<id> slash command。

import type { AiToolCommandAdapter, CommandContent, DeclarativeRule } from '../types.js';
import { renderRuleBody } from './shared.js';

export const claudeAdapter: AiToolCommandAdapter = {
  toolId: 'claude',
  displayName: 'Claude Code',

  getFilePath(_ruleId: string): string {
    // 所有规则汇聚到 CLAUDE.md（_ruleId 忽略，generator 据同路径分组拼接）
    return 'CLAUDE.md';
  },

  getCommandPath(commandId: string): string {
    return `.claude/commands/${commandId}.md`;
  },

  formatRule(rule: DeclarativeRule): string {
    // 段落形式，便于在 CLAUDE.md 中与其他指令共存
    return renderRuleBody(rule);
  },

  formatRulesHeader(): string {
    return [
      '# ai-spec 规则边界（自动生成，勿手改）',
      '',
      '> 以下规则由 ai-spec 下发。**BLOCK 级为硬约束，违反即阻断**；WARN 为强建议；INFO 为审计。',
      '',
    ].join('\n');
  },

  formatCommand(content: CommandContent): string {
    // Claude slash command：首行 description，其余为 prompt
    const lines: string[] = [];
    lines.push('---');
    lines.push(`description: ${content.description}`);
    if (content.arguments?.length) {
      lines.push('arguments:');
      for (const arg of content.arguments) {
        lines.push(`  - name: ${arg.name}`);
        lines.push(`    description: ${arg.description}`);
        lines.push(`    required: ${arg.required ?? false}`);
      }
    }
    lines.push('---');
    lines.push('');
    lines.push(content.prompt);
    return lines.join('\n') + '\n';
  },
};
