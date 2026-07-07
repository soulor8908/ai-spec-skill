// cli/log.ts —— 输出格式化（轻量 console 包装）
// P1-1 产出：统一日志风格，避免散落 console.log。
const isTTY = process.stdout.isTTY ?? false;
const GREEN = isTTY ? '\x1b[32m' : '';
const RED = isTTY ? '\x1b[31m' : '';
const YELLOW = isTTY ? '\x1b[33m' : '';
const CYAN = isTTY ? '\x1b[36m' : '';
const DIM = isTTY ? '\x1b[2m' : '';
const RESET = isTTY ? '\x1b[0m' : '';
export const logger = {
    info(msg) {
        console.log(`${CYAN}ℹ${RESET} ${msg}`);
    },
    success(msg) {
        console.log(`${GREEN}✔${RESET} ${msg}`);
    },
    warn(msg) {
        console.log(`${YELLOW}⚠${RESET} ${msg}`);
    },
    error(msg) {
        console.error(`${RED}✖${RESET} ${msg}`);
    },
    verbose(msg, verbose) {
        if (verbose)
            console.log(`${DIM}  ${msg}${RESET}`);
    },
    startStep(label) {
        console.log(`${DIM}… ${label}${RESET}`);
    },
    endStep(label, ok) {
        const icon = ok ? `${GREEN}✔${RESET}` : `${RED}✖${RESET}`;
        console.log(`${icon} ${label}`);
    },
    blank() {
        console.log();
    },
    banner() {
        console.log(`${CYAN}
  ╔═╗╔═╗╔╦╗╦╔╦╗╦ ╦  ╔═╗╔═╗╔╦╗╦╔╦╗╦ ╦
  ╚═╗║╣  ║ ║ ║ ╠╦╝  ╚═╗║╣  ║ ║ ║ ╠╦╝
  ╚═╝╚═╝ ╩ ╩ ╩ ╩╚═  ╚═╝╚═╝ ╩ ╩ ╩ ╩╚═
${RESET}
  ${DIM}spec-first AI 原生工作流脚手架${RESET}
`);
    },
};
//# sourceMappingURL=log.js.map