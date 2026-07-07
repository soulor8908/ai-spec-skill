// src/paths.ts —— 包内路径解析工具
//
// 统一解决"运行时定位包内资源"问题，避免各处 process.cwd() / 硬编码相对路径。
// 适用于 dev 模式（tsx 直跑源码）与 build 模式（dist/ 编译产物）两种场景。
//
// 核心思路：基于 import.meta.url 定位当前文件，向上查找 package.json 所在目录即包根。
// 这样无论文件在 src/ 还是 dist/ 下，都能正确解析到包根，再拼出资源路径。

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 查找包根目录（含 package.json 的目录）。
 * 从当前文件向上逐级查找 package.json，找到即返回。
 * 兼容 dev（src/paths.ts）与 build（dist/src/paths.js）两种布局。
 */
export function getPackageRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return dirname(dirname(__dirname));
}

/**
 * 返回内置规则目录（包内 src/kernel/rules/ 绝对路径）。
 * 路径基于包根解析，不依赖 process.cwd()，CI / 任意工作目录均稳定。
 */
export function getBuiltinRulesDir(): string {
  return join(getPackageRoot(), 'src', 'kernel', 'rules');
}

/**
 * 返回内置适配器目录（包内 src/adapters/ 绝对路径）。
 */
export function getAdaptersDir(): string {
  return join(getPackageRoot(), 'src', 'adapters');
}

/**
 * 返回内置 kernel 目录（包内 src/kernel/ 绝对路径）。
 */
export function getKernelDir(): string {
  return join(getPackageRoot(), 'src', 'kernel');
}
