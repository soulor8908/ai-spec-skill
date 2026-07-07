import type { GenerateOptions } from './options.js';
import type { WriteOp } from '../src/spi/adapter.js';
export interface RenderResult {
    writes: WriteOp[];
    warnings: string[];
}
export declare function renderProject(opts: GenerateOptions): Promise<RenderResult>;
//# sourceMappingURL=template-engine.d.ts.map