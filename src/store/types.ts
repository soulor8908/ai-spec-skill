// src/store/types.ts —— Store 跨仓库协作类型定义
// P2 产出：参考 OpenSpec 的 Store 模型，但增加规则同步能力（ai-spec 独有）。
//
// 设计：
// - 一个 AiSpecStore = 一个本地 Git 仓库（rootDir）+ 可选远端 URL
// - store 内部用 .ai-spec/store/{rules,contracts}/ 目录存放可同步的规则与契约
// - syncRules(targetStoreId) 把本 store 的规则推送到目标 store
// - syncContracts(targetStoreId) 把本 store 的契约推送到目标 store
// - 冲突（目标已存在同名但内容不同）不覆盖，记入 conflicts，由人工裁定

import type { DeclarativeRule } from '../engine/loader.js';
import type { ContractSchemaMeta } from '../spi/adapter.js';

/**
 * Store 配置（创建 LocalStore 时传入）。
 */
export interface StoreConfig {
  /** Store 唯一标识（如 'team-rules' / 'user-service'） */
  id: string;
  /** 本地 Git 仓库根目录（绝对路径） */
  rootDir: string;
  /** 远程仓库 URL（可选，用于 git pull/push 集成，MVP 仅记录） */
  remote?: string;
}

/**
 * 同步结果。
 */
export interface SyncResult {
  /** 同步方向：source store id → target store id */
  source_store: string;
  target_store: string;
  /** 同步种类 */
  kind: 'rules' | 'contracts';
  /** 成功推送的条目（规则 ID 或契约名） */
  pushed: string[];
  /** 跳过的条目（目标已存在且内容相同） */
  skipped: string[];
  /** 冲突条目（目标已存在但内容不同，未覆盖） */
  conflicts: Array<{ id: string; reason: string }>;
  /** 错误信息 */
  errors: string[];
}

/**
 * Store 读取快照：当前 store 持有的规则与契约。
 */
export interface StoreSnapshot {
  storeId: string;
  rootDir: string;
  rules: DeclarativeRule[];
  contracts: ContractSchemaMeta[];
}

/**
 * AiSpecStore 接口：跨仓库协作的抽象。
 * 与 OpenSpec Store 的差异：增加 syncRules（规则同步），ai-spec 独有。
 */
export interface AiSpecStore {
  /** Store 唯一标识 */
  id: string;
  /** 本地 Git 仓库根目录 */
  rootDir: string;
  /** 远程仓库 URL（可选） */
  remote?: string;

  /** 读取当前 store 的规则与契约快照 */
  snapshot(): StoreSnapshot;
  /** 把本 store 的规则同步到目标 store（ai-spec 独有） */
  syncRules(targetStoreId: string): Promise<SyncResult>;
  /** 把本 store 的契约同步到目标 store */
  syncContracts(targetStoreId: string): Promise<SyncResult>;
}

/**
 * Store 管理器：维护多个 store 的注册表，供 syncRules/syncContracts 解析目标。
 */
export interface StoreManager {
  /** 注册一个 store */
  register(store: AiSpecStore): void;
  /** 按 id 获取 store */
  get(id: string): AiSpecStore | undefined;
  /** 列出所有已注册 store */
  list(): AiSpecStore[];
  /** 创建并注册一个本地 store */
  createLocalStore(config: StoreConfig): AiSpecStore;
}
