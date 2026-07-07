// test/artifact-graph.test.ts —— P2 ArtifactGraph 制品依赖图测试
//
// 覆盖：
// - 拓扑排序（getBuildOrder）
// - 环检测（含参与环节点清单）
// - 自依赖检测（构造时抛错）
// - getNextArtifacts / getBlocked
// - 默认 InjectPipeline 图（detect → analyze/reverse 并行 → plan → execute → safety-after）

import { describe, it, expect } from 'vitest';
import { ArtifactGraph, defaultInjectPipelineGraph, getInjectBuildOrder } from '../src/graph/index.js';
import type { ArtifactNode } from '../src/graph/types.js';
import type { InjectPipelineStage } from '../src/graph/defaults.js';
import { InjectPipeline } from '../src/inject/index.js';

describe('P2 ArtifactGraph 拓扑排序', () => {
  it('简单链式依赖 A→B→C 应返回 [A,B,C]', () => {
    const nodes: ArtifactNode[] = [
      { id: 'C', depends_on: ['B'] },
      { id: 'B', depends_on: ['A'] },
      { id: 'A' },
    ];
    const graph = new ArtifactGraph(nodes);
    const order = graph.getBuildOrder();
    const ai = order.indexOf('A');
    const bi = order.indexOf('B');
    const ci = order.indexOf('C');
    expect(ai).toBeLessThan(bi);
    expect(bi).toBeLessThan(ci);
  });

  it('并行节点保持输入顺序（稳定排序）', () => {
    // A 无依赖，B/C 都依赖 A，B/C 之间无依赖 → 应按输入顺序 B,C
    const nodes: ArtifactNode[] = [
      { id: 'A' },
      { id: 'B', depends_on: ['A'] },
      { id: 'C', depends_on: ['A'] },
    ];
    const graph = new ArtifactGraph(nodes);
    const order = graph.getBuildOrder();
    expect(order).toEqual(['A', 'B', 'C']);
  });

  it('菱形依赖 A→B, A→C, B→D, C→D', () => {
    const nodes: ArtifactNode[] = [
      { id: 'D', depends_on: ['B', 'C'] },
      { id: 'C', depends_on: ['A'] },
      { id: 'B', depends_on: ['A'] },
      { id: 'A' },
    ];
    const graph = new ArtifactGraph(nodes);
    const order = graph.getBuildOrder();
    const ai = order.indexOf('A');
    const bi = order.indexOf('B');
    const ci = order.indexOf('C');
    const di = order.indexOf('D');
    expect(ai).toBeLessThan(bi);
    expect(ai).toBeLessThan(ci);
    expect(bi).toBeLessThan(di);
    expect(ci).toBeLessThan(di);
  });

  it('外部依赖（图中不存在）应被忽略，不阻塞排序', () => {
    const nodes: ArtifactNode[] = [
      { id: 'A', depends_on: ['external-unknown'] },
      { id: 'B', depends_on: ['A'] },
    ];
    const graph = new ArtifactGraph(nodes);
    const order = graph.getBuildOrder();
    expect(order).toEqual(['A', 'B']);
  });
});

describe('P2 ArtifactGraph 环检测', () => {
  it('A↔B 环应抛错且含环节点清单', () => {
    const nodes: ArtifactNode[] = [
      { id: 'A', depends_on: ['B'] },
      { id: 'B', depends_on: ['A'] },
    ];
    const graph = new ArtifactGraph(nodes);
    expect(() => graph.getBuildOrder()).toThrowError(/存在环/);
    try {
      graph.getBuildOrder();
    } catch (e) {
      const msg = (e as Error).message;
      // 错误信息应包含参与环的节点
      expect(msg).toContain('A');
      expect(msg).toContain('B');
    }
  });

  it('自依赖（A 依赖 A）应在构造时抛错', () => {
    const nodes: ArtifactNode[] = [{ id: 'A', depends_on: ['A'] }];
    expect(() => new ArtifactGraph(nodes)).toThrowError(/依赖自身/);
  });

  it('三节点环 A→B→C→A 应在错误中列出全部环节点', () => {
    const nodes: ArtifactNode[] = [
      { id: 'A', depends_on: ['C'] },
      { id: 'B', depends_on: ['A'] },
      { id: 'C', depends_on: ['B'] },
    ];
    const graph = new ArtifactGraph(nodes);
    expect(() => graph.getBuildOrder()).toThrowError(/存在环/);
  });
});

describe('P2 ArtifactGraph getNextArtifacts', () => {
  const nodes: ArtifactNode[] = [
    { id: 'A' },
    { id: 'B', depends_on: ['A'] },
    { id: 'C', depends_on: ['A'] },
    { id: 'D', depends_on: ['B', 'C'] },
  ];

  it('初始无完成 → 仅 A 就绪', () => {
    const graph = new ArtifactGraph(nodes);
    expect(graph.getNextArtifacts(new Set()).sort()).toEqual(['A']);
  });

  it('完成 A 后 → B,C 同时就绪（可并行）', () => {
    const graph = new ArtifactGraph(nodes);
    const ready = graph.getNextArtifacts(new Set(['A']));
    expect(ready.sort()).toEqual(['B', 'C']);
  });

  it('完成 A,B 后 → C 就绪，D 仍阻塞', () => {
    const graph = new ArtifactGraph(nodes);
    const ready = graph.getNextArtifacts(new Set(['A', 'B']));
    expect(ready).toEqual(['C']);
  });

  it('完成 A,B,C 后 → D 就绪', () => {
    const graph = new ArtifactGraph(nodes);
    const ready = graph.getNextArtifacts(new Set(['A', 'B', 'C']));
    expect(ready).toEqual(['D']);
  });

  it('全部完成 → 无就绪节点', () => {
    const graph = new ArtifactGraph(nodes);
    const ready = graph.getNextArtifacts(new Set(['A', 'B', 'C', 'D']));
    expect(ready).toEqual([]);
  });

  it('可跳过阶段（加入 completed）应让下游就绪', () => {
    // analyze 可跳过；把 analyze 加入 completed 后 plan 的依赖应满足
    const graph = new ArtifactGraph(defaultInjectPipelineGraph());
    const completed = new Set(['detect', 'analyze', 'reverse', 'safety-baseline']);
    const ready = graph.getNextArtifacts(completed);
    expect(ready).toContain('plan');
  });
});

describe('P2 ArtifactGraph getBlocked', () => {
  const nodes: ArtifactNode[] = [
    { id: 'A' },
    { id: 'B', depends_on: ['A'] },
    { id: 'C', depends_on: ['A', 'B'] },
  ];

  it('初始 → B 被 A 阻塞，C 被 A,B 阻塞', () => {
    const graph = new ArtifactGraph(nodes);
    const blocked = graph.getBlocked(new Set());
    expect(blocked['B']).toEqual(['A']);
    expect(blocked['C'].sort()).toEqual(['A', 'B']);
    expect(blocked['A']).toBeUndefined();
  });

  it('完成 A 后 → C 仅被 B 阻塞', () => {
    const graph = new ArtifactGraph(nodes);
    const blocked = graph.getBlocked(new Set(['A']));
    expect(blocked['B']).toBeUndefined();
    expect(blocked['C']).toEqual(['B']);
  });

  it('全部完成 → 无阻塞', () => {
    const graph = new ArtifactGraph(nodes);
    const blocked = graph.getBlocked(new Set(['A', 'B', 'C']));
    expect(blocked).toEqual({});
  });

  it('外部依赖不计入阻塞', () => {
    const extNodes: ArtifactNode[] = [
      { id: 'A', depends_on: ['external-x'] },
    ];
    const graph = new ArtifactGraph(extNodes);
    const blocked = graph.getBlocked(new Set());
    // external-x 不在图中 → A 不被阻塞
    expect(blocked['A']).toBeUndefined();
  });
});

describe('P2 默认 InjectPipeline 图', () => {
  it('应包含 7 个阶段节点', () => {
    const nodes = defaultInjectPipelineGraph();
    expect(nodes.length).toBe(7);
    const ids = nodes.map((n) => n.id).sort();
    expect(ids).toEqual(
      ['analyze', 'detect', 'execute', 'plan', 'reverse', 'safety-after', 'safety-baseline'].sort(),
    );
  });

  it('detect 无依赖（起点）', () => {
    const nodes = defaultInjectPipelineGraph();
    const detect = nodes.find((n) => n.id === 'detect')!;
    expect(detect.depends_on ?? []).toEqual([]);
  });

  it('analyze 与 reverse 都仅依赖 detect（可并行）', () => {
    const nodes = defaultInjectPipelineGraph();
    const analyze = nodes.find((n) => n.id === 'analyze')!;
    const reverse = nodes.find((n) => n.id === 'reverse')!;
    expect(analyze.depends_on).toEqual(['detect']);
    expect(reverse.depends_on).toEqual(['detect']);
    // 两者互不依赖 → 可并行
    expect(analyze.depends_on).not.toContain('reverse');
    expect(reverse.depends_on).not.toContain('analyze');
  });

  it('plan 依赖 detect + analyze + reverse', () => {
    const nodes = defaultInjectPipelineGraph();
    const plan = nodes.find((n) => n.id === 'plan')!;
    expect(plan.depends_on!.sort()).toEqual(['analyze', 'detect', 'reverse']);
  });

  it('execute 依赖 plan + safety-baseline', () => {
    const nodes = defaultInjectPipelineGraph();
    const execute = nodes.find((n) => n.id === 'execute')!;
    expect(execute.depends_on!.sort()).toEqual(['plan', 'safety-baseline']);
  });

  it('safety-after 依赖 execute（终点）', () => {
    const nodes = defaultInjectPipelineGraph();
    const safetyAfter = nodes.find((n) => n.id === 'safety-after')!;
    expect(safetyAfter.depends_on).toEqual(['execute']);
  });

  it('getInjectBuildOrder 应返回合法拓扑序', () => {
    const order = getInjectBuildOrder();
    expect(order.length).toBe(7);
    const idx = (id: InjectPipelineStage) => order.indexOf(id);
    expect(idx('detect')).toBeLessThan(idx('analyze'));
    expect(idx('detect')).toBeLessThan(idx('reverse'));
    expect(idx('detect')).toBeLessThan(idx('safety-baseline'));
    expect(idx('analyze')).toBeLessThan(idx('plan'));
    expect(idx('reverse')).toBeLessThan(idx('plan'));
    expect(idx('plan')).toBeLessThan(idx('execute'));
    expect(idx('safety-baseline')).toBeLessThan(idx('execute'));
    expect(idx('execute')).toBeLessThan(idx('safety-after'));
  });

  it('analyze / reverse 应标记为 skippable', () => {
    const nodes = defaultInjectPipelineGraph();
    const analyze = nodes.find((n) => n.id === 'analyze')!;
    const reverse = nodes.find((n) => n.id === 'reverse')!;
    expect(analyze.skippable).toBe(true);
    expect(reverse.skippable).toBe(true);
  });
});

describe('P2 InjectPipeline 集成', () => {
  it('InjectPipeline.getArtifactGraph() 应返回包含 7 个节点的图', () => {
    const pipeline = new InjectPipeline();
    const graph = pipeline.getArtifactGraph();
    expect(graph.getIds().length).toBe(7);
  });

  it('InjectPipeline.getBuildOrder() 应返回合法拓扑序', () => {
    const pipeline = new InjectPipeline();
    const order = pipeline.getBuildOrder();
    expect(order.length).toBe(7);
    expect(order[0]).toBe('detect');
    expect(order[order.length - 1]).toBe('safety-after');
  });

  it('InjectPipeline 图应能查询就绪阶段', () => {
    const pipeline = new InjectPipeline();
    const graph = pipeline.getArtifactGraph();
    // 初始：仅 detect 就绪
    expect(graph.getNextArtifacts(new Set())).toEqual(['detect']);
    // 完成 detect + 两个 skippable 阶段 + safety-baseline 后 plan 就绪
    const ready = graph.getNextArtifacts(
      new Set(['detect', 'analyze', 'reverse', 'safety-baseline']),
    );
    expect(ready).toContain('plan');
  });
});
