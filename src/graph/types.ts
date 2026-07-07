// src/graph/types.ts —— ArtifactGraph 类型定义
// P2 产出：制品依赖图的节点与阻塞结构。

/**
 * 制品节点。
 * id = 制品标识；depends_on = 须先于本制品完成的其他制品 id。
 */
export interface ArtifactNode {
  id: string;
  /** 依赖的制品 ID 清单（须先完成） */
  depends_on?: string[];
  /** 可选：制品类型/描述（展示用） */
  kind?: string;
  /** 可选：是否可跳过（如 skipAnalyze 时跳过 arch-analysis） */
  skippable?: boolean;
}

/**
 * 被阻塞的制品映射：artifactId → 未满足的依赖清单。
 */
export interface BlockedArtifacts {
  [artifactId: string]: string[];
}

/**
 * 构建计划（拓扑分批，每批可并行）。
 * batch[i] 中的节点彼此无依赖关系，可并行执行；批次间须顺序执行。
 */
export interface BuildPlan {
  batches: string[][];
}
