// src/inject/index.ts —— InjectPipeline 聚合类
//
// 把 detector → analyzer → reverser → injector → safety-net 五阶段串成可编程管线。
// CLI（cli/inject-command.ts）与本类共享底层函数，差异仅在入口（CLI 做交互日志，
// 本类做结构化返回）。
//
// 用法：
//   import { InjectPipeline } from '@ai-spec/skill';
//   const pipe = new InjectPipeline();
//   const result = await pipe.run({ rootDir: '/path/to/project', apply: true });
//   if (result.safetyReport?.new_failures.length) { ... }
//   await pipe.rollback('/path/to/project');
import { detectProject, detectAndWriteProfile } from './detector/detector.js';
import { analyzeArchitecture } from './arch-analyzer/analyzer.js';
import { reverseApi } from './contract-reverser/reverser.js';
import { planInjection, executeInjection, rollbackInjection, gateUp, } from './rule-injector/injector.js';
import { captureBaseline, compareAfter, loadBaseline } from './safety-net/runner.js';
/**
 * 注入管线聚合类。
 *
 * 串联五阶段：探测 → 架构分析 → API 逆向 → 注入计划/执行 → 安全网对比。
 * 每阶段可独立跳过，dry-run 模式只生成计划不写入。
 */
export class InjectPipeline {
    /**
     * 运行完整注入管线。
     */
    async run(opts) {
        const rootDir = opts.rootDir;
        const apply = opts.apply ?? false;
        const severity = opts.severity ?? 'advisory';
        // 1. 探测
        const { profile, written_to } = detectAndWriteProfile(rootDir);
        // 2. 架构分析
        let architecture;
        if (!opts.skipAnalyze) {
            architecture = analyzeArchitecture(rootDir, profile);
        }
        // 3. API 逆向
        let api_contract;
        if (!opts.skipReverse) {
            api_contract = reverseApi(rootDir, profile);
        }
        // 4. 安全网 baseline（注入前，仅 apply 模式）
        let baseline;
        if (!opts.skipSafetyNet && apply) {
            baseline = loadBaseline(rootDir) ?? captureBaseline(rootDir, profile);
        }
        // 5. 注入计划
        const config = {
            out_dir: '.ai-spec',
            default_level: severity,
            overrides: {},
            dry_run: !apply,
        };
        const plan = planInjection(rootDir, profile, config);
        // 6. 执行（仅 apply 模式）
        let execution;
        let safety_report;
        if (apply) {
            execution = executeInjection(rootDir, plan);
            // 7. 安全网 after + 对比
            if (!opts.skipSafetyNet && baseline) {
                safety_report = compareAfter(rootDir, profile, baseline);
            }
        }
        return {
            profile,
            profile_written_to: written_to,
            architecture,
            api_contract,
            plan,
            execution,
            safety_report,
        };
    }
    /**
     * 回滚最近一次注入。
     */
    async rollback(rootDir) {
        return rollbackInjection(rootDir);
    }
    /**
     * 升级规则级别（advisory → warning → blocking）。
     */
    gateUp(rootDir, ruleId, level) {
        return gateUp(rootDir, ruleId, level);
    }
}
// 透传底层函数，供高级用户直接调用
export { detectProject, detectAndWriteProfile, analyzeArchitecture, reverseApi, planInjection, executeInjection, rollbackInjection, gateUp, captureBaseline, compareAfter, loadBaseline, };
//# sourceMappingURL=index.js.map