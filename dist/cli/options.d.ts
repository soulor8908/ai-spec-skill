/**
 * 技术栈选项枚举（与 Phase 0 适配器 stack_id 对齐）。
 */
export declare const STACK_OPTIONS: {
    readonly backend: readonly [{
        readonly value: "fastify-ts";
        readonly label: "Fastify + TypeScript";
        readonly recommended: true;
    }, {
        readonly value: "express-ts";
        readonly label: "Express + TypeScript";
    }, {
        readonly value: "spring-boot";
        readonly label: "Spring Boot + Java";
    }, {
        readonly value: "fastapi";
        readonly label: "FastAPI + Python";
    }];
    readonly db: readonly [{
        readonly value: "postgresql";
        readonly label: "PostgreSQL";
        readonly recommended: true;
    }, {
        readonly value: "sqlite";
        readonly label: "SQLite (开发用)";
    }, {
        readonly value: "mysql";
        readonly label: "MySQL";
        readonly experimental: true;
    }, {
        readonly value: "mongodb";
        readonly label: "MongoDB";
        readonly experimental: true;
    }];
    readonly frontend: readonly [{
        readonly value: "react-vite";
        readonly label: "React + Vite";
        readonly recommended: true;
    }, {
        readonly value: "vue3-vite";
        readonly label: "Vue3 + Vite";
        readonly experimental: true;
    }, {
        readonly value: "angular";
        readonly label: "Angular";
        readonly experimental: true;
    }, {
        readonly value: "none";
        readonly label: "无前端";
    }];
    readonly contract: readonly [{
        readonly value: "zod";
        readonly label: "Zod (TS 栈默认)";
        readonly recommended: true;
    }, {
        readonly value: "pydantic";
        readonly label: "Pydantic (Python 栈默认)";
    }, {
        readonly value: "json-schema";
        readonly label: "JSON Schema (跨语言)";
    }];
    readonly auth: readonly [{
        readonly value: "jwt";
        readonly label: "JWT (自签发)";
        readonly recommended: true;
    }, {
        readonly value: "session";
        readonly label: "Session";
        readonly experimental: true;
    }, {
        readonly value: "oauth2";
        readonly label: "OAuth2/OIDC";
        readonly experimental: true;
    }, {
        readonly value: "none";
        readonly label: "无认证 (开发用)";
    }];
    readonly ci: readonly [{
        readonly value: "github-actions";
        readonly label: "GitHub Actions";
        readonly recommended: true;
    }, {
        readonly value: "gitlab-ci";
        readonly label: "GitLab CI";
        readonly experimental: true;
    }, {
        readonly value: "none";
        readonly label: "无 (手动)";
    }];
};
export type StackKey = keyof typeof STACK_OPTIONS;
export type StackSelection = {
    [K in StackKey]: string;
};
/**
 * 黄金组合（M1 里程碑）。
 * 任何偏离此组合的选型在 MVP 期标记为 experimental，会产生 warning 而非 error。
 */
export declare const GOLDEN_COMBO: StackSelection;
/**
 * 判断某个 stack 选项是否为 experimental。
 * experimental 适配器可能缺完整 files/，调用方应据此加显式确认。
 */
export declare function isExperimental(category: StackKey, value: string): boolean;
/**
 * 统计 stack 中 experimental 选项数量。
 */
export declare function countExperimental(stack: StackSelection): number;
/**
 * 完整生成选项（含项目元数据）。
 */
export interface GenerateOptions {
    /** 项目名（用作目录名 + package.json name） */
    project_name: string;
    /** 输出目录（默认 ./<project_name>） */
    out_dir: string;
    /** 技术栈选择 */
    stack: StackSelection;
    /** 是否跳过依赖安装 */
    no_deps: boolean;
    /** 是否跳过 git init */
    no_git: boolean;
    /** 是否使用默认值（非交互模式） */
    yes: boolean;
    /** 是否显示详细日志 */
    verbose: boolean;
}
/**
 * 校验选项合法性 + 推断默认值。
 * 不合法选项返回错误清单，调用方决定如何呈现。
 */
export declare function validateOptions(opts: Partial<GenerateOptions>): {
    errors: string[];
    warnings: string[];
    inferred: StackSelection;
};
//# sourceMappingURL=options.d.ts.map