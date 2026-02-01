import { z } from "zod";

export const PostProductionCursorSchema = z.object({
  enabled: z.boolean().default(true),
  style: z.enum(["pointer", "pointer-alt", "hand", "dot"]).default("pointer"),
  customSvg: z.string().optional(),
  size: z.number().int().min(4).max(64).default(20),
  color: z.string().default("#000000"),
  opacity: z.number().min(0).max(1).default(0.8),
  clickEffect: z.enum(["scale", "none"]).default("scale"),
});

export type PostProductionCursor = z.infer<typeof PostProductionCursorSchema>;

export const PostProductionAudioSchema = z.object({
  clickSound: z.boolean().default(true),
  volume: z.number().min(0).max(1).default(0.5),
  customFile: z.string().optional(),
});

export type PostProductionAudio = z.infer<typeof PostProductionAudioSchema>;

export const PostProductionConfigSchema = z.object({
  cursor: PostProductionCursorSchema.default({}),
  audio: PostProductionAudioSchema.default({}),
});

export type PostProductionConfig = z.infer<typeof PostProductionConfigSchema>;
