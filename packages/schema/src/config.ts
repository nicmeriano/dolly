import { z } from "zod";
import { DEFAULTS } from "./defaults.js";

export const RetryConfigSchema = z.object({
  stepRetries: z.number().int().min(0).default(DEFAULTS.retries.stepRetries),
  actionRetries: z.number().int().min(0).default(DEFAULTS.retries.actionRetries),
  retryDelay: z.number().int().min(0).default(DEFAULTS.retries.retryDelay),
});

export type RetryConfig = z.infer<typeof RetryConfigSchema>;

export const NormalizationConfigSchema = z.object({
  hideScrollbars: z.boolean().default(DEFAULTS.normalization.hideScrollbars),
  disableCursorBlink: z.boolean().default(DEFAULTS.normalization.disableCursorBlink),
  disableAnimations: z.boolean().default(DEFAULTS.normalization.disableAnimations),
  forceConsistentFonts: z.boolean().default(DEFAULTS.normalization.forceConsistentFonts),
  fontFamily: z.string().optional().default(DEFAULTS.normalization.fontFamily),
  locale: z.string().default(DEFAULTS.normalization.locale),
  timezone: z.string().default(DEFAULTS.normalization.timezone),
  colorScheme: z.enum(["light", "dark"]).default(DEFAULTS.normalization.colorScheme),
  reducedMotion: z.enum(["reduce", "no-preference"]).default(DEFAULTS.normalization.reducedMotion),
  clearStorageBetweenActions: z.boolean().default(DEFAULTS.normalization.clearStorageBetweenActions),
});

export type NormalizationConfig = z.infer<typeof NormalizationConfigSchema>;

export const ViewportSchema = z.object({
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

export const PlanConfigSchema = z.object({
  baseUrl: z.string().url(),
  viewport: ViewportSchema,
  fps: z.number().int().min(1).max(60).default(DEFAULTS.fps),
  browser: z.literal("chromium").default(DEFAULTS.browser),
  normalization: NormalizationConfigSchema.default({}),
  outputDir: z.string().default(DEFAULTS.outputDir),
  outputName: z.string().default(DEFAULTS.outputName),
  outputFormat: z.enum(["mp4", "webm"]).default(DEFAULTS.outputFormat),
  retries: RetryConfigSchema.default({}),
});

export type PlanConfig = z.infer<typeof PlanConfigSchema>;
