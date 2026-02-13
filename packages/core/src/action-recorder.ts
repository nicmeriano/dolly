import type { Page, BrowserContext } from "playwright";
import type { Action, RetryConfig } from "@nicmeriano/dolly-schema";
import { executeStep } from "./step-executor.js";
import { TypedEmitter } from "./events.js";
import { StepError } from "./errors.js";

export interface ExecuteActionOptions {
  page: Page;
  context: BrowserContext;
  action: Action;
  actionIndex: number;
  totalActions: number;
  baseUrl: string;
  retries: RetryConfig;
  events: TypedEmitter;
  signal?: AbortSignal;
  fast?: boolean;
  showCursor?: boolean;
}

export interface ExecuteActionResult {
  retriesUsed: number;
}

export async function executeAction(
  options: ExecuteActionOptions,
): Promise<ExecuteActionResult> {
  const { page, context, action, actionIndex, totalActions, baseUrl, retries, events, signal, fast, showCursor } = options;

  events.emit("action:start", {
    actionId: action.id,
    index: actionIndex,
    total: totalActions,
  });

  if (action.clearStorageBefore) {
    await context.clearCookies();
    await page.evaluate(() => {
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
    });
  }

  // leadIn pause — recorded dwell time
  if (!fast && action.leadIn > 0) {
    await page.waitForTimeout(action.leadIn);
  }

  const stepRetries = action.retries?.stepRetries ?? retries.stepRetries;
  const retryDelay = action.retries?.retryDelay ?? retries.retryDelay;
  let totalStepRetries = 0;

  for (let i = 0; i < action.steps.length; i++) {
    if (signal?.aborted) {
      throw new Error("Aborted");
    }

    const step = action.steps[i];

    events.emit("step:start", {
      actionId: action.id,
      stepIndex: i,
      stepType: step.type,
      totalSteps: action.steps.length,
    });

    let lastError: Error | undefined;
    let succeeded = false;

    for (let attempt = 0; attempt <= stepRetries; attempt++) {
      try {
        await executeStep(page, step, i, {
          baseUrl,
          fast,
          showCursor,
          events,
          actionId: action.id,
        });
        succeeded = true;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < stepRetries) {
          totalStepRetries++;
          events.emit("step:retry", {
            actionId: action.id,
            stepIndex: i,
            attempt: attempt + 1,
            error: lastError,
          });
          await page.waitForTimeout(retryDelay);
        }
      }
    }

    if (!succeeded) {
      throw lastError ?? new StepError(i, step.type, "Unknown failure");
    }

    events.emit("step:complete", {
      actionId: action.id,
      stepIndex: i,
      stepType: step.type,
    });
  }

  // leadOut pause — recorded dwell time
  if (!fast && action.leadOut > 0) {
    await page.waitForTimeout(action.leadOut);
  }

  events.emit("action:complete", {
    actionId: action.id,
    retriesUsed: totalStepRetries,
  });

  return { retriesUsed: totalStepRetries };
}
