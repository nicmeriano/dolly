import type { Page } from "playwright";
import type { Step } from "@nicmeriano/dolly-schema";
import { StepError } from "./errors.js";
import { resolveUrl } from "./url.js";
import { TypedEmitter } from "./events.js";

export interface StepExecutorOptions {
  baseUrl: string;
  fast?: boolean; // skip pauses in replay mode
  showCursor?: boolean; // position fake cursor before interactions
  events?: TypedEmitter;
  actionId?: string;
}

export async function executeStep(
  page: Page,
  step: Step,
  stepIndex: number,
  options: StepExecutorOptions,
): Promise<void> {
  if (!options.fast && step.pauseBefore) {
    await page.waitForTimeout(step.pauseBefore);
  }

  try {
    await executeStepAction(page, step, stepIndex, options);
  } catch (err) {
    throw new StepError(
      stepIndex,
      step.type,
      err instanceof Error ? err.message : String(err),
      { cause: err },
    );
  }

  if (!options.fast && step.pauseAfter) {
    await page.waitForTimeout(step.pauseAfter);
  }
}

/**
 * Resolve element bounding box center and emit cursor:move event.
 * Returns the computed position, or null if the element wasn't found.
 */
async function moveCursorTo(
  page: Page,
  selector: string,
  stepIndex: number,
  options: StepExecutorOptions,
): Promise<{ x: number; y: number } | null> {
  const locator = page.locator(selector);
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return null;

  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);

  if (options.events && options.actionId) {
    options.events.emit("cursor:move", {
      x,
      y,
      actionId: options.actionId,
      stepIndex,
    });
  }

  // Small delay for natural action pacing
  if (!options.fast) {
    await page.waitForTimeout(100);
  }

  return { x, y };
}

async function executeStepAction(
  page: Page,
  step: Step,
  stepIndex: number,
  options: StepExecutorOptions,
): Promise<void> {
  switch (step.type) {
    case "click": {
      const pos = options.showCursor
        ? await moveCursorTo(page, step.selector, stepIndex, options)
        : null;
      const locator = page.locator(step.selector);
      await locator.click({
        button: step.button,
        clickCount: step.clickCount,
        position: step.position,
      });
      // Emit click event after click action
      if (options.events && options.actionId && pos) {
        options.events.emit("cursor:click", {
          x: pos.x,
          y: pos.y,
          actionId: options.actionId,
          stepIndex,
        });
      }
      break;
    }

    case "type": {
      if (options.showCursor) {
        await moveCursorTo(page, step.selector, stepIndex, options);
      }
      const locator = page.locator(step.selector);
      if (step.clearBefore) {
        await locator.clear();
      }
      const delay = options.fast ? 0 : step.typeDelay;
      await locator.pressSequentially(step.text, { delay });
      break;
    }

    case "scroll": {
      const direction = step.direction;
      const amount = step.amount;
      const deltaX = direction === "left" ? -amount : direction === "right" ? amount : 0;
      const deltaY = direction === "up" ? -amount : direction === "down" ? amount : 0;

      if (step.target === "viewport") {
        await page.mouse.wheel(deltaX, deltaY);
      } else {
        if (options.showCursor) {
          await moveCursorTo(page, step.target, stepIndex, options);
        }
        await page.locator(step.target).evaluate(
          (el, { dx, dy }) => {
            el.scrollBy(dx, dy);
          },
          { dx: deltaX, dy: deltaY },
        );
      }

      if (!options.fast && step.duration) {
        await page.waitForTimeout(step.duration);
      }
      break;
    }

    case "hover": {
      if (options.showCursor) {
        await moveCursorTo(page, step.selector, stepIndex, options);
      }
      const locator = page.locator(step.selector);
      await locator.hover();
      if (!options.fast && step.holdDuration) {
        await page.waitForTimeout(step.holdDuration);
      }
      break;
    }

    case "wait": {
      if (!options.fast) {
        await page.waitForTimeout(step.duration);
      }
      break;
    }

    case "waitForSelector": {
      const locator = page.locator(step.selector);
      await locator.waitFor({
        state: step.state,
        timeout: step.timeout,
      });
      break;
    }

    case "select": {
      if (options.showCursor) {
        await moveCursorTo(page, step.selector, stepIndex, options);
      }
      const locator = page.locator(step.selector);
      await locator.selectOption(step.value);
      break;
    }

    case "navigate": {
      const url = resolveUrl(step.url, options.baseUrl);
      await page.goto(url, {
        waitUntil: step.waitUntil,
      });
      break;
    }
  }
}
