// src/graph/index.ts —— ArtifactGraph 模块聚合入口
// P2 产出：导出制品依赖图、类型、默认 InjectPipeline 图。
//
// 用法：
//   import { ArtifactGraph, defaultInjectPipelineGraph } from '@ai-spec/skill/graph';
//   const graph = new ArtifactGraph(defaultInjectPipelineGraph());
//   for (const id of graph.getBuildOrder()) { /* 按拓扑序执行阶段 */ }
//   const ready = graph.getNextArtifacts(new Set(['detect']));

export type { ArtifactNode, BlockedArtifacts, BuildPlan } from './types.js';
export { ArtifactGraph } from './graph.js';
export { defaultInjectPipelineGraph, getInjectBuildOrder } from './defaults.js';
