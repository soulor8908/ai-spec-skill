// src/adapters/ai-tool/adapters/copilot.ts —— GitHub Copilot 适配器
// 产出：.github/copilot-instructions.md（单文件，规则 + 命令汇聚）
//
// Copilot Chat 读取项目根 .github/copilot-instructions.md 作为自定义指令。
// 规则作为"禁止/必须"边界，命令作为"可用流程"段落，全部写入同一文件。

import type { AiToolCommandAdapter, CommandContent, DeclarativeRule } from '../types.js';
import { renderRuleBody, renderCommandBody } from './shared.js';

const FILE_PATH = '.github/copilot-instructions.md';

export const copilotAdapter: AiToolCommandAdapter = {
  toolId: 'copilot',
  displayName: 'GitHub Copilot',

  getFilePath(_ruleId: string): string {
    return FILE_PATH;
  },

  getCommandPath(_commandId: string): string {
    // Copilot 无独立命令文件概念，命令作为段落写入同一指令文件
    return FILE_PATH;
  },

  formatRule(rule: DeclarativeRule): string {
    return renderRuleBody(rule);
  },

  formatCommand(content: CommandContent): string {
    return renderCommandBody(content);
  },

  formatRulesHeader(): string {
    return [
      '# Copilot Instructions（ai-spec 生成）',
      '',
      '## 规则边界',
      '',
      '> BLOCK 级为硬约束，违反即阻断；WARN 为强建议；INFO 为审计。',
      '',
    ].join('\n');
  },

  formatCommandsHeader(): string {
    return ['', '## 可用命令', '', '> 通过对话引用下列流程。', ''].join('\n');
  },
};
