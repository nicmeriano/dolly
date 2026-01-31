import { z } from "zod";
import { DEFAULTS } from "./defaults.js";

const BaseStepFields = {
  pauseBefore: z.number().int().min(0).optional(),
  pauseAfter: z.number().int().min(0).optional(),
  comment: z.string().optional(),
};

export const ClickStepSchema = z.object({
  ...BaseStepFields,
  type: z.literal("click"),
  selector: z.string().min(1),
  button: z.enum(["left", "right", "middle"]).optional(),
  clickCount: z.number().int().min(1).optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

export const TypeStepSchema = z.object({
  ...BaseStepFields,
  type: z.literal("type"),
  selector: z.string().min(1),
  text: z.string(),
  typeDelay: z.number().int().min(0).default(DEFAULTS.step.typeDelay),
  clearBefore: z.boolean().optional(),
});

export const ScrollStepSchema = z.object({
  ...BaseStepFields,
  type: z.literal("scroll"),
  target: z.string().default("viewport"),
  direction: z.enum(["up", "down", "left", "right"]),
  amount: z.number().int().min(1),
  duration: z.number().int().min(0).optional(),
});

export const HoverStepSchema = z.object({
  ...BaseStepFields,
  type: z.literal("hover"),
  selector: z.string().min(1),
  holdDuration: z.number().int().min(0).optional(),
});

export const WaitStepSchema = z.object({
  ...BaseStepFields,
  type: z.literal("wait"),
  duration: z.number().int().min(0),
});

export const WaitForSelectorStepSchema = z.object({
  ...BaseStepFields,
  type: z.literal("waitForSelector"),
  selector: z.string().min(1),
  state: z.enum(["attached", "detached", "visible", "hidden"]).optional(),
  timeout: z.number().int().min(0).optional(),
});

export const SelectStepSchema = z.object({
  ...BaseStepFields,
  type: z.literal("select"),
  selector: z.string().min(1),
  value: z.string(),
});

export const NavigateStepSchema = z.object({
  ...BaseStepFields,
  type: z.literal("navigate"),
  url: z.string().min(1),
  waitUntil: z
    .enum(["load", "domcontentloaded", "networkidle", "commit"])
    .optional(),
});

export const StepSchema = z.discriminatedUnion("type", [
  ClickStepSchema,
  TypeStepSchema,
  ScrollStepSchema,
  HoverStepSchema,
  WaitStepSchema,
  WaitForSelectorStepSchema,
  SelectStepSchema,
  NavigateStepSchema,
]);

export type ClickStep = z.infer<typeof ClickStepSchema>;
export type TypeStep = z.infer<typeof TypeStepSchema>;
export type ScrollStep = z.infer<typeof ScrollStepSchema>;
export type HoverStep = z.infer<typeof HoverStepSchema>;
export type WaitStep = z.infer<typeof WaitStepSchema>;
export type WaitForSelectorStep = z.infer<typeof WaitForSelectorStepSchema>;
export type SelectStep = z.infer<typeof SelectStepSchema>;
export type NavigateStep = z.infer<typeof NavigateStepSchema>;
export type Step = z.infer<typeof StepSchema>;
