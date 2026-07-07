// src/adapters/ai-tool/adapters/cursor.ts —— Cursor 适配器
// 产出：
//   - 规则 → .cursor/rules/<RULE_ID>.mdc（每条规则独立文件，含 frontmatter）
//   - 命令 → .cursor/commands/<id>.md（每条命令独立文件）
//
// Cursor 的 .mdc frontmatter 字段：
//   description    规则描述（用于规则匹配/展示）
//   globs          适用文件 glob（来自 applies_to.file_patterns）
//   alwaysApply    是否总是注入上下文（error 级别规则建议 alwaysApply=true）

import type { AiToolCommandAdapter, CommandContent, DeclarativeRule } from '../types.js';
import { renderRuleBody } from './shared.js';

export const cursorAdapter: AiToolCommandAdapter = {
  toolId: 'cursor',
  displayName: 'Cursor',

  getFilePath(ruleId: string): string {
    return `.cursor/rules/${ruleId}.mdc`;
  },

  getCommandPath(commandId: string): string {
    return `.cursor/commands/${commandId}.md`;
  },

  formatRule(rule: DeclarativeRule): string {
    const globs = rule.applies_to?.file_patterns?.length
      ? rule.applies_to.file_patterns.join(', ')
      : '**/*';
    // error 级别规则总是注入，确保硬约束始终生效
    const alwaysApply = rule.severity === 'error';
    const frontmatter = [
      '---',
      `description: ${escapeYaml(rule.title)}`,
      `globs: ${escapeYaml(globs)}`,
      `alwaysApply: ${alwaysApply}`,
      '---',
      '',
    ].join('\n');
    return frontmatter + renderRuleBody(rule) + '\n';
  },

  formatCommand(content: CommandContent): string {
    const lines: string[] = [];
    lines.push(`---`);
    lines.push(`description: ${escapeYaml(content.description)}`);
    lines.push(`---`);
    lines.push('');
    if (content.arguments?.length) {
      lines.push('## Arguments');
      for (const arg of content.arguments) {
        const req = arg.required ? 'required' : 'optional';
        lines.push(`- **${arg.name}** (${req}): ${arg.description}`);
      }
      lines.push('');
    }
    lines.push(content.prompt);
    return lines.join('\n') + '\n';
  },
};

/** YAML 字符串转义：含特殊字符时用双引号包裹 */
function escapeYaml(s: string): string {
  if (/[:#\[\]{}&'*!|>%@`,]/.test(s) || s.includes('\n')) {
    return `"${s.replace(/"/g, '\\"')}"`;
  }
  return s;
}
