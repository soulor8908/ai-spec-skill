/**
 * 探测信号：单个文件 / 配置项提供的技术栈线索。
 * 多信号融合后形成 ProjectProfile。
 */
export interface DetectSignal {
    /** 信号来源文件相对路径 */
    source: string;
    /** 信号类型 */
    kind: 'manifest' | 'config' | 'source-pattern' | 'import' | 'lockfile';
    /** 探测到的栈键值（如 'spring-boot' / 'fastify' / 'postgresql'） */
    detected: string;
    /** 单信号置信度 0-1（手写注解 = 1.0，推断 = 0.5-0.8） */
    confidence: number;
    /** 推断出的元数据（版本号 / 包名等） */
    meta?: Record<string, string>;
}
/**
 * 项目画像：探测引擎的最终输出。
 * 用于驱动后续适配器选择 + 改造计划生成。
 */
export interface ProjectProfile {
    /** 项目根目录（绝对路径） */
    root_dir: string;
    /** 探测时间戳 ISO */
    detected_at: string;
    /** 主语言（按文件数 + 显式声明融合） */
    language: LanguageId;
    /** 语言版本（如 "TypeScript 5.4" / "Java 17" / "Python 3.12"） */
    language_version?: string;
    /** 包管理器 */
    package_manager?: PackageManagerId;
    /** 构建工具 */
    build_tool?: BuildToolId;
    /** 后端框架 */
    backend?: StackDetection;
    /** 前端框架 */
    frontend?: StackDetection;
    /** 数据库 */
    db?: StackDetection;
    /** ORM */
    orm?: StackDetection;
    /** 测试框架 */
    test_runner?: StackDetection;
    /** CI 平台 */
    ci?: StackDetection;
    /** 认证方案 */
    auth?: StackDetection;
    /** 整体置信度（0-1，所有信号加权平均） */
    overall_confidence: number;
    /** 全部信号（用于审计 + 人工 review） */
    signals: DetectSignal[];
    /** 探测警告（缺关键文件 / 多框架共存 / 版本不匹配等） */
    warnings: string[];
}
export type LanguageId = 'typescript' | 'javascript' | 'java' | 'python' | 'go' | 'rust' | 'unknown';
export type PackageManagerId = 'npm' | 'pnpm' | 'yarn' | 'maven' | 'gradle' | 'pip' | 'poetry' | 'go-mod' | 'cargo';
export type BuildToolId = 'tsc' | 'vite' | 'webpack' | 'esbuild' | 'maven' | 'gradle' | 'setuptools' | 'poetry' | 'go-build' | 'cargo';
export interface StackDetection {
    /** 栈 ID（与 adapters/<type>/<id> 对齐） */
    id: string;
    /** 显示名 */
    label: string;
    /** 版本（如 "4.27"） */
    version?: string;
    /** 置信度 0-1 */
    confidence: number;
    /** 信号来源（哪些文件支持此推断） */
    evidence: string[];
}
//# sourceMappingURL=types.d.ts.map