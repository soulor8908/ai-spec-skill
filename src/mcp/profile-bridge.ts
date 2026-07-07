// src/mcp/profile-bridge.ts —— 项目画像转换桥
// MCP 工具内部需要同时驱动 RuleEngine（用 SPI 版 ProjectProfile）和 InjectPipeline
// （用 inject 版 ProjectProfile）。本模块负责把 inject 版探测结果转换为 SPI 版，
// 让 MCP 的 check-rules 工具可复用 detectProject 的探测产物，避免重复探测。
//
// 字段映射：
//   inject.language            → spi.language
//   inject.backend?.id        → spi.backend_framework
//   inject.frontend?.id       → spi.frontend_framework
//   inject.db?.id             → spi.database
//   inject.orm?.id            → spi.orm
//   inject.test_runner?.id    → spi.test_runner
//   inject.ci?.id             → spi.ci_platform
//   inject.overall_confidence → spi.confidence
//   inject.signals            → spi.signals（字段名转换）

import type { ProjectProfile as SpiProfile } from '../spi/adapter.js';
import type { ProjectProfile as InjectProfile } from '../inject/detector/types.js';

/**
 * 把 inject 版 ProjectProfile 转换为 SPI 版（RuleEngine 可消费）。
 * contract_lib 无对应探测字段，置 null（RuleEngine 会按 stacks 过滤兜底）。
 */
export function toSpiProfile(profile: InjectProfile): SpiProfile {
  return {
    language: profile.language,
    backend_framework: profile.backend?.id ?? null,
    frontend_framework: profile.frontend?.id ?? null,
    database: profile.db?.id ?? null,
    orm: profile.orm?.id ?? null,
    // 探测器暂无 contract_lib 字段，置 null；RuleEngine 按规则 applies_to.stacks 兜底
    contract_lib: null,
    test_runner: profile.test_runner?.id ?? null,
    ci_platform: profile.ci?.id ?? null,
    confidence: profile.overall_confidence,
    signals: profile.signals.map((s) => ({
      path: s.source,
      matched: s.detected,
      weight: s.confidence,
    })),
  };
}
