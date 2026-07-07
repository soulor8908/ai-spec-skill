# AI Spec Skill

> spec-first 工作流方法论的共享内核 + 可插拔适配器 + CLI 脚手架 + 注入管线。
>
> 从 [AIAdmin](https://github.com/soulor8908/AIAdmin) 仓库的 `skill/` 目录解耦为独立 npm 包 `@ai-spec/skill`。

## 安装

### 作为 npm 包消费（推荐）

```bash
# 从 GitHub 安装
npm install @ai-spec/skill@github:soulor8908/ai-spec-skill#main

# 或本地构建后 link
npm install
npm run build
npm link
```

### 编程式使用

```ts
import {
  RuleEngine,
  loadRules,
  InjectPipeline,
  BuiltinRegexPlugin,
  scoreSpec,
} from '@ai-spec/skill';

// 规则引擎
const engine = new RuleEngine({ rulesDir: './.ai-spec/rules' });
engine.registerPlugin(new BuiltinRegexPlugin());
const result = await engine.run({ rootDir: process.cwd() });

// 注入管线（改造既有项目）
const pipe = new InjectPipeline();
const report = await pipe.run({
  rootDir: '/path/to/existing/project',
  apply: true,           // 实际写入（默认 dry-run）
  skipSafetyNet: false,  // 跑测试安全网
});
if (report.safety_report?.new_failures.length) {
  await pipe.rollback('/path/to/existing/project');
}

// 子路径导入（按需）
import { InjectPipeline } from '@ai-spec/skill/inject';
```

### CLI 脚手架

```bash
# 交互式
npx create-ai-spec-app my-project

# 非交互式（黄金组合）
npx create-ai-spec-app my-project --yes

# 改造既有项目（dry-run 默认，--apply 才写入）
npx ai-spec inject ./existing-project --apply
```

## 生成的项目结构

```
my-project/
├── .ai-spec/           # 规则 + 角色 + 模板 + 配置（从 kernel 拷贝）
│   ├── rules/*.yaml
│   ├── roles/*.md
│   ├── templates/*.hbs
│   ├── schema/rule.schema.json
│   └── config.json
├── packages/contracts/ # 契约层（按 contract 库渲染：Zod/Pydantic/JSON Schema）
├── apps/api/           # 后端（按 backend 渲染：Fastify/Express/Spring Boot/FastAPI）
├── apps/web/           # 前端（按 frontend 渲染：React+Vite/Vue3+Vite/Angular/无）
├── scripts/            # 工具脚本（check-rules / gen-delta / check-contract-drift）
├── docs/{prd,spec,review,retro}/  # 五角色产出目录
└── .github/workflows/ai-spec-ci.yml  # CI 门禁
```

## spec-first 工作流

生成的项目按五角色流程开发：

| 角色 | 输入 | 产出 | 文件 |
|---|---|---|---|
| BA | 背景需求 + 规则 | PRD（AC + Q&A） | `docs/prd/<domain>.md` |
| Tech Lead | PRD | Tech-Spec + contracts | `docs/spec/<domain>.tech.md` + `packages/contracts/src/schemas/<domain>.ts` |
| test-writer | Tech-Spec + 契约 | 断言级红测试 | `apps/<api|web>/test/<domain>*.test.ts` |
| impl-writer | Tech-Spec + 测试 | 实现（使测试转绿） | `apps/<api|web>/src/<domain>/*.ts` |
| Reviewer | 全部 | Review 报告 | `docs/review/<domain>-review.md` |

7 道门禁：G1 PRD → G3 Spec → G4 测试 → G5 实现 → G6 Review → G6.1 修复 → G7 合入。

## 适配器矩阵

### 已支持（MVP）

| 类型 | 适配器 | 状态 |
|---|---|---|
| backend | fastify-ts | ✅ 推荐 |
| backend | express-ts | ✅ |
| db | postgresql | ✅ 推荐 |
| db | sqlite | ✅ 开发用 |
| frontend | react-vite | ✅ 推荐 |
| contract | zod | ✅（TS 栈默认）|
| contract | pydantic | ✅（Python 栈）|
| contract | json-schema | ✅（跨语言）|
| auth | jwt | ✅ 推荐 |
| auth | none | ✅ 开发用 |
| ci | github-actions | ✅ 推荐 |

### Experimental（占位 manifest）

| 类型 | 适配器 | 状态 |
|---|---|---|
| backend | spring-boot / fastapi | ⚠️ experimental |
| db | mysql / mongodb | ⚠️ experimental |
| frontend | vue3-vite / angular | ⚠️ experimental |
| auth | session / oauth2 | ⚠️ experimental |
| ci | gitlab-ci | ⚠️ experimental |

## 包目录结构

```
ai-spec-skill/
├── src/
│   ├── kernel/              # 共享内核（技术栈无关）
│   │   ├── rules/           # 声明式规则集 (YAML)
│   │   ├── schema/          # 规则元模型 JSON Schema
│   │   ├── roles/           # 五角色提示词 (参数化)
│   │   └── templates/       # 文档模板 (PRD/Tech-Spec/Review/Retro)
│   ├── engine/              # 规则引擎 (核心调度 + builtin-regex-plugin + 外部 plugin)
│   │   ├── engine.ts
│   │   ├── loader.ts
│   │   ├── builtin-regex-plugin.ts
│   │   ├── glob.ts
│   │   ├── reporter.ts
│   │   └── plugins/         # 语言特化 plugin (typescript)
│   ├── spi/                 # 适配器 SPI 定义（7 接口）
│   ├── inject/              # 注入管线（5 阶段）
│   │   ├── detector/        # 项目探测
│   │   ├── arch-analyzer/   # 架构分析
│   │   ├── contract-reverser/  # API 逆向
│   │   ├── rule-injector/   # 规则注入
│   │   ├── safety-net/      # 测试安全网
│   │   └── index.ts         # InjectPipeline 聚合类
│   ├── adapters/            # 可插拔适配器
│   │   ├── contract/        # 契约渲染器 (Zod/Pydantic/JSON Schema)
│   │   ├── backend/         # 后端适配器 (fastify-ts/express-ts)
│   │   ├── db/              # 数据库适配器
│   │   ├── frontend/        # 前端适配器
│   │   ├── auth/            # 认证适配器
│   │   ├── ci/              # CI 适配器
│   │   └── architecture/    # 架构层映射 (layer-mapping.yaml)
│   ├── intelligence/        # Spec 完整性评分器
│   ├── registry/            # 本地 Skill Registry
│   ├── skill-pkg/           # Skill 包加载器
│   ├── tools/               # 通用 CLI 工具 (gen-delta/gen-snapshot)
│   └── index.ts             # 包主入口
├── cli/                     # CLI 脚手架 (commander + enquirer)
│   ├── index.ts             # create-ai-spec-app 入口
│   ├── generate.ts          # 生成型流程
│   ├── inject-command.ts    # 改造型流程（ai-spec inject）
│   ├── skill-command.ts     # skill search/add/remove
│   ├── template-engine.ts   # 模板渲染调度
│   └── templates/           # 模板渲染拆分（root-files / api-scaffold / web-scaffold / scripts）
├── skills/                  # 内置 Skill 包（user-mgmt / audit-log）
├── test/                    # DoD 验证套件
├── package.json
├── tsconfig.json            # typecheck 用（noEmit）
├── tsconfig.build.json      # build 用（emit dist/）
└── README.md
```

## SPI 接口

完整 SPI 定义见 [src/spi/adapter.ts](src/spi/adapter.ts)，包含 7 个接口：

- `DetectProjectSpi`：检测既有项目的技术栈
- `RenderContractSpi`：渲染契约层（Zod/Pydantic/JSON Schema）
- `RenderArchitectureSpi`：渲染架构层（router/service/repository/domain）
- `RuleCheckPlugin`：规则检查插件（13 项 enforcement 的语言特化）
- `GenerateCiConfigSpi`：生成 CI 配置
- `RenderRolePromptsSpi`：渲染五角色提示词
- `Adapter`：主接口，聚合上述能力

## 适配器开发指南

### 适配器目录结构

```
src/adapters/<type>/<id>/
├── manifest.yaml     # 声明能力 + 元数据
├── files/            # 模板文件（.tmpl 后缀，可用 {{var}} 占位）
└── adapter.ts        # 可选：实现 SPI 接口（capabilities 中声明的）
```

### manifest.yaml 示例

```yaml
id: fastify-ts
label: Fastify + TypeScript
version: "4.27"
capabilities:
  - detect-project
  - render-architecture
  - render-role-prompts
  - rule-check
language: typescript
ecosystem: nodejs
notes: |
  Fastify 4 原生支持 JSON Schema 校验。
```

### 添加新适配器步骤

1. 在 `src/adapters/<type>/<id>/` 下创建 `manifest.yaml`
2. 在 `files/` 下放模板文件（如 `server.ts.tmpl`）
3. 更新 `cli/options.ts` 的 `STACK_OPTIONS` 加入新选项
4. 如有特殊渲染逻辑，在 `cli/templates/<concern>.ts` 加分支
5. 跑 `npx tsx cli/index.ts test-proj --<type> <id> --yes --no-deps --no-git` 验证生成
6. 在生成的项目里跑 `npm run typecheck && npm test` 验证三件套全绿

## 设计原则

1. **内核只描述"做什么 + 为什么"，不绑定"用什么语言写"**
2. **适配器只描述"用 X 技术栈怎么落地"，可被替换**
3. **改造型（ai-spec inject）与生成型（create-ai-spec-app）共享内核与适配器，差异仅在入口流程**

## CLI 选项

```
create-ai-spec-app <project-name> [options]

Options:
  -o, --out <dir>         输出目录（默认 ./<project-name>）
  -b, --backend <stack>   后端 (fastify-ts|express-ts|spring-boot|fastapi)
  -d, --db <db>           数据库 (postgresql|sqlite|mysql|mongodb)
  -f, --frontend <stack>  前端 (react-vite|vue3-vite|angular|none)
  -c, --contract <lib>    契约库 (zod|pydantic|json-schema)
  -a, --auth <scheme>     认证 (jwt|session|oauth2|none)
  --ci <platform>         CI (github-actions|gitlab-ci|none)
  -y, --yes               使用黄金组合默认值（非交互模式）
  --no-deps               跳过依赖安装
  --no-git                跳过 git init
  -v, --verbose           详细日志
  -V, --version           显示版本
  -h, --help              显示帮助
```

## 开发期命令

```bash
npm install
npm test                    # 跑 DoD 验证套件
npm run typecheck           # tsc --noEmit
npm run build               # 产出 dist/（含 .d.ts / .map）
npm run cli:dev -- my-proj --yes --no-deps --no-git  # 本地开发模式跑 CLI
```

## 与 AIAdmin 的关系

本包从 [AIAdmin](https://github.com/soulor8908/AIAdmin) 仓库的 `skill/` 目录解耦而来：

- **共享内核**：规则集 / 角色提示词 / 模板 / SPI 由本包提供
- **AIAdmin 消费**：AIAdmin 通过 `"@ai-spec/skill": "github:soulor8908/ai-spec-skill#main"` 依赖本包，`check-rules.mjs` 委托本包的 `RuleEngine`
- **完整 parity 测试**：留在 AIAdmin 消费侧（`mvp/apps/api/test/skill-parity.test.ts`），本包仅保留 schema 一致性精简测试

## License

MIT
