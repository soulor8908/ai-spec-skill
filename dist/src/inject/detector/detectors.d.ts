import type { DetectSignal } from './types.js';
export type Detector = {
    /** 探测器 ID（用于审计） */
    id: string;
    /** 探测的根文件（相对项目根） */
    targets: string[];
    /** 执行探测 */
    detect: (rootDir: string) => DetectSignal[];
};
export declare const packageJsonDetector: Detector;
export declare const lockfileDetector: Detector;
export declare const pomXmlDetector: Detector;
export declare const gradleDetector: Detector;
export declare const pythonDepsDetector: Detector;
export declare const ciDetector: Detector;
export declare const sourcePatternDetector: Detector;
export declare const dbConfigDetector: Detector;
export declare const ALL_DETECTORS: Detector[];
//# sourceMappingURL=detectors.d.ts.map