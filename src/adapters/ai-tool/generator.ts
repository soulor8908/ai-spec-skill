// src/adapters/ai-tool/generator.ts —— 规则/命令 → AI 工具文件生成器
// P0 产出：把声明式规则 + 命令，经各 AI 工具适配器渲染为落盘 WriteOp 清单。
//
// 核心职责（适配器只管"格式化一段"，本文件管"聚合落盘"）：
// 1. 按适配器 getFilePath / getCommandPath 分组：同路径的多段内容汇聚到一个 WriteOp
// 2. 单文件工具（Copilot/Windsurf/Cline）：规则段 + 命令段写入同一文件
// 3. JSON 文件（opencode.json）：调用 serializeFile 整文件序列化，绕过分段拼接
// 4. 多文件工具（Cursor）：每条规则/命令独立文件，不汇聚
//
// 关键差异化（vs OpenSpec）：本生成器同时下发"规则"（不能做什么）与"命令"（做什么）。

import { join, normalize } from 'node:path';
import type {
  AiToolCommandAdapter,
  AiToolGenerateInput,
  AiToolWriteOp,
  CommandContent,
  DeclarativeRule,
} from './types.js';
import { listAiToolAdapters, getAiToolAdapter } from './registry.js';

/**
 * 生成 AI 工具消费文件。
 *
 * @param input.rules   须下发的声明式规则（告诉 AI 不能做什么）
 * @param input.commands 须下发的命令（告诉 AI 做什么）
 * @param input.toolIds 目标工具清单（空 = 全部已注册适配器）
 * @param input.outDir  项目根目录（路径解析基准）
 * @returns WriteOp 清单（绝对路径）
 */
export function generateAiToolFiles(input: AiToolGenerateInput): AiToolWriteOp[] {
  const adapters = resolveAdapters(input.toolIds);
  const writes: AiToolWriteOp[] = [];

  for (const adapter of adapters) {
    writes.push(...generateForAdapter(adapter, input.rules, input.commands, input.outDir));
  }

  return writes;
}

function resolveAdapters(toolIds?: string[]): AiToolCommandAdapter[] {
  if (!toolIds || toolIds.length === 0) {
    return listAiToolAdapters();
  }
  const found: AiToolCommandAdapter[] = [];
  for (const id of toolIds) {
    const a = getAiToolAdapter(id);
    if (!a) {
      throw new Error(`AI 工具适配器未注册：${id}（已知：cursor/claude/copilot/windsurf/cline/opencode）`);
    }
    found.push(a);
  }
  return found;
}

interface Fragment {
  rule?: DeclarativeRule;
  command?: CommandContent;
  text: string;
}

function generateForAdapter(
  adapter: AiToolCommandAdapter,
  rules: DeclarativeRule[],
  commands: CommandContent[],
  outDir: string,
): AiToolWriteOp[] {
  // 1. 规则按路径分组
  const ruleGroups = new Map<string, Fragment[]>();
  for (const rule of rules) {
    const path = adapter.getFilePath(rule.id);
    const text = adapter.formatRule(rule);
    pushGroup(ruleGroups, path, { rule, text });
  }

  // 2. 命令按路径分组
  const cmdGroups = new Map<string, Fragment[]>();
  for (const cmd of commands) {
    const path = adapter.getCommandPath(cmd.id);
    const text = adapter.formatCommand(cmd);
    pushGroup(cmdGroups, path, { command: cmd, text });
  }

  // 3. 合并所有目标路径
  const allPaths = new Set<string>([...ruleGroups.keys(), ...cmdGroups.keys()]);
  const writes: AiToolWriteOp[] = [];

  for (const relPath of allPaths) {
    const rGrp = ruleGroups.get(relPath) ?? [];
    const cGrp = cmdGroups.get(relPath) ?? [];
    const rRules = rGrp.map((f) => f.rule!).filter(Boolean);
    const cCmds = cGrp.map((f) => f.command!).filter(Boolean);

    let content: string;

    // JSON / 非 markdown 文件：整文件序列化
    if (adapter.serializeFile) {
      const serialized = adapter.serializeFile(relPath, rRules, cCmds);
      if (serialized !== undefined) {
        content = serialized;
        writes.push(makeWrite(adapter, relPath, content, outDir, rRules.length, cCmds.length));
        continue;
      }
    }

    // 默认分段拼接
    content = assembleMarkdown(adapter, rGrp, cGrp);
    writes.push(makeWrite(adapter, relPath, content, outDir, rRules.length, cCmds.length));
  }

  return writes;
}

function pushGroup(groups: Map<string, Fragment[]>, path: string, frag: Fragment): void {
  const arr = groups.get(path);
  if (arr) arr.push(frag);
  else groups.set(path, [frag]);
}

function assembleMarkdown(
  adapter: AiToolCommandAdapter,
  rGrp: Fragment[],
  cGrp: Fragment[],
): string {
  const parts: string[] = [];

  if (rGrp.length > 0) {
    if (adapter.formatRulesHeader) parts.push(adapter.formatRulesHeader());
    parts.push(rGrp.map((f) => f.text).join('\n\n'));
  }

  if (cGrp.length > 0) {
    if (adapter.formatCommandsHeader) parts.push(adapter.formatCommandsHeader());
    parts.push(cGrp.map((f) => f.text).join('\n\n'));
  }

  return parts.join('\n\n') + '\n';
}

function makeWrite(
  adapter: AiToolCommandAdapter,
  relPath: string,
  content: string,
  outDir: string,
  ruleCount: number,
  cmdCount: number,
): AiToolWriteOp {
  const absPath = normalize(join(outDir, relPath));
  const bits: string[] = [`P0 ai-tool 适配器 [${adapter.toolId}]`];
  if (ruleCount) bits.push(`${ruleCount} 规则`);
  if (cmdCount) bits.push(`${cmdCount} 命令`);
  return {
    path: absPath,
    content,
    is_new: true,
    reason: `${bits.join(' + ')} → ${relPath}`,
  };
}
