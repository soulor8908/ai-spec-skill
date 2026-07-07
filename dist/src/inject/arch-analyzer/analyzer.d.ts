import type { ArchAnalysis } from './types.js';
import type { ProjectProfile } from '../detector/types.js';
/**
 * 分析项目架构。
 *
 * @param rootDir 项目根目录
 * @param profile 探测引擎输出的项目画像（用于选择语言特化策略）
 */
export declare function analyzeArchitecture(rootDir: string, profile: ProjectProfile): ArchAnalysis;
//# sourceMappingURL=analyzer.d.ts.map