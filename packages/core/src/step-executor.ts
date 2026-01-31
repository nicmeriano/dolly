import type { Page } from "playwright";
import type { Step } from "@dolly/schema";
import { StepError } from "./errors.js";
import { resolveUrl } from "./url.js";

export interface StepExecutorOptions {
  baseUrl: string;
  fast?: boolean; // skip pauses in replay mode
  showCursor?: boolean; // position fake cursor before interactions
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

/**
 * Move the fake cursor element to the center of a target element.
 * Resolves the element's bounding box and sets the cursor position
 * via page.evaluate(), then waits for the CSS transition to render
 * in video frames.
 */
async function moveCursorTo(
  page: Page,
  selector: string,
  fast?: boolean,
): Promise<void> {
  const locator = page.locator(selector);
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return;

  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);

  await page.evaluate(({ cx, cy }) => {
    const el = document.querySelector('.dolly-cursor') as HTMLElement | null;
    if (el) {
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
    }
  }, { cx: x, cy: y });

  // Wait for CSS transition (150ms) to complete so video captures the motion
  if (!fast) {
    await page.waitForTimeout(200);
  }
}

async function executeStepAction(
  page: Page,
  step: Step,
  options: StepExecutorOptions,
): Promise<void> {
  switch (step.type) {
    case "click": {
      if (options.showCursor) {
        await moveCursorTo(page, step.selector, options.fast);
      }
      const locator = page.locator(step.selector);
      await locator.click({
        button: step.button,
        clickCount: step.clickCount,
        position: step.position,
      });
      break;
    }

    case "type": {
      if (options.showCursor) {
        await moveCursorTo(page, step.selector, options.fast);
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
          await moveCursorTo(page, step.target, options.fast);
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
        await moveCursorTo(page, step.selector, options.fast);
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
        await moveCursorTo(page, step.selector, options.fast);
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
