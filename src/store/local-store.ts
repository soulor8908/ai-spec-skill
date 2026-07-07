// src/store/local-store.ts —— 基于文件系统的本地 Store 实现
// P2 产出：每个 store 对应一个本地目录（rootDir），规则/契约存放在
//   <rootDir>/.ai-spec/store/rules/      （*.yaml，每条规则一个文件）
//   <rootDir>/.ai-spec/store/contracts/  （*.meta.yaml，契约元模型）
//
// 同步语义（push 模型）：
//   source.syncRules(targetId) → 把 source 的规则推送到 target 目录
//   - 目标不存在同名规则 → 写入（pushed）
//   - 目标存在同名且内容相同 → 跳过（skipped）
//   - 目标存在同名但内容不同 → 不覆盖，记入 conflicts
//
// 与 OpenSpec Store 的差异：OpenSpec 同步 spec 文本，ai-spec 同步规则 + 契约（ai-spec 独有）。

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { load as parseYaml, dump as dumpYaml } from 'js-yaml';
import { loadRules } from '../engine/loader.js';
import type { DeclarativeRule } from '../engine/loader.js';
import type { ContractSchemaMeta } from '../spi/adapter.js';
import type { AiSpecStore, StoreConfig, StoreManager, StoreSnapshot, SyncResult } from './types.js';

/** store 内部存放规则与契约的子目录 */
const STORE_DIR = '.ai-spec/store';
const RULES_SUBDIR = 'rules';
const CONTRACTS_SUBDIR = 'contracts';

/**
 * 基于文件系统的本地 Store。
 * 通过 LocalStoreManager.createLocalStore() 创建， manager 引用用于解析目标 store。
 */
export class LocalStore implements AiSpecStore {
  readonly id: string;
  readonly rootDir: string;
  readonly remote?: string;
  private readonly manager: StoreManager;

  constructor(config: StoreConfig, manager: StoreManager) {
    this.id = config.id;
    this.rootDir = config.rootDir;
    this.remote = config.remote;
    this.manager = manager;
  }

  /** 本 store 的规则目录 */
  get rulesDir(): string {
    return join(this.rootDir, STORE_DIR, RULES_SUBDIR);
  }

  /** 本 store 的契约目录 */
  get contractsDir(): string {
    return join(this.rootDir, STORE_DIR, CONTRACTS_SUBDIR);
  }

  snapshot(): StoreSnapshot {
    return {
      storeId: this.id,
      rootDir: this.rootDir,
      rules: this.readRules(),
      contracts: this.readContracts(),
    };
  }

  async syncRules(targetStoreId: string): Promise<SyncResult> {
    const target = this.manager.get(targetStoreId);
    if (!target) {
      return errorResult(this.id, targetStoreId, 'rules', `目标 store 未注册：${targetStoreId}`);
    }
    if (!(target instanceof LocalStore)) {
      return errorResult(this.id, targetStoreId, 'rules', `目标 store 非 LocalStore，不支持文件同步`);
    }

    const sourceRules = this.readRules();
    const targetRules = new Map(target.readRules().map((r) => [r.id, r]));
    const result: SyncResult = {
      source_store: this.id,
      target_store: targetStoreId,
      kind: 'rules',
      pushed: [],
      skipped: [],
      conflicts: [],
      errors: [],
    };

    mkdirSync(target.rulesDir, { recursive: true });

    for (const rule of sourceRules) {
      const existing = targetRules.get(rule.id);
      const serialized = serializeRule(rule);
      if (!existing) {
        writeFileSync(join(target.rulesDir, `${rule.id}.yaml`), serialized, 'utf8');
        result.pushed.push(rule.id);
      } else if (serializeRule(existing) === serialized) {
        result.skipped.push(rule.id);
      } else {
        result.conflicts.push({
          id: rule.id,
          reason: `目标已存在不同版本的规则 ${rule.id}，未覆盖`,
        });
      }
    }
    return result;
  }

  async syncContracts(targetStoreId: string): Promise<SyncResult> {
    const target = this.manager.get(targetStoreId);
    if (!target) {
      return errorResult(this.id, targetStoreId, 'contracts', `目标 store 未注册：${targetStoreId}`);
    }
    if (!(target instanceof LocalStore)) {
      return errorResult(this.id, targetStoreId, 'contracts', `目标 store 非 LocalStore，不支持文件同步`);
    }

    const sourceContracts = this.readContracts();
    const targetContracts = new Map(target.readContracts().map((c) => [c.name, c]));
    const result: SyncResult = {
      source_store: this.id,
      target_store: targetStoreId,
      kind: 'contracts',
      pushed: [],
      skipped: [],
      conflicts: [],
      errors: [],
    };

    mkdirSync(target.contractsDir, { recursive: true });

    for (const contract of sourceContracts) {
      const existing = targetContracts.get(contract.name);
      const serialized = serializeContract(contract);
      if (!existing) {
        writeFileSync(join(target.contractsDir, `${contract.name}.meta.yaml`), serialized, 'utf8');
        result.pushed.push(contract.name);
      } else if (serializeContract(existing) === serialized) {
        result.skipped.push(contract.name);
      } else {
        result.conflicts.push({
          id: contract.name,
          reason: `目标已存在不同版本的契约 ${contract.name}，未覆盖`,
        });
      }
    }
    return result;
  }

  /** 读取本 store 的所有规则（目录不存在返回空数组） */
  private readRules(): DeclarativeRule[] {
    if (!existsSync(this.rulesDir)) return [];
    const { rules, errors } = loadRules(this.rulesDir);
    if (errors.length > 0) {
      // 加载错误不抛出，仅记录到 stderr（避免 sync 中断）
      for (const e of errors) console.error(`[store:${this.id}] 规则加载警告：${e}`);
    }
    return rules;
  }

  /** 读取本 store 的所有契约元模型（目录不存在返回空数组） */
  private readContracts(): ContractSchemaMeta[] {
    if (!existsSync(this.contractsDir)) return [];
    const contracts: ContractSchemaMeta[] = [];
    for (const file of readdirSync(this.contractsDir)) {
      if (!file.endsWith('.meta.yaml') && !file.endsWith('.meta.yml')) continue;
      try {
        const parsed = parseYaml(
          readFileSync(join(this.contractsDir, file), 'utf8'),
        ) as Record<string, unknown>;
        // 兼容两种格式：{ schemas: [...] } 或单个 schema 对象
        const schemas = parsed['schemas'];
        if (Array.isArray(schemas)) {
          contracts.push(...(schemas as ContractSchemaMeta[]));
        } else if (parsed && typeof parsed === 'object' && typeof parsed['name'] === 'string') {
          contracts.push(parsed as unknown as ContractSchemaMeta);
        }
      } catch (e) {
        console.error(`[store:${this.id}] 契约加载失败 ${file}：${(e as Error).message}`);
      }
    }
    return contracts;
  }
}

/**
 * 本地 Store 管理器：维护 store 注册表，创建 LocalStore 时注入自身引用。
 */
export class LocalStoreManager implements StoreManager {
  private readonly stores = new Map<string, AiSpecStore>();

  register(store: AiSpecStore): void {
    this.stores.set(store.id, store);
  }

  get(id: string): AiSpecStore | undefined {
    return this.stores.get(id);
  }

  list(): AiSpecStore[] {
    return [...this.stores.values()];
  }

  createLocalStore(config: StoreConfig): AiSpecStore {
    const store = new LocalStore(config, this);
    this.register(store);
    return store;
  }
}

// ─── 序列化辅助 ───

/** 把单条规则序列化为 YAML（{ rules: [...] } 格式，与 loadRules 期望一致） */
function serializeRule(rule: DeclarativeRule): string {
  // 剔除内部字段，保证序列化稳定
  const { _source_file, ...rest } = rule;
  return dumpYaml({ rules: [rest] }, { sortKeys: false, lineWidth: 120 });
}

/** 把单个契约元模型序列化为 .meta.yaml 格式（{ schemas: [...] }） */
function serializeContract(contract: ContractSchemaMeta): string {
  return dumpYaml({ schemas: [contract] }, { sortKeys: false, lineWidth: 120 });
}

function errorResult(
  source: string,
  target: string,
  kind: 'rules' | 'contracts',
  message: string,
): SyncResult {
  return {
    source_store: source,
    target_store: target,
    kind,
    pushed: [],
    skipped: [],
    conflicts: [],
    errors: [message],
  };
}
