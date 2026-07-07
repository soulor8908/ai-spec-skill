// src/store/index.ts —— Store 跨仓库协作模块聚合入口
//
// 用法：
//   import { LocalStoreManager } from '@ai-spec/skill/store';
//   const mgr = new LocalStoreManager();
//   const source = mgr.createLocalStore({ id: 'team-rules', rootDir: '/repo/a' });
//   const target = mgr.createLocalStore({ id: 'user-service', rootDir: '/repo/b' });
//   await source.syncRules('user-service');  // 把 team-rules 推送到 user-service

export type {
  AiSpecStore,
  StoreConfig,
  StoreManager,
  StoreSnapshot,
  SyncResult,
} from './types.js';
export { LocalStore, LocalStoreManager } from './local-store.js';
