import { z } from "zod";

export const ActionRecordSchema = z.object({
  actionId: z.string(),
  retriesUsed: z.number().int().min(0),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
});

export type ActionRecord = z.infer<typeof ActionRecordSchema>;

export const RecordingManifestSchema = z.object({
  planName: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  video: z.string().nullable(),
  rawVideo: z.string().nullable().optional(),
  recordingDir: z.string().optional(),
  durationSeconds: z.number(),
  actions: z.array(ActionRecordSchema),
});

export type RecordingManifest = z.infer<typeof RecordingManifestSchema>;
