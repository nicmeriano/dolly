import * as path from "node:path";
import * as fs from "node:fs/promises";
import { chromium } from "playwright";
import type { Plan, RecordingManifest, CursorKeyframe, CursorKeyframesFile, PostProductionConfig } from "@nicmeriano/dolly-schema";
import { PostProductionConfigSchema } from "@nicmeriano/dolly-schema";
import { executeAction } from "./action-recorder.js";
import { buildInitScript } from "./normalization.js";
import { postProduce } from "./post-production/export.js";
import { writeManifest } from "./manifest.js";
import { TypedEmitter } from "./events.js";
import { AbortError } from "./errors.js";
import { ScreencastRecorder } from "./screencast-recorder.js";

export interface RunOptions {
  plan: Plan;
  headed?: boolean;
  outputDir?: string;
  format?: "mp4" | "webm";
  signal?: AbortSignal;
  mode?: "record" | "test";
}

export interface RunResult {
  manifest: RecordingManifest;
  outputDir: string;
}

export interface TestStepResult {
  actionId: string;
  actionIndex: number;
  stepIndex: number;
  stepType: string;
  passed: boolean;
  error?: string;
  screenshot?: string;
}

export interface TestResult {
  passed: boolean;
  totalActions: number;
  passedActions: number;
  failedActions: number;
  steps: TestStepResult[];
  durationMs: number;
  screenshotDir: string;
}

export interface RunHandle {
  result: Promise<RunResult>;
  events: TypedEmitter;
  abort: () => void;
}

export interface TestHandle {
  result: Promise<TestResult>;
  events: TypedEmitter;
  abort: () => void;
}

function generateRecordingDirName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

export function run(options: RunOptions): RunHandle {
  const events = new TypedEmitter();
  const abortController = new AbortController();

  if (options.signal) {
    options.signal.addEventListener("abort", () => abortController.abort(), { once: true });
  }

  const result = executeRun(options, events, abortController.signal);

  return {
    result,
    events,
    abort: () => abortController.abort(),
  };
}

export function test(options: RunOptions): TestHandle {
  const events = new TypedEmitter();
  const abortController = new AbortController();

  if (options.signal) {
    options.signal.addEventListener("abort", () => abortController.abort(), { once: true });
  }

  const result = executeTest(options, events, abortController.signal);

  return {
    result,
    events,
    abort: () => abortController.abort(),
  };
}

async function executeRun(
  options: RunOptions,
  events: TypedEmitter,
  signal: AbortSignal,
): Promise<RunResult> {
  const { plan, headed = false } = options;
  const config = plan.config;
  const baseOutputDir = path.resolve(options.outputDir ?? config.outputDir);

  // Create timestamped recording directory
  const recordingDirName = generateRecordingDirName();
  const recordingDir = path.join(baseOutputDir, "recordings", recordingDirName);
  await fs.mkdir(recordingDir, { recursive: true });

  // Copy plan.json into recording directory
  await fs.writeFile(
    path.join(recordingDir, "plan.json"),
    JSON.stringify(plan, null, 2),
    "utf-8",
  );

  // Write default post-production config
  const postProdConfig: PostProductionConfig = plan.postProduction
    ? PostProductionConfigSchema.parse(plan.postProduction)
    : PostProductionConfigSchema.parse({});

  await fs.writeFile(
    path.join(recordingDir, "post-production.json"),
    JSON.stringify(postProdConfig, null, 2),
    "utf-8",
  );

  const manifest: RecordingManifest = {
    planName: plan.name,
    startedAt: new Date().toISOString(),
    completedAt: "",
    video: null,
    rawVideo: null,
    recordingDir,
    durationSeconds: 0,
    actions: [],
  };

  const browser = await chromium.launch({ headless: !headed });

  const context = await browser.newContext({
    viewport: config.viewport,
    deviceScaleFactor: 1,
    locale: config.normalization.locale,
    timezoneId: config.normalization.timezone,
    colorScheme: config.normalization.colorScheme,
    reducedMotion: config.normalization.reducedMotion,
  });

  const page = await context.newPage();

  // No cursor CSS/JS injection during recording — cursor is added in post-production
  await page.addInitScript({ content: buildInitScript({
    normalization: config.normalization,
  }) });

  // Start CDP screencast → ffmpeg pipeline for high-quality H.264 capture
  const rawVideoName = "raw.mp4";
  const rawVideoPath = path.join(recordingDir, rawVideoName);
  const recorder = new ScreencastRecorder({
    page,
    outputPath: rawVideoPath,
    fps: config.fps,
    width: config.viewport.width,
    height: config.viewport.height,
  });
  await recorder.start();

  const startTime = recorder.startTimeMs;
  const cursorKeyframes: CursorKeyframe[] = [];

  // Collect cursor events
  events.on("cursor:move", (data) => {
    cursorKeyframes.push({
      x: data.x,
      y: data.y,
      timestamp: Date.now() - startTime,
      type: "move",
      actionId: data.actionId,
      stepIndex: data.stepIndex,
    });
  });

  events.on("cursor:click", (data) => {
    cursorKeyframes.push({
      x: data.x,
      y: data.y,
      timestamp: Date.now() - startTime,
      type: "click",
      actionId: data.actionId,
      stepIndex: data.stepIndex,
    });
  });

  events.emit("run:start", {
    planName: plan.name,
    totalActions: plan.actions.length,
  });

  try {
    for (let i = 0; i < plan.actions.length; i++) {
      if (signal.aborted) throw new AbortError();

      const result = await executeAction({
        page,
        context,
        action: plan.actions[i],
        actionIndex: i,
        totalActions: plan.actions.length,
        baseUrl: config.baseUrl,
        retries: config.retries,
        events,
        signal,
        showCursor: config.cursor.show,
      });

      manifest.actions.push({
        actionId: plan.actions[i].id,
        retriesUsed: result.retriesUsed,
      });
    }

    const durationMs = Date.now() - startTime;
    manifest.durationSeconds = durationMs / 1000;

    // Stop the screencast recorder and finalize the raw video
    await recorder.stop();
    await context.close();
    manifest.rawVideo = rawVideoName;

    // Write cursor keyframes
    const keyframesFile: CursorKeyframesFile = {
      version: 1,
      fps: config.fps,
      viewport: { w: config.viewport.width, h: config.viewport.height },
      recordingStartedAt: manifest.startedAt,
      durationMs,
      keyframes: cursorKeyframes,
    };

    await fs.writeFile(
      path.join(recordingDir, "cursor-keyframes.json"),
      JSON.stringify(keyframesFile, null, 2),
      "utf-8",
    );

    // Post-production: overlay cursor + click sounds
    events.emit("postprod:start", {});

    const outputPath = path.join(recordingDir, "output.mp4");
    await postProduce({
      rawVideoPath,
      keyframesFile,
      postProdConfig,
      outputPath,
      fps: config.fps,
      signal,
    });

    manifest.video = "output.mp4";
    events.emit("postprod:complete", { outputPath });

    manifest.completedAt = new Date().toISOString();
    await writeManifest(recordingDir, manifest);

    events.emit("run:complete", {
      planName: plan.name,
      durationMs,
    });

    return { manifest, outputDir: recordingDir };
  } catch (err) {
    // Stop recorder and close context on failure
    await recorder.stop().catch(() => {});
    await context.close().catch(() => {});

    manifest.completedAt = new Date().toISOString();
    manifest.durationSeconds = (Date.now() - startTime) / 1000;
    await writeManifest(recordingDir, manifest).catch(() => {});

    throw err;
  } finally {
    await browser.close().catch(() => {});
  }
}

async function executeTest(
  options: RunOptions,
  events: TypedEmitter,
  signal: AbortSignal,
): Promise<TestResult> {
  const { plan, headed = false } = options;
  const config = plan.config;
  const outputDir = path.resolve(options.outputDir ?? config.outputDir);
  const screenshotDir = path.join(outputDir, "test", "screenshots");

  await fs.mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: !headed });

  const context = await browser.newContext({
    viewport: config.viewport,
    locale: config.normalization.locale,
    timezoneId: config.normalization.timezone,
    colorScheme: config.normalization.colorScheme,
    reducedMotion: config.normalization.reducedMotion,
    // No recordVideo — test mode skips video recording
  });

  const page = await context.newPage();
  await page.addInitScript({ content: buildInitScript({
    normalization: config.normalization,
    // No cursor in test mode
  }) });

  const startTime = Date.now();
  const stepResults: TestStepResult[] = [];
  let passedActions = 0;
  let failedActions = 0;

  events.emit("run:start", {
    planName: plan.name,
    totalActions: plan.actions.length,
  });

  try {
    for (let i = 0; i < plan.actions.length; i++) {
      if (signal.aborted) throw new AbortError();

      const action = plan.actions[i];

      events.emit("action:start", {
        actionId: action.id,
        index: i,
        total: plan.actions.length,
      });

      try {
        await executeAction({
          page,
          context,
          action,
          actionIndex: i,
          totalActions: plan.actions.length,
          baseUrl: config.baseUrl,
          retries: config.retries,
          events,
          signal,
          fast: true,
        });

        // Capture screenshot after successful action
        const screenshotPath = path.join(screenshotDir, `${action.id}.png`);
        await page.screenshot({ path: screenshotPath });

        for (let s = 0; s < action.steps.length; s++) {
          stepResults.push({
            actionId: action.id,
            actionIndex: i,
            stepIndex: s,
            stepType: action.steps[s].type,
            passed: true,
          });
        }

        passedActions++;

        events.emit("action:complete", {
          actionId: action.id,
          retriesUsed: 0,
        });
      } catch (err) {
        failedActions++;

        const errorMessage = err instanceof Error ? err.message : String(err);

        // Capture screenshot at failure point
        const failScreenshotPath = path.join(screenshotDir, `${action.id}-fail.png`);
        await page.screenshot({ path: failScreenshotPath }).catch(() => {});

        // Parse step index from StepError message if possible
        const stepMatch = errorMessage.match(/^Step (\d+)/);
        const failedStepIndex = stepMatch ? parseInt(stepMatch[1], 10) : action.steps.length - 1;

        // Mark steps that ran before the failure as passed
        for (let s = 0; s < failedStepIndex; s++) {
          stepResults.push({
            actionId: action.id,
            actionIndex: i,
            stepIndex: s,
            stepType: action.steps[s].type,
            passed: true,
          });
        }

        // Mark the failed step
        stepResults.push({
          actionId: action.id,
          actionIndex: i,
          stepIndex: failedStepIndex,
          stepType: action.steps[failedStepIndex]?.type ?? "unknown",
          passed: false,
          error: errorMessage,
          screenshot: failScreenshotPath,
        });

        events.emit("run:error", {
          error: err instanceof Error ? err : new Error(String(err)),
        });

        // Stop on first action failure
        break;
      }
    }

    const durationMs = Date.now() - startTime;

    events.emit("run:complete", {
      planName: plan.name,
      durationMs,
    });

    return {
      passed: failedActions === 0,
      totalActions: plan.actions.length,
      passedActions,
      failedActions,
      steps: stepResults,
      durationMs,
      screenshotDir,
    };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
