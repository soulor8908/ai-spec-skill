// src/adapters/ai-tool/adapters/shared.ts —— 适配器共享的规则/命令 markdown 渲染片段
//
// 单文件工具（Copilot/Windsurf/Cline/Claude 的 CLAUDE.md）汇聚多条规则时，
// 需要一段语言无关的规则正文。本文件提供该正文渲染，避免每个适配器重复实现。

import type { DeclarativeRule, CommandContent } from '../types.js';

/** 严重级别图标（统一，避免每个适配器各写一套） */
const SEVERITY_ICON: Record<string, string> = {
  error: 'BLOCK',
  warning: 'WARN',
  info: 'INFO',
};

/**
 * 渲染单条规则的核心正文（无文件级 frontmatter）。
 * 单文件工具直接拼接此输出；多文件工具在此基础上追加 frontmatter。
 */
export function renderRuleBody(rule: DeclarativeRule): string {
  const lines: string[] = [];
  const icon = SEVERITY_ICON[rule.severity] ?? rule.severity.toUpperCase();
  lines.push(`### ${rule.id} — ${rule.title}`);
  lines.push('');
  lines.push(`- **级别**：${icon}（${rule.severity}）`);
  if (rule.category) lines.push(`- **类别**：${rule.category}`);
  if (rule.applies_to?.file_patterns?.length) {
    lines.push(`- **适用范围**：${rule.applies_to.file_patterns.join(', ')}`);
  }
  lines.push(`- **约束**：${describeCheckKind(rule.check?.kind)}`);
  if (rule.check?.expr) {
    lines.push(`  - 检测表达式：\`${rule.check.expr}\``);
  }
  if (rule.fix_hint) {
    lines.push(`- **修复建议**：${rule.fix_hint}`);
  }
  if (rule.rationale_ref) {
    lines.push(`- **rationale**：${rule.rationale_ref}`);
  }
  return lines.join('\n');
}

function describeCheckKind(kind?: string): string {
  switch (kind) {
    case 'regex':
      return '禁止匹配以下模式（出现即违规）';
    case 'ast':
      return 'AST 结构检查（须 plugin）';
    case 'import-graph':
      return '依赖图检查（须 plugin）';
    case 'structure':
      return '目录/文件结构检查';
    case 'manual':
      return '人工/语义检查（须 manual_checker）';
    default:
      return kind ? `${kind} 检查` : '未声明检查方式';
  }
}

/**
 * 渲染单条命令的核心正文（无文件级 frontmatter）。
 */
export function renderCommandBody(content: CommandContent): string {
  const lines: string[] = [];
  lines.push(`### /${content.id}`);
  lines.push('');
  lines.push(`> ${content.description}`);
  lines.push('');
  if (content.arguments?.length) {
    lines.push('**参数**：');
    for (const arg of content.arguments) {
      const req = arg.required ? '必填' : '可选';
      lines.push(`- \`${arg.name}\`（${req}）：${arg.description}`);
    }
    lines.push('');
  }
  lines.push(content.prompt);
  return lines.join('\n');
}
