import { z } from "zod";

export const CursorKeyframeSchema = z.object({
  x: z.number(),
  y: z.number(),
  timestamp: z.number(),
  type: z.enum(["move", "click"]),
  actionId: z.string(),
  stepIndex: z.number().int().min(0),
});

export type CursorKeyframe = z.infer<typeof CursorKeyframeSchema>;

export const CursorKeyframesFileSchema = z.object({
  version: z.literal(1),
  fps: z.number().int().min(1),
  viewport: z.object({
    w: z.number().int().min(1),
    h: z.number().int().min(1),
  }),
  recordingStartedAt: z.string(),
  durationMs: z.number(),
  keyframes: z.array(CursorKeyframeSchema),
});

export type CursorKeyframesFile = z.infer<typeof CursorKeyframesFileSchema>;
