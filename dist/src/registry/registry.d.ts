import type { LoadedSkill, InstalledSkill } from '../skill-pkg/types.js';
export interface RegistryListEntry {
    name: string;
    version: string;
    description: string;
    category: string;
    source: 'builtin' | 'local' | 'remote';
    installed_at?: string;
}
export interface SearchResult {
    query: string;
    matches: Array<{
        name: string;
        version: string;
        description: string;
        score: number;
    }>;
}
export declare class LocalRegistry {
    private readonly projectRoot;
    private readonly builtinDir;
    constructor(projectRoot: string, builtinDir?: string);
    /** 列出所有可用 skill：已安装 + 内置未安装 */
    list(): RegistryListEntry[];
    /** 关键词搜索 */
    search(keyword: string): SearchResult;
    /** 安装：从 builtin 复制到项目级 */
    add(name: string): {
        installed: InstalledSkill;
        warnings: string[];
    };
    /** 更新：重新从 builtin 同步 */
    update(name: string): {
        updated: InstalledSkill;
    };
    /** 卸载 */
    remove(name: string): {
        removed: boolean;
    };
    /** 获取已安装的某个 skill（LoadedSkill 形式） */
    getInstalled(name: string): LoadedSkill | undefined;
    /** 列出所有已安装的 LoadedSkill（供 composer 用） */
    listInstalledLoaded(): LoadedSkill[];
    private listBuiltin;
    private loadFromDir;
    private readInstalledIndex;
    private writeInstalledIndex;
}
//# sourceMappingURL=registry.d.ts.map