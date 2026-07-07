// src/graph/graph.ts —— ArtifactGraph 制品依赖图
// P2 产出：用拓扑排序决定制品生成顺序，支持"哪些制品已就绪/被阻塞"查询。
//
// 解决 InjectPipeline 线性 5 阶段无法表达"契约 schema 须先于测试，
// 但架构分析可并行"的问题。InjectPipeline 内部可用 ArtifactGraph 决定阶段执行顺序，
// 取代硬编码线性流程。
//
// 算法：Kahn 拓扑排序（BFS），检测环并抛出含环节点清单的错误。

import type { ArtifactNode, BlockedArtifacts } from './types.js';

/**
 * 制品依赖图。
 *
 * 节点 = 制品（如 'contract-schema' / 'arch-analysis' / 'test'）；
 * 边 = depends_on（A depends_on B 表示 B 须先于 A 完成）。
 */
export class ArtifactGraph {
  private readonly nodes: Map<string, ArtifactNode>;

  constructor(nodes: ArtifactNode[]) {
    this.nodes = new Map(nodes.map((n) => [n.id, { ...n }]));
    this.validateSelfDeps();
  }

  /** 所有节点 ID */
  getIds(): string[] {
    return [...this.nodes.keys()];
  }

  /** 节点详情 */
  getNode(id: string): ArtifactNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * 拓扑排序：返回合法构建顺序（依赖在前）。
   * 同层无依赖关系的节点保持输入顺序（稳定排序）。
   * @throws 存在环时抛错，错误信息含参与环的节点
   */
  getBuildOrder(): string[] {
    const order: string[] = [];
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>(); // dep -> 依赖它的节点

    for (const id of this.nodes.keys()) {
      inDegree.set(id, 0);
      dependents.set(id, []);
    }
    for (const node of this.nodes.values()) {
      for (const dep of node.depends_on ?? []) {
        if (!this.nodes.has(dep)) continue; // 外部/未知依赖忽略（按需可改为抛错）
        dependents.get(dep)!.push(node.id);
        inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
      }
    }

    // 入度为 0 的节点按输入顺序入队（稳定）
    const queue: string[] = [...this.nodes.keys()].filter((id) => (inDegree.get(id) ?? 0) === 0);
    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);
      for (const dep of dependents.get(id) ?? []) {
        const d = (inDegree.get(dep) ?? 0) - 1;
        inDegree.set(dep, d);
        if (d === 0) queue.push(dep);
      }
    }

    if (order.length < this.nodes.size) {
      const cyclic = [...this.nodes.keys()].filter((id) => !order.includes(id));
      throw new Error(`ArtifactGraph 存在环，涉及节点：${cyclic.join(', ')}`);
    }
    return order;
  }

  /**
   * 已就绪制品：依赖已全部完成、且自身未完成的节点。
   */
  getNextArtifacts(completed: Set<string>): string[] {
    const ready: string[] = [];
    for (const node of this.nodes.values()) {
      if (completed.has(node.id)) continue;
      const deps = node.depends_on ?? [];
      if (deps.every((d) => completed.has(d) || !this.nodes.has(d))) {
        ready.push(node.id);
      }
    }
    return ready;
  }

  /**
   * 被阻塞制品：未完成且存在未满足的（图内）依赖。
   * 返回 { artifactId: [missing dep...] }。
   */
  getBlocked(completed: Set<string>): BlockedArtifacts {
    const blocked: BlockedArtifacts = {};
    for (const node of this.nodes.values()) {
      if (completed.has(node.id)) continue;
      const missing = (node.depends_on ?? []).filter(
        (d) => !completed.has(d) && this.nodes.has(d),
      );
      if (missing.length > 0) {
        blocked[node.id] = missing;
      }
    }
    return blocked;
  }

  /** 自依赖检测（节点依赖自身是明显错误） */
  private validateSelfDeps(): void {
    for (const node of this.nodes.values()) {
      for (const dep of node.depends_on ?? []) {
        if (dep === node.id) {
          throw new Error(`ArtifactGraph 节点 "${node.id}" 依赖自身`);
        }
      }
    }
  }
}
