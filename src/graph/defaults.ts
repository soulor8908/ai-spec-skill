// src/graph/defaults.ts —— 默认 ArtifactGraph 预设
// P2 产出：提供与 InjectPipeline 五阶段对应的默认制品依赖图，
// 供 InjectPipeline 内部用拓扑序决定阶段执行顺序（取代硬编码线性流程）。
//
// 默认依赖关系（表达"架构分析可与 API 逆向并行，但都须先于注入计划"）：
//   detect               ← 无依赖（起点）
//   analyze              ← detect（可跳过）
//   reverse              ← detect（可跳过，与 analyze 无依赖 → 可并行）
//   safety-baseline      ← detect
//   plan                 ← detect, analyze, reverse
//   execute              ← plan, safety-baseline
//   safety-after         ← execute
//
// 跳过的阶段由调用方加入 completed 集合，依赖即视为满足。

import type { ArtifactNode } from './types.js';
import { ArtifactGraph } from './graph.js';

/** 阶段 ID（与 InjectPipeline 的 InjectStage 对齐，字符串保持一致） */
export type InjectPipelineStage =
  | 'detect'
  | 'analyze'
  | 'reverse'
  | 'safety-baseline'
  | 'plan'
  | 'execute'
  | 'safety-after';

/**
 * 返回 InjectPipeline 默认制品依赖图节点清单。
 * 调用方可据此 `new ArtifactGraph(defaultInjectPipelineGraph())`。
 */
export function defaultInjectPipelineGraph(): ArtifactNode[] {
  return [
    { id: 'detect', kind: 'profile' },
    { id: 'analyze', kind: 'architecture', depends_on: ['detect'], skippable: true },
    { id: 'reverse', kind: 'api_contract', depends_on: ['detect'], skippable: true },
    { id: 'safety-baseline', kind: 'baseline', depends_on: ['detect'] },
    {
      id: 'plan',
      kind: 'injection_plan',
      depends_on: ['detect', 'analyze', 'reverse'],
    },
    { id: 'execute', kind: 'write', depends_on: ['plan', 'safety-baseline'] },
    { id: 'safety-after', kind: 'compare', depends_on: ['execute'] },
  ];
}

/**
 * 便捷方法：返回默认 InjectPipeline 图的拓扑构建顺序。
 */
export function getInjectBuildOrder(): InjectPipelineStage[] {
  return new ArtifactGraph(defaultInjectPipelineGraph()).getBuildOrder() as InjectPipelineStage[];
}
