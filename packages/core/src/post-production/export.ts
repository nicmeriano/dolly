import * as path from "node:path";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import type { CursorKeyframesFile, PostProductionConfig } from "@nicmeriano/dolly-schema";
import { resolveFfmpegBinary } from "../ffmpeg.js";
import { FfmpegError } from "../errors.js";
import { getCursorShape } from "./cursor-shapes.js";
import { parseSvgCursor } from "./svg-cursor-parser.js";
import { renderCursorFrame } from "./cursor-renderer.js";
import type { CursorRendererConfig } from "./cursor-renderer.js";
import { buildAudioFilters } from "./audio-filter-builder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLICK_SOUND_PATH = path.resolve(__dirname, "../../assets/click.wav");

export interface PostProductionOptions {
  rawVideoPath: string;
  keyframesFile: CursorKeyframesFile;
  postProdConfig: PostProductionConfig;
  outputPath: string;
  fps?: number;
  signal?: AbortSignal;
  onProgress?: (frame: number, totalFrames: number) => void;
}

export interface PostProductionResult {
  outputPath: string;
}

/**
 * Run post-production on a raw recording: overlay cursor + mix click sounds.
 *
 * Renders cursor overlay frames via Canvas Path2D (using @napi-rs/canvas in
 * Node) and pipes them as PNG images to ffmpeg for compositing with the raw
 * video. Audio click sounds are mixed via ffmpeg audio filters.
 */
export async function postProduce(
  options: PostProductionOptions,
): Promise<PostProductionResult> {
  const {
    rawVideoPath,
    keyframesFile,
    postProdConfig,
    outputPath,
    fps = 30,
    signal,
    onProgress,
  } = options;

  const videoDurationSec = keyframesFile.durationMs / 1000;
  const cursorEnabled = postProdConfig.cursor.enabled && keyframesFile.keyframes.length > 0;
  const clickKeyframes = keyframesFile.keyframes.filter((kf) => kf.type === "click");
  const hasClickSounds = postProdConfig.audio.clickSound && clickKeyframes.length > 0;

  // Resolve click sound file
  let clickSoundPath: string | undefined;
  if (hasClickSounds) {
    clickSoundPath = postProdConfig.audio.customFile
      ? path.resolve(postProdConfig.audio.customFile)
      : CLICK_SOUND_PATH;

    try {
      await fs.access(clickSoundPath);
    } catch {
      clickSoundPath = undefined;
    }
  }

  const hasAudio = !!clickSoundPath && hasClickSounds;

  // Simple conversion fallback: no cursor, no audio
  if (!cursorEnabled && !hasAudio) {
    const ffmpegBin = resolveFfmpegBinary();
    await runFfmpegSimple(ffmpegBin, [
      "-y",
      "-i", rawVideoPath,
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-r", String(fps),
      "-an",
      outputPath,
    ], signal);
    return { outputPath };
  }

  // Resolve cursor shape
  let shape = getCursorShape(postProdConfig.cursor.style);
  if (postProdConfig.cursor.customSvg) {
    try {
      const svgContent = await fs.readFile(
        path.resolve(postProdConfig.cursor.customSvg),
        "utf-8",
      );
      shape = parseSvgCursor(svgContent);
    } catch {
      // Fall back to built-in shape on parse error
    }
  }

  const { w, h } = keyframesFile.viewport;
  const totalFrames = Math.ceil(videoDurationSec * fps);

  // Dynamic import of @napi-rs/canvas for headless Canvas
  const napiCanvas = await import("@napi-rs/canvas");
  const overlayCanvas = napiCanvas.createCanvas(w, h);
  const ctx = overlayCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  const env = { Path2D: napiCanvas.Path2D as unknown as typeof Path2D };

  const rendererConfig: CursorRendererConfig = {
    cursor: postProdConfig.cursor,
    keyframes: keyframesFile.keyframes,
    shape,
    clickDurationMs: 100,
  };

  // Build ffmpeg command
  const ffmpegBin = resolveFfmpegBinary();
  const args: string[] = ["-y"];

  // Input 0: raw video
  args.push("-i", rawVideoPath);

  // Input 1: cursor overlay frames from pipe
  args.push(
    "-f", "image2pipe",
    "-framerate", String(fps),
    "-i", "pipe:0",
  );

  // Input 2: click sound (if audio enabled)
  if (hasAudio && clickSoundPath) {
    args.push("-i", clickSoundPath);
  }

  // Filter complex: overlay + optional audio
  const filterParts: string[] = [];

  // Video overlay
  filterParts.push("[0:v][1:v]overlay=0:0:format=auto[vout]");

  // Audio filters
  if (hasAudio && clickSoundPath) {
    const audioInputIndex = 2;
    const { filters } = buildAudioFilters(
      clickKeyframes,
      audioInputIndex,
      postProdConfig.audio.volume,
      videoDurationSec,
    );
    filterParts.push(...filters);
  }

  args.push("-filter_complex", filterParts.join(";"));
  args.push("-map", "[vout]");

  if (hasAudio) {
    args.push("-map", "[aout]");
  }

  // Video encoding
  args.push(
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-r", String(fps),
  );

  // Audio encoding
  if (hasAudio) {
    args.push("-c:a", "aac", "-b:a", "128k");
  } else {
    args.push("-an");
  }

  args.push(outputPath);

  // Spawn ffmpeg with stdin pipe for cursor frames
  const proc = spawn(ffmpegBin, args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stderr = "";
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  if (signal) {
    const onAbort = () => {
      proc.kill("SIGTERM");
    };
    signal.addEventListener("abort", onAbort, { once: true });
    proc.on("close", () => signal.removeEventListener("abort", onAbort));
  }

  // Pipe cursor overlay frames to ffmpeg stdin
  const stdin = proc.stdin!;

  for (let frame = 0; frame < totalFrames; frame++) {
    if (signal?.aborted) break;

    const timeMs = frame * (1000 / fps);
    renderCursorFrame(ctx, env, rendererConfig, timeMs, w, h);

    const pngBuffer = overlayCanvas.toBuffer("image/png");

    // Write with backpressure handling
    const canWrite = stdin.write(pngBuffer);
    if (!canWrite) {
      await new Promise<void>((resolve) => stdin.once("drain", resolve));
    }

    onProgress?.(frame + 1, totalFrames);
  }

  stdin.end();

  // Wait for ffmpeg to finish
  await new Promise<void>((resolve, reject) => {
    proc.on("error", (err: Error) => {
      reject(new FfmpegError(`Failed to spawn ffmpeg: ${err.message}`, stderr, { cause: err }));
    });

    proc.on("close", (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new FfmpegError(`ffmpeg exited with code ${code}`, stderr));
      }
    });
  });

  return { outputPath };
}

/**
 * Run a simple ffmpeg command (no piping).
 */
function runFfmpegSimple(
  ffmpegBin: string,
  args: string[],
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    if (signal) {
      const onAbort = () => {
        proc.kill("SIGTERM");
        reject(new FfmpegError("ffmpeg aborted", stderr));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      proc.on("close", () => signal.removeEventListener("abort", onAbort));
    }

    proc.on("error", (err: Error) => {
      reject(new FfmpegError(`Failed to spawn ffmpeg: ${err.message}`, stderr, { cause: err }));
    });

    proc.on("close", (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new FfmpegError(`ffmpeg exited with code ${code}`, stderr));
      }
    });
  });
}
