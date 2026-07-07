// skill-pkg/types.ts —— P3-1 Skill 包格式类型定义
// 一个 Skill 包 = 命名空间(name) + 版本(version) + 产物(rules/templates/role_prompts/adapters) + 依赖/冲突 + 覆盖声明。
//
// 设计原则：
// - 与 adapter manifest 同源（同一 yaml schema 风格），但 skill 是更大的"方法论包"
// - 命名空间避免规则 ID 冲突：user-mgmt 的 SEC-001 → 全局键 user-mgmt/SEC-001（建议 6：当前阶段用简单名）
// - overrides 显式声明覆盖行为，禁止隐式覆盖（P3-4 双向绑定）
export {};
//# sourceMappingURL=types.js.map