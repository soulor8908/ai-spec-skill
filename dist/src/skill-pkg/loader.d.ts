import type { SkillManifest, SkillLoadResult, LoadedSkill } from './types.js';
/**
 * 从目录加载单个 Skill 包。
 * 目录结构期望：
 *   <skill-dir>/
 *     skill.yaml
 *     rules/*.yaml
 *     templates/*.hbs
 *     roles/*.md
 *     adapters/<type>/<id>/...
 *
 * @param skillDir skill 目录绝对路径
 * @returns 加载结果（ok=false 时 errors 含错误清单）
 */
export declare function loadSkill(skillDir: string): SkillLoadResult;
/**
 * 完整加载 Skill（manifest + 展开产物文件清单）。
 */
export declare function loadSkillFull(skillDir: string): {
    loaded?: LoadedSkill;
    errors: string[];
    warnings: string[];
};
/**
 * 扫描某个根目录下所有 skill 子目录，返回加载成功的清单。
 * 例如 discoverSkills('/workspace/skill/skills') 会扫描所有子目录。
 *
 * @param rootDir 含多个 skill 子目录的根目录
 * @returns LoadedSkill 数组（加载失败的会被跳过，warning 收集到 logs）
 */
export declare function discoverSkills(rootDir: string): {
    skills: LoadedSkill[];
    logs: string[];
};
/**
 * 默认内置 skills 根目录（skills/）。
 */
export declare function defaultBuiltinSkillsDir(): string;
export type { SkillManifest, LoadedSkill };
//# sourceMappingURL=loader.d.ts.map