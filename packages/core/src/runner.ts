import * as path from "node:path";
import * as fs from "node:fs/promises";
import { chromium } from "playwright";
import type { Plan, RecordingManifest } from "@dolly/schema";
import { executeAction } from "./action-recorder.js";
import { buildInitScript } from "./normalization.js";
import { convertToMp4 } from "./stitcher.js";
import { writeManifest } from "./manifest.js";
import { TypedEmitter } from "./events.js";
import { AbortError } from "./errors.js";

export interface RunOptions {
  plan: Plan;
  headed?: boolean;
  outputDir?: string;
  format?: "mp4" | "webm";
  signal?: AbortSignal;
}

export interface RunResult {
  manifest: RecordingManifest;
  outputDir: string;
}

export interface RunHandle {
  result: Promise<RunResult>;
  events: TypedEmitter;
  abort: () => void;
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

async function executeRun(
  options: RunOptions,
  events: TypedEmitter,
  signal: AbortSignal,
): Promise<RunResult> {
  const { plan, headed = false } = options;
  const config = plan.config;
  const outputDir = path.resolve(options.outputDir ?? config.outputDir);
  const outputFormat = options.format ?? config.outputFormat;

  await fs.mkdir(outputDir, { recursive: true });

  const videoDir = path.join(outputDir, "_tmp_video");
  await fs.mkdir(videoDir, { recursive: true });

  const manifest: RecordingManifest = {
    planName: plan.name,
    startedAt: new Date().toISOString(),
    completedAt: "",
    video: null,
    durationSeconds: 0,
    actions: [],
  };

  const browser = await chromium.launch({ headless: !headed });

  const context = await browser.newContext({
    viewport: config.viewport,
    locale: config.normalization.locale,
    timezoneId: config.normalization.timezone,
    colorScheme: config.normalization.colorScheme,
    reducedMotion: config.normalization.reducedMotion,
    recordVideo: {
      dir: videoDir,
      size: config.viewport,
    },
  });

  const page = await context.newPage();
  await page.addInitScript(buildInitScript(config.normalization));

  const startTime = Date.now();

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
      });

      manifest.actions.push({
        actionId: plan.actions[i].id,
        retriesUsed: result.retriesUsed,
      });
    }

    const durationMs = Date.now() - startTime;
    manifest.durationSeconds = durationMs / 1000;

    // Close context to finalize the video
    const videoPath = await page.video()?.path();
    await context.close();

    if (!videoPath) {
      throw new Error("No video file produced by Playwright");
    }

    // Move raw webm to output dir
    const rawVideoName = `${plan.name}.webm`;
    const rawVideoPath = path.join(outputDir, rawVideoName);
    await fs.rename(videoPath, rawVideoPath);
    manifest.video = rawVideoName;

    // Convert to mp4 if requested
    if (outputFormat === "mp4") {
      events.emit("convert:start", { inputPath: rawVideoPath });

      const mp4Path = await convertToMp4({
        inputPath: rawVideoPath,
        fps: config.fps,
        signal,
      });

      manifest.video = path.basename(mp4Path);
      events.emit("convert:complete", { outputPath: mp4Path });
    }

    manifest.completedAt = new Date().toISOString();
    await writeManifest(outputDir, manifest);

    events.emit("run:complete", {
      planName: plan.name,
      durationMs,
    });

    return { manifest, outputDir };
  } catch (err) {
    // Ensure context is closed on failure
    await context.close().catch(() => {});

    manifest.completedAt = new Date().toISOString();
    manifest.durationSeconds = (Date.now() - startTime) / 1000;
    await writeManifest(outputDir, manifest).catch(() => {});

    throw err;
  } finally {
    await browser.close().catch(() => {});
    await fs.rm(videoDir, { recursive: true, force: true }).catch(() => {});
  }
}
