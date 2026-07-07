import type { SkillManifest } from './types.js';
export interface SkillValidationResult {
    errors: string[];
    warnings: string[];
}
/**
 * 验证单个 Skill manifest 的内部一致性。
 * 跨 skill 的依赖/冲突验证在 composer 层做。
 */
export declare function validateSkillManifest(manifest: SkillManifest): SkillValidationResult;
//# sourceMappingURL=validator.d.ts.map