// cli/inject-command.ts —— ai-spec inject 子命令
//
// P1.5 重构：通过 InjectPipeline + onStage 回调实现交互日志，
// 不再重复 5 阶段编排逻辑（DRY：编排逻辑唯一在 InjectPipeline）。
//
// 用法：
//   ai-spec inject                # 默认 dry-run，只输出计划
//   ai-spec inject --apply        # 直接执行（安全网已保障）
//   ai-spec inject --apply --no-safety-net  # 跳过安全网
//   ai-spec inject --severity advisory  # 指定默认级别
//   ai-spec rollback              # 回滚最近一次注入

import { Command } from 'commander';
import { InjectPipeline } from '../src/inject/index.js';
import type { InjectStage, StageCallback, SeverityLevel } from '../src/inject/index.js';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from './log.js';

export function registerInjectCommand(program: Command): void {
  const inject = program
    .command('inject')
    .description('对既有项目注入 spec-first 基础设施（默认 dry-run，--apply 才执行）')
    .option('--apply', '确认执行（默认 dry-run，加此选项才写入）', false)
    .option('--force [deprecated]', '（已废弃）--apply 现直接执行，本选项为 no-op 兼容旧脚本', false)
    .option('--dry-run', '显式 dry-run（默认行为，无须指定）', false)
    .option('--severity <level>', '默认级别 (advisory|warning|blocking)', 'advisory')
    .option('--no-safety-net', '跳过测试安全网', false)
    .option('--no-analyze', '跳过架构分析', false)
    .option('--no-reverse', '跳过 API 逆向', false)
    .action(async (cmdOpts: Record<string, unknown>) => {
      await runInject(cmdOpts);
    });

  program
    .command('gate-up <ruleId:level>')
    .description('升级规则级别（advisory → warning → blocking），如 ARCH-001:warning')
    .action(async (arg: string) => {
      await runGateUp(arg);
    });

  program
    .command('rollback')
    .description('回滚最近一次 inject')
    .action(async () => {
      await runRollback();
    });
}

/** onStage 回调：把 InjectPipeline 阶段事件映射为交互日志（P1.5 DRY） */
function makeStageLogger(rootDir: string): StageCallback {
  const stageLabels: Record<InjectStage, string> = {
    'detect': '探测项目技术栈',
    'analyze': '分析架构分层',
    'reverse': '逆向生成 API 契约',
    'safety-baseline': '捕获测试 baseline',
    'plan': '生成注入计划',
    'execute': '执行注入',
    'safety-after': '对比测试 after',
  };
  return (stage, status, detail) => {
    const label = stageLabels[stage];
    if (status === 'start') {
      logger.startStep(label);
    } else if (status === 'done') {
      logger.endStep(detail ? `${label} (${detail})` : label, true);
    } else {
      logger.endStep(label, false);
      if (detail) logger.warn(detail);
    }
  };
}

async function runInject(cmdOpts: Record<string, unknown>): Promise<void> {
  const rootDir = process.cwd();
  const apply = cmdOpts.apply === true;
  const force = cmdOpts.force === true;
  const noSafetyNet = cmdOpts.safetyNet === false;
  const noAnalyze = cmdOpts.analyze === false;
  const noReverse = cmdOpts.reverse === false;
  const severity = (cmdOpts.severity as SeverityLevel) ?? 'advisory';

  if (force) {
    logger.warn('--force 已废弃：--apply 现直接执行，本选项为 no-op，后续版本将移除');
  }

  logger.banner();
  logger.info(`目标目录：${rootDir}`);
  logger.info(`模式：${apply ? '执行（写入 + 备份' + (noSafetyNet ? '，无安全网' : '') + '）' : 'dry-run（仅计划，--apply 才执行）'}`);

  // P1.5：通过 InjectPipeline 统一编排，onStage 回调接入交互日志
  const pipe = new InjectPipeline();
  const result = await pipe.run({
    rootDir,
    apply,
    severity,
    skipSafetyNet: noSafetyNet,
    skipAnalyze: noAnalyze,
    skipReverse: noReverse,
    onStage: makeStageLogger(rootDir),
  });

  // 探测画像详情日志（detect 阶段已 done，此处补 profile 细节）
  const profile = result.profile;
  if (profile.backend) logger.info(`后端：${profile.backend.label} (置信度 ${profile.backend.confidence})`);
  if (profile.frontend) logger.info(`前端：${profile.frontend.label}`);
  if (profile.db) logger.info(`数据库：${profile.db.label}`);
  if (profile.orm) logger.info(`ORM：${profile.orm.label}`);
  if (profile.test_runner) logger.info(`测试：${profile.test_runner.label}`);
  if (profile.ci) logger.info(`CI：${profile.ci.label}`);
  if (profile.warnings.length > 0) {
    for (const w of profile.warnings) logger.warn(w);
  }

  // 写入中间产物（架构报告 / API 契约 / 注入计划）
  const aiSpecDir = join(rootDir, '.ai-spec');
  if (!existsSync(aiSpecDir)) mkdirSync(aiSpecDir, { recursive: true });

  if (result.architecture) {
    writeFileSync(join(aiSpecDir, 'architecture-report.md'), result.architecture.markdown_report);
    writeFileSync(join(aiSpecDir, 'architecture-report.json'), JSON.stringify(result.architecture, null, 2) + '\n');
    if (result.architecture.violations.length > 0) {
      for (const v of result.architecture.violations.slice(0, 5)) {
        logger.warn(`${v.kind}: ${v.message}`);
      }
      if (result.architecture.violations.length > 5) {
        logger.warn(`... 还有 ${result.architecture.violations.length - 5} 个违规`);
      }
    }
  }

  if (result.api_contract && result.api_contract.endpoints.length > 0) {
    writeFileSync(join(aiSpecDir, 'openapi.json'), JSON.stringify(result.api_contract.openapi, null, 2) + '\n');
    writeFileSync(join(aiSpecDir, 'api-contract-report.md'), result.api_contract.markdown_report);
  }
  if (result.api_contract && result.api_contract.warnings.length > 0) {
    for (const w of result.api_contract.warnings) logger.warn(w);
  }

  writeFileSync(join(aiSpecDir, 'inject-plan.md'), result.plan.markdown);

  // 安全网失败详情
  if (result.safety_report && result.safety_report.new_failures.length > 0) {
    for (const f of result.safety_report.new_failures) logger.error(f);
  }

  logger.blank();
  if (apply) {
    logger.success('注入完成！');
    logger.info(`计划：${aiSpecDir}/inject-plan.md`);
    logger.info(`回滚：ai-spec rollback`);
  } else {
    logger.success('dry-run 计划已生成');
    logger.info(`查看：${aiSpecDir}/inject-plan.md`);
    logger.info(`执行：ai-spec inject --apply`);
    logger.info(`跳过安全网：ai-spec inject --apply --no-safety-net`);
  }
}

async function runGateUp(arg: string): Promise<void> {
  const rootDir = process.cwd();
  const [ruleId, levelStr] = arg.split(':');
  if (!ruleId || !levelStr) {
    logger.error('参数格式：<ruleId>:<level>，如 ARCH-001:warning');
    process.exit(1);
  }
  const level = levelStr as SeverityLevel;
  if (!['advisory', 'warning', 'blocking'].includes(level)) {
    logger.error(`级别不合法：${level}（可选 advisory|warning|blocking）`);
    process.exit(1);
  }
  try {
    const pipe = new InjectPipeline();
    const result = pipe.gateUp(rootDir, ruleId, level);
    logger.success(`规则 ${ruleId} 升级：${result.old_level} → ${result.new_level}`);
    logger.info(`文件：${result.rule_file}`);
  } catch (e) {
    logger.error(`升级失败：${(e as Error).message}`);
    process.exit(1);
  }
}

async function runRollback(): Promise<void> {
  const rootDir = process.cwd();
  try {
    const pipe = new InjectPipeline();
    const result = await pipe.rollback(rootDir);
    logger.success(`回滚完成：${result.rolled_back} 文件已恢复`);
    logger.info(`备份目录：${result.backup_dir}`);
  } catch (e) {
    logger.error(`回滚失败：${(e as Error).message}`);
    process.exit(1);
  }
}
