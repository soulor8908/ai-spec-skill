// src/adapters/ai-tool/types.ts —— AI 工具适配器 SPI 契约
// P0 产出：定义所有 AI 工具适配器须实现的接口，使声明式规则 + 命令能被各类 AI 工具消费。
//
// 设计原则（借鉴 OpenSpec ToolCommandAdapter，增加规则维度）：
// - OpenSpec 适配器只输出"命令"（告诉 AI 做什么）
// - ai-spec 适配器还要输出"规则"（告诉 AI 不能做什么）—— 核心差异化
// - 接口最小化：每个方法只负责"格式化一段内容"，路径解析与文件聚合由 generator 统一调度
// - 路径相对项目根（generator 拼接 outDir），适配器不触碰文件系统

import type { DeclarativeRule } from '../../engine/loader.js';
export type { DeclarativeRule };

/**
 * 命令内容（告诉 AI 做什么）。
 * 一个命令对应 AI 工具的一个 slash command / prompt 模板。
 */
export interface CommandContent {
  /** 命令 ID，如 'review-prd' / 'gen-tech-spec' */
  id: string;
  /** 一句话描述（部分工具作为 command 列表标题） */
  description: string;
  /** 命令主体 prompt（markdown） */
  prompt: string;
  /** 命令参数声明（可选，部分工具如 Cursor 支持参数） */
  arguments?: Array<CommandArgument>;
}

export interface CommandArgument {
  name: string;
  description: string;
  required?: boolean;
}

/**
 * AI 工具命令适配器接口。
 *
 * 每个适配器对应一种 AI 编码工具（Cursor / Claude Code / Copilot / ...），
 * 负责把语言无关的 DeclarativeRule + CommandContent 渲染为该工具能消费的文件格式。
 *
 * 关键差异（vs OpenSpec）：OpenSpec 只 formatCommand；本接口新增 formatRule，
 * 因为 ai-spec 的规则是"约束"（禁止/必须），须原样下发给 AI 工具作为行为边界。
 */
export interface AiToolCommandAdapter {
  /** 工具标识，如 'cursor' / 'claude' / 'copilot' / 'windsurf' / 'cline' / 'opencode' */
  toolId: string;
  /** 工具展示名（用于日志） */
  displayName: string;

  /**
   * 规则落盘路径（相对项目根）。
   * - 多文件工具（Cursor）：每条规则独立文件 → 路径含 ruleId
   * - 单文件工具（Windsurf/Cline/Copilot）：所有规则汇聚同一文件 → 路径与 ruleId 无关
   * generator 据此分组聚合：同路径的多条 formatRule 输出会被拼接。
   */
  getFilePath(ruleId: string): string;

  /**
   * 命令落盘路径（相对项目根）。
   * 命令通常是独立文件（Cursor/.claude commands），单文件工具可能汇聚到主指令文件。
   */
  getCommandPath(commandId: string): string;

  /**
   * 把单条声明式规则格式化为该工具能消费的文本。
   * 返回内容须自洽（含规则 ID + 标题 + 约束 + 修复提示），
   * 单文件工具下多条输出会被 generator 拼接，故不要在此返回文件级 frontmatter。
   */
  formatRule(rule: DeclarativeRule): string;

  /**
   * 把一条命令格式化为该工具能消费的文本。
   * 多文件工具返回完整文件内容（含 frontmatter）；单文件工具返回段落。
   */
  formatCommand(content: CommandContent): string;

  /**
   * 规则段落头部（可选）。单文件工具汇聚多条规则时，generator 在文件起始写入此头部。
   * 多文件工具无须实现（每条规则独立文件）。
   */
  formatRulesHeader?(): string;

  /**
   * 命令段落头部（可选）。同上，用于单文件工具汇聚命令时。
   */
  formatCommandsHeader?(): string;

  /**
   * 整文件序列化（可选）。当某落盘路径非 markdown（如 opencode.json），
   * 适配器可在此返回完整文件内容，绕过"分段拼接"默认行为。
   * 返回 undefined 时回退到分段拼接。仅对该适配器产出的同路径聚合内容调用。
   */
  serializeFile?(
    path: string,
    rules: DeclarativeRule[],
    commands: CommandContent[],
  ): string | undefined;
}

/**
 * 生成器输入。
 */
export interface AiToolGenerateInput {
  /** 目标 AI 工具 ID 清单（空 = 全部已注册适配器） */
  toolIds?: string[];
  /** 须下发的声明式规则 */
  rules: DeclarativeRule[];
  /** 须下发的命令 */
  commands: CommandContent[];
  /** 项目根目录（路径解析基准） */
  outDir: string;
}

/**
 * 生成器输出（沿用 SPI WriteOp 语义，便于复用注入管线的写入/回滚逻辑）。
 */
export interface AiToolWriteOp {
  /** 绝对路径 */
  path: string;
  content: string;
  is_new: boolean;
  reason: string;
}
