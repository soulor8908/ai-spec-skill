// src/delta/types.ts —— Delta Spec 变更模型类型
// P1 产出：定义增量变更的四种操作（ADDED/MODIFIED/REMOVED/RENAMED），
// 让棕地项目的变更描述只需写 diff，不必重写整个 spec。
//
// 与 OpenSpec 的差异：OpenSpec 的 delta 只作用于 spec 文本；
// ai-spec 的 delta 还须作用于契约 schema 和规则集——
// 例如 ADDED 一个新字段到 user.meta.yaml，MODIFIED 一条规则的 severity。

import type { ContractSchemaMeta } from '../spi/adapter.js';
import type { DeclarativeRule } from '../engine/loader.js';

/** 变更操作类型 */
export type DeltaOpKind = 'ADDED' | 'MODIFIED' | 'REMOVED' | 'RENAMED';

/** 变更作用维度：spec 文本 / 契约 schema / 规则集 */
export type DeltaSection = 'spec' | 'contract' | 'rule';

/**
 * Delta 目标定位：声明本轮 delta 作用于哪些主文件。
 * 各路径相对项目根。未声明的维度跳过（不读不写）。
 */
export interface DeltaTarget {
  /** 主 spec markdown 路径（如 docs/spec/user.md） */
  spec?: string;
  /** 契约元模型 yaml 路径（如 skills/user-mgmt/contracts/user.meta.yaml） */
  contract?: string;
  /** 规则集 yaml 路径（如 skills/user-mgmt/rules/user-domain.yaml） */
  rules?: string;
}

/**
 * 单条变更操作。
 */
export interface DeltaOperation {
  kind: DeltaOpKind;
  section: DeltaSection;
  /**
   * 操作目标：
   * - spec：章节标题文本（不含 # 前缀），如 '用户资料'
   * - contract：schema 名，如 'userOutput'
   * - rule：规则 ID，如 'USER-001'
   */
  target: string;
  /** RENAMED 的新名（仅 RENAMED 有值） */
  renamed_to?: string;
  /**
   * 原始内容（markdown 段落 / yaml 文本）：
   * - spec ADDED/MODIFIED：章节正文 markdown
   * - contract/rule ADDED/MODIFIED：yaml 块文本
   * - REMOVED/RENAMED：无
   */
  content?: string;
  /** 解析后的结构化内容（contract→ContractSchemaMeta[]；rule→DeclarativeRule） */
  parsed?: ContractSchemaMeta[] | DeclarativeRule;
  /** delta 文件中的行号（报错定位） */
  _line?: number;
}

/**
 * 完整的 Delta Spec（一个 delta 文件解析结果）。
 */
export interface DeltaSpec {
  title: string;
  description?: string;
  target: DeltaTarget;
  operations: DeltaOperation[];
  _source_file?: string;
}

/**
 * 结构化变更描述（供 apply 内部传递，contract/rule 维度的强类型视图）。
 */
export interface ChangeSchema {
  section: 'contract' | 'rule';
  kind: DeltaOpKind;
  target: string;
  renamed_to?: string;
  /** contract ADDED/MODIFIED 时填充 */
  schemas?: ContractSchemaMeta[];
  /** rule ADDED/MODIFIED 时填充 */
  rule?: DeclarativeRule;
}

/**
 * applyDelta 输入。
 */
export interface ApplyDeltaInput {
  /** 项目根目录（解析 target 路径的基准） */
  projectRoot: string;
  /** 已解析的 delta（也可传原始文本由 parseDeltaSpec 解析） */
  delta: DeltaSpec;
  /** 是否实际写入（默认 false = dry-run，只返回结果不落盘） */
  apply?: boolean;
}

/**
 * applyDelta 单维度结果（契约/规则维度，带对象列表）。
 */
export interface ApplySectionResult<T> {
  /** 变更后的完整内容（contract/rules=序列化后的 yaml） */
  content: string;
  /** 变更前对象列表（contract→schemas；rules→rules） */
  before: T[];
  /** 变更后对象列表 */
  after: T[];
  /** 实际生效的操作数 */
  applied_count: number;
  /** 跳过的操作及原因 */
  skipped: Array<{ target: string; reason: string }>;
}

/**
 * spec 维度结果（无对象列表，仅 markdown 文本）。
 */
export interface ApplySpecResult {
  content: string;
  applied_count: number;
  skipped: Array<{ target: string; reason: string }>;
}

export interface ApplyDeltaResult {
  spec?: ApplySpecResult;
  contract?: ApplySectionResult<ContractSchemaMeta>;
  rules?: ApplySectionResult<DeclarativeRule>;
  /** 是否落盘 */
  written: boolean;
  /** 写入的文件清单（绝对路径） */
  written_files: string[];
}
