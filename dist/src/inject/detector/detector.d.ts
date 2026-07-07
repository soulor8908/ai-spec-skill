import type { ProjectProfile } from './types.js';
/**
 * 探测项目根目录，输出项目画像。
 *
 * @param rootDir 项目根目录（绝对路径）
 * @returns 项目画像
 */
export declare function detectProject(rootDir: string): ProjectProfile;
/**
 * 探测并把画像写到 `<rootDir>/.ai-spec/project-profile.json`。
 * 返回画像 + 写入路径。
 */
export declare function detectAndWriteProfile(rootDir: string): {
    profile: ProjectProfile;
    written_to: string;
};
//# sourceMappingURL=detector.d.ts.map