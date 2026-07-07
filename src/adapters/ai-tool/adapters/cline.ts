// src/adapters/ai-tool/adapters/cline.ts —— Cline 适配器
// 产出：.clinerules（单文件，规则 + 命令汇聚）
//
// Cline 读取项目根 .clinerules 作为持久规则。

import type { AiToolCommandAdapter, CommandContent, DeclarativeRule } from '../types.js';
import { renderRuleBody, renderCommandBody } from './shared.js';

const FILE_PATH = '.clinerules';

export const clineAdapter: AiToolCommandAdapter = {
  toolId: 'cline',
  displayName: 'Cline',

  getFilePath(_ruleId: string): string {
    return FILE_PATH;
  },

  getCommandPath(_commandId: string): string {
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
      '# Cline Rules（ai-spec 生成）',
      '',
      '## 规则边界',
      '',
      '> BLOCK 级为硬约束，违反即阻断；WARN 为强建议；INFO 为审计。',
      '',
    ].join('\n');
  },

  formatCommandsHeader(): string {
    return ['', '## 可用命令', ''].join('\n');
  },
};
