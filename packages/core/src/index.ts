export { run } from "./runner.js";
export type { RunOptions, RunResult, RunHandle } from "./runner.js";

export { executeAction } from "./action-recorder.js";
export type { ExecuteActionOptions, ExecuteActionResult } from "./action-recorder.js";

export { executeStep } from "./step-executor.js";
export type { StepExecutorOptions } from "./step-executor.js";

export { convertToMp4 } from "./stitcher.js";
export type { ConvertToMp4Options } from "./stitcher.js";

export { readManifest, writeManifest } from "./manifest.js";

export { resolveFfmpegBinary, runFfmpeg } from "./ffmpeg.js";

export { buildNormalizationCSS, buildInitScript } from "./normalization.js";

export { resolveUrl } from "./url.js";

export { TypedEmitter } from "./events.js";
export type { RunEvents, RunEventName } from "./events.js";

export {
  DollyError,
  StepError,
  ActionError,
  FfmpegError,
  AbortError,
} from "./errors.js";
