import type { ProjectProfile } from '../detector/types.js';
import type { InjectionConfig, InjectionPlan, SeverityLevel } from './types.js';
/**
 * 生成注入计划（不写入）。
 * 这是 P2-5 的 dry-run 实现，P2-4 的执行入口。
 */
export declare function planInjection(rootDir: string, profile: ProjectProfile, config: InjectionConfig): InjectionPlan;
/**
 * 执行注入（写文件 + 备份）。
 */
export declare function executeInjection(rootDir: string, plan: InjectionPlan): {
    written: number;
    backups: string[];
};
/**
 * 回滚最近一次注入。
 */
export declare function rollbackInjection(rootDir: string): {
    rolled_back: number;
    backup_dir: string;
};
/**
 * 升级规则级别（advisory → warning → blocking）。
 */
export declare function gateUp(rootDir: string, ruleId: string, toLevel: SeverityLevel): {
    rule_file: string;
    old_level: SeverityLevel;
    new_level: SeverityLevel;
};
//# sourceMappingURL=injector.d.ts.map