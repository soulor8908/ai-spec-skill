// inject/detector/detector.ts —— 项目探测主流程
// P2-1 产出：跑全部探测器 → 多信号融合 → 输出 ProjectProfile。
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_DETECTORS } from './detectors.js';
/**
 * 探测项目根目录，输出项目画像。
 *
 * @param rootDir 项目根目录（绝对路径）
 * @returns 项目画像
 */
export function detectProject(rootDir) {
    if (!existsSync(rootDir)) {
        throw new Error(`项目目录不存在：${rootDir}`);
    }
    // 1. 跑全部探测器收集信号
    const allSignals = [];
    for (const detector of ALL_DETECTORS) {
        try {
            const signals = detector.detect(rootDir);
            allSignals.push(...signals);
        }
        catch (e) {
            // 单探测器失败不影响其他（记录 warning 但不中断）
            // 不抛错，warning 在 profile 末尾追加
        }
    }
    // 2. 多信号融合 → 各栈项推断
    const warnings = [];
    const signalsByDetected = groupBy(allSignals, (s) => s.detected);
    // 3. 推断各栈项
    const language = inferLanguage(allSignals);
    const packageManager = inferPackageManager(allSignals);
    const buildTool = inferBuildTool(allSignals);
    const backend = inferStack(signalsByDetected, ['fastify-ts', 'express-ts', 'spring-boot', 'fastapi', 'flask', 'django']);
    const frontend = inferStack(signalsByDetected, ['react-vite', 'vue3-vite', 'angular']);
    const db = inferStack(signalsByDetected, ['postgresql', 'mysql', 'mongodb', 'sqlite']);
    const orm = inferStack(signalsByDetected, ['prisma', 'typeorm', 'sequelize', 'drizzle', 'spring-data-jpa', 'sqlalchemy']);
    const testRunner = inferStack(signalsByDetected, ['vitest', 'jest', 'junit', 'pytest']);
    const ci = inferStack(signalsByDetected, ['github-actions', 'gitlab-ci', 'circleci', 'jenkins']);
    const auth = inferAuth(signalsByDetected, allSignals);
    // 4. 警告检测
    if (!backend && !frontend) {
        warnings.push('未探测到任何后端 / 前端框架，可能不是 Web 项目');
    }
    if (backend && frontend && backend.confidence > 0.8 && frontend.confidence > 0.8 && language === 'unknown') {
        warnings.push('语言推断失败但前后端框架明确，可能存在混合语言项目');
    }
    // 5. 整体置信度：所有信号 confidence 加权平均（按 confidence 加权）
    const overallConfidence = allSignals.length === 0
        ? 0
        : allSignals.reduce((sum, s) => sum + s.confidence, 0) / allSignals.length;
    // 6. 语言版本推断
    const languageVersion = inferLanguageVersion(language, allSignals);
    return {
        root_dir: rootDir,
        detected_at: new Date().toISOString(),
        language,
        language_version: languageVersion,
        package_manager: packageManager,
        build_tool: buildTool,
        backend,
        frontend,
        db,
        orm,
        test_runner: testRunner,
        ci,
        auth,
        overall_confidence: round(overallConfidence, 2),
        signals: allSignals,
        warnings,
    };
}
/**
 * 探测并把画像写到 `<rootDir>/.ai-spec/project-profile.json`。
 * 返回画像 + 写入路径。
 */
export function detectAndWriteProfile(rootDir) {
    const profile = detectProject(rootDir);
    const outDir = join(rootDir, '.ai-spec');
    if (!existsSync(outDir))
        mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'project-profile.json');
    writeFileSync(outPath, JSON.stringify(profile, null, 2) + '\n');
    return { profile, written_to: outPath };
}
// ============ 推断函数 ============
function inferLanguage(signals) {
    const langSignals = signals.filter((s) => ['typescript', 'javascript', 'java', 'python', 'go', 'rust'].includes(s.detected));
    if (langSignals.length === 0)
        return 'unknown';
    // 按 confidence 排序，取最高
    const sorted = [...langSignals].sort((a, b) => b.confidence - a.confidence);
    return sorted[0].detected;
}
function inferLanguageVersion(language, signals) {
    if (language === 'typescript') {
        const ts = signals.find((s) => s.detected === 'typescript' && s.meta?.version);
        return ts ? `TypeScript ${stripCaret(ts.meta.version)}` : 'TypeScript (unknown version)';
    }
    if (language === 'java') {
        const sb = signals.find((s) => s.detected === 'spring-boot' && s.meta?.version);
        return sb ? `Java + Spring Boot ${stripCaret(sb.meta.version)}` : 'Java (unknown version)';
    }
    if (language === 'python') {
        const fa = signals.find((s) => s.detected === 'fastapi' && s.meta?.version);
        return fa ? `Python + FastAPI ${stripCaret(fa.meta.version)}` : 'Python (unknown version)';
    }
    return undefined;
}
function inferPackageManager(signals) {
    const candidates = ['maven', 'gradle', 'npm', 'pnpm', 'yarn', 'poetry', 'pip'];
    for (const pm of candidates) {
        if (signals.some((s) => s.detected === pm))
            return pm;
    }
    return undefined;
}
function inferBuildTool(signals) {
    const candidates = ['maven', 'gradle', 'vite', 'webpack', 'tsc', 'poetry', 'setuptools'];
    for (const bt of candidates) {
        if (signals.some((s) => s.detected === bt))
            return bt;
    }
    return undefined;
}
function inferStack(signalsByDetected, candidates) {
    let best;
    for (const id of candidates) {
        const sigs = signalsByDetected.get(id);
        if (!sigs || sigs.length === 0)
            continue;
        // 融合置信度：多信号加分（上限 1.0）
        const avg = sigs.reduce((sum, s) => sum + s.confidence, 0) / sigs.length;
        const boost = Math.min(0.1, (sigs.length - 1) * 0.05); // 多信号 +0.05/个，上限 0.1
        const confidence = Math.min(1.0, round(avg + boost, 2));
        const version = sigs.find((s) => s.meta?.version)?.meta?.version;
        const detection = {
            id,
            label: labelFor(id),
            version: version ? stripCaret(version) : undefined,
            confidence,
            evidence: sigs.map((s) => s.source),
        };
        if (!best || detection.confidence > best.confidence) {
            best = detection;
        }
    }
    return best;
}
function inferAuth(signalsByDetected, _allSignals) {
    // JWT / session 直接命中
    const candidates = ['jwt', 'session', 'oauth2', 'spring-security'];
    for (const id of candidates) {
        const sigs = signalsByDetected.get(id);
        if (sigs && sigs.length > 0) {
            return {
                id: id === 'spring-security' ? 'spring-security' : id,
                label: labelFor(id),
                confidence: sigs[0].confidence,
                evidence: sigs.map((s) => s.source),
            };
        }
    }
    return undefined;
}
function labelFor(id) {
    const labels = {
        'fastify-ts': 'Fastify + TypeScript',
        'express-ts': 'Express + TypeScript',
        'spring-boot': 'Spring Boot',
        fastapi: 'FastAPI',
        flask: 'Flask',
        django: 'Django',
        'react-vite': 'React + Vite',
        'vue3-vite': 'Vue3 + Vite',
        angular: 'Angular',
        postgresql: 'PostgreSQL',
        mysql: 'MySQL',
        mongodb: 'MongoDB',
        sqlite: 'SQLite',
        prisma: 'Prisma',
        typeorm: 'TypeORM',
        sequelize: 'Sequelize',
        drizzle: 'Drizzle',
        'spring-data-jpa': 'Spring Data JPA',
        sqlalchemy: 'SQLAlchemy',
        vitest: 'Vitest',
        jest: 'Jest',
        junit: 'JUnit',
        pytest: 'pytest',
        'github-actions': 'GitHub Actions',
        'gitlab-ci': 'GitLab CI',
        circleci: 'CircleCI',
        jenkins: 'Jenkins',
        jwt: 'JWT',
        session: 'Session',
        oauth2: 'OAuth2',
        'spring-security': 'Spring Security',
        typescript: 'TypeScript',
        javascript: 'JavaScript',
        java: 'Java',
        python: 'Python',
        go: 'Go',
        rust: 'Rust',
        npm: 'npm',
        pnpm: 'pnpm',
        yarn: 'yarn',
        maven: 'Maven',
        gradle: 'Gradle',
        poetry: 'Poetry',
        pip: 'pip',
        vite: 'Vite',
        webpack: 'webpack',
        tsc: 'tsc',
    };
    return labels[id] ?? id;
}
// ============ 工具函数 ============
function groupBy(arr, keyFn) {
    const map = new Map();
    for (const item of arr) {
        const key = keyFn(item);
        if (!map.has(key))
            map.set(key, []);
        map.get(key).push(item);
    }
    return map;
}
function round(n, decimals) {
    const factor = 10 ** decimals;
    return Math.round(n * factor) / factor;
}
function stripCaret(version) {
    return version.replace(/^[\^~>=<\s]+/, '').split(' ').pop() ?? version;
}
//# sourceMappingURL=detector.js.map