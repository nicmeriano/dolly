export { run, test } from "./runner.js";
export type { RunOptions, RunResult, RunHandle, TestResult, TestStepResult, TestHandle } from "./runner.js";

export { executeAction } from "./action-recorder.js";
export type { ExecuteActionOptions, ExecuteActionResult } from "./action-recorder.js";

export { executeStep } from "./step-executor.js";
export type { StepExecutorOptions } from "./step-executor.js";

export { convertToMp4 } from "./stitcher.js";
export type { ConvertToMp4Options } from "./stitcher.js";

export { readManifest, writeManifest } from "./manifest.js";

export { resolveFfmpegBinary, runFfmpeg } from "./ffmpeg.js";

export { buildNormalizationCSS, buildCursorCSS, buildCursorJS, buildInitScript } from "./normalization.js";
export type { BuildInitScriptOptions } from "./normalization.js";

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

export {
  postProduce,
  renderCursorFrame,
  CURSOR_SHAPES,
  getCursorShape,
  parseSvgCursor,
  interpolateCursor,
  findKeyframeIndex,
  buildAudioFilters,
} from "./post-production/index.js";
export type {
  PostProductionOptions,
  PostProductionResult,
  CursorRendererConfig,
  CursorRendererEnv,
  CursorShape,
  CursorShapePath,
  CursorPosition,
  AudioFilterResult,
} from "./post-production/index.js";
