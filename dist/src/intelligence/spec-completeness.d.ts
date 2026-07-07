export interface SectionScore {
    section_id: string;
    found: boolean;
    field_coverage: number;
    score: number;
    missing_fields: string[];
}
export interface SpecScoreResult {
    /** 总分（0-100） */
    total_score: number;
    /** 各章节得分 */
    sections: SectionScore[];
    /** 改进建议 */
    suggestions: string[];
    /** markdown 报告 */
    markdown_report: string;
}
/**
 * 评估 Spec 完整性。
 * @param specPath Tech-Spec markdown 文件路径
 */
export declare function scoreSpec(specPath: string): SpecScoreResult;
//# sourceMappingURL=spec-completeness.d.ts.map