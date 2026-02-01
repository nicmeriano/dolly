export {
  PlanSchema,
  ActionSchema,
  PartialRetryConfigSchema,
  validatePlan,
} from "./plan.js";
export type { Plan, Action, ValidatePlanResult } from "./plan.js";

export {
  PlanConfigSchema,
  RetryConfigSchema,
  NormalizationConfigSchema,
  CursorConfigSchema,
  ViewportSchema,
} from "./config.js";
export type {
  PlanConfig,
  RetryConfig,
  NormalizationConfig,
  CursorConfig,
} from "./config.js";

export {
  StepSchema,
  ClickStepSchema,
  TypeStepSchema,
  ScrollStepSchema,
  HoverStepSchema,
  WaitStepSchema,
  WaitForSelectorStepSchema,
  SelectStepSchema,
  NavigateStepSchema,
} from "./steps.js";
export type {
  Step,
  ClickStep,
  TypeStep,
  ScrollStep,
  HoverStep,
  WaitStep,
  WaitForSelectorStep,
  SelectStep,
  NavigateStep,
} from "./steps.js";

export {
  RecordingManifestSchema,
  ActionRecordSchema,
} from "./manifest.js";
export type { RecordingManifest, ActionRecord } from "./manifest.js";

export {
  PostProductionConfigSchema,
  PostProductionCursorSchema,
  PostProductionAudioSchema,
} from "./post-production.js";
export type {
  PostProductionConfig,
  PostProductionCursor,
  PostProductionAudio,
} from "./post-production.js";

export {
  CursorKeyframeSchema,
  CursorKeyframesFileSchema,
} from "./cursor-keyframes.js";
export type {
  CursorKeyframe,
  CursorKeyframesFile,
} from "./cursor-keyframes.js";

export { DEFAULTS } from "./defaults.js";
