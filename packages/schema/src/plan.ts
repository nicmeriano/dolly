import { z } from "zod";
import { PlanConfigSchema } from "./config.js";
import { StepSchema } from "./steps.js";
import { DEFAULTS } from "./defaults.js";

export const PartialRetryConfigSchema = z.object({
  stepRetries: z.number().int().min(0).optional(),
  actionRetries: z.number().int().min(0).optional(),
  retryDelay: z.number().int().min(0).optional(),
});

export const ActionSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(StepSchema).min(1),
  retries: PartialRetryConfigSchema.optional(),
  clearStorageBefore: z.boolean().optional(),
  leadIn: z.number().int().min(0).default(DEFAULTS.action.leadIn),
  leadOut: z.number().int().min(0).default(DEFAULTS.action.leadOut),
  meta: z.record(z.unknown()).optional(),
});

export type Action = z.infer<typeof ActionSchema>;

export const PlanSchema = z.object({
  $schema: z.string().default("dolly/v1"),
  version: z.literal(1),
  name: z.string().min(1),
  config: PlanConfigSchema,
  actions: z.array(ActionSchema).min(1),
});

export type Plan = z.infer<typeof PlanSchema>;

export interface ValidatePlanResult {
  success: boolean;
  plan?: Plan;
  errors?: z.ZodError;
}

export function validatePlan(input: unknown): ValidatePlanResult {
  const result = PlanSchema.safeParse(input);
  if (result.success) {
    return { success: true, plan: result.data };
  }
  return { success: false, errors: result.error };
}
