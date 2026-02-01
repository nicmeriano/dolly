import * as path from "node:path";
import * as fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { CursorKeyframesFile, PostProductionConfig } from "@dolly/schema";
import { runFfmpeg } from "../ffmpeg.js";
import { generateCursorImage } from "./cursor-image.js";
import { buildFilterComplex } from "./filter-builder.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLICK_SOUND_PATH = path.resolve(__dirname, "../../assets/click.wav");

export interface PostProductionOptions {
  rawVideoPath: string;
  keyframesFile: CursorKeyframesFile;
  postProdConfig: PostProductionConfig;
  outputPath: string;
  fps?: number;
  signal?: AbortSignal;
}

export interface PostProductionResult {
  outputPath: string;
}

/**
 * Run post-production on a raw recording: overlay cursor + mix click sounds.
 * Falls back to simple conversion when cursor is disabled and no keyframes.
 */
export async function postProduce(
  options: PostProductionOptions,
): Promise<PostProductionResult> {
  const {
    rawVideoPath,
    keyframesFile,
    postProdConfig,
    outputPath,
    fps = 25,
    signal,
  } = options;

  const outputDir = path.dirname(outputPath);
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

    // Verify click sound exists
    try {
      await fs.access(clickSoundPath);
    } catch {
      clickSoundPath = undefined;
    }
  }

  // Simple conversion fallback: no cursor, no audio
  if (!cursorEnabled && !hasClickSounds) {
    await runFfmpeg({
      args: [
        "-y",
        "-i", rawVideoPath,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-r", String(fps),
        "-an",
        outputPath,
      ],
      signal,
    });
    return { outputPath };
  }

  // Generate cursor image
  let cursorImagePath: string | undefined;
  if (cursorEnabled) {
    cursorImagePath = await generateCursorImage({
      size: postProdConfig.cursor.size,
      color: postProdConfig.cursor.color,
      opacity: postProdConfig.cursor.opacity,
      outputDir,
    });
  }

  // Build filter complex
  const { filterComplex, hasAudio } = buildFilterComplex(
    keyframesFile.keyframes,
    postProdConfig,
    videoDurationSec,
    clickSoundPath,
  );

  // Build ffmpeg command
  const args: string[] = ["-y"];

  // Input 0: raw video
  args.push("-i", rawVideoPath);

  // Input 1: cursor image (if cursor enabled)
  if (cursorImagePath) {
    args.push("-i", cursorImagePath);
  }

  // Input 2: click sound (if audio enabled)
  if (hasAudio && clickSoundPath) {
    args.push("-i", clickSoundPath);
  }

  // Filter complex
  if (filterComplex) {
    args.push("-filter_complex", filterComplex);
    args.push("-map", "[vout]");
    if (hasAudio) {
      args.push("-map", "[aout]");
    }
  }

  // Video encoding
  args.push(
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-r", String(fps),
  );

  // Audio encoding (if click sounds)
  if (hasAudio) {
    args.push("-c:a", "aac", "-b:a", "128k");
  } else {
    args.push("-an");
  }

  args.push(outputPath);

  await runFfmpeg({ args, signal });

  return { outputPath };
}
