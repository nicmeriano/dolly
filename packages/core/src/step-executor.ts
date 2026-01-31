import type { Page } from "playwright";
import type { Step } from "@dolly/schema";
import { StepError } from "./errors.js";
import { resolveUrl } from "./url.js";

export interface StepExecutorOptions {
  baseUrl: string;
  fast?: boolean; // skip pauses in replay mode
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
    await executeStepAction(page, step, options);
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

async function executeStepAction(
  page: Page,
  step: Step,
  options: StepExecutorOptions,
): Promise<void> {
  switch (step.type) {
    case "click": {
      const locator = page.locator(step.selector);
      await locator.click({
        button: step.button,
        clickCount: step.clickCount,
        position: step.position,
      });
      break;
    }

    case "type": {
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
