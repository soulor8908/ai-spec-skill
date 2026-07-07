export interface DeclarativeRule {
    id: string;
    title: string;
    category?: 'ai-behavior' | 'architecture' | 'coding' | 'security' | 'meta';
    severity: 'error' | 'warning' | 'info';
    applies_to: {
        file_patterns: string[];
        stacks?: string[];
        min_confidence?: number;
    };
    check: {
        kind: 'regex' | 'ast' | 'import-graph' | 'structure' | 'manual';
        expr?: string;
        negative?: boolean;
        plugin_required?: boolean;
        exempt_marker?: string;
        manual_checker?: string;
    };
    fix_hint?: string;
    rationale_ref?: string;
    /** 来源文件路径（用于报错定位） */
    _source_file?: string;
}
export interface LoadResult {
    rules: DeclarativeRule[];
    errors: string[];
    warnings: string[];
}
/**
 * 加载目录下所有声明式规则文件（YAML / JSON）。
 *
 * @param rulesDir 规则目录，如 'skill/kernel/rules'
 * @returns 规则清单 + 加载错误
 */
export declare function loadRules(rulesDir: string): LoadResult;
//# sourceMappingURL=loader.d.ts.map