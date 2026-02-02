import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { CursorKeyframesFile, PostProductionConfig, RecordingManifest } from "@dolly/schema";
import { postProduce } from "@dolly/core";

export interface ExportResult {
  outputPath: string;
}

export async function runExport(
  recordingDir: string,
  onProgress: (message: string) => void,
  outputFilename: string = "output.mp4",
): Promise<ExportResult> {
  onProgress("Reading recording data...");

  const [keyframesRaw, postProdRaw, manifestRaw] = await Promise.all([
    fs.readFile(path.join(recordingDir, "cursor-keyframes.json"), "utf-8"),
    fs.readFile(path.join(recordingDir, "post-production.json"), "utf-8"),
    fs.readFile(path.join(recordingDir, "manifest.json"), "utf-8"),
  ]);

  const keyframesFile: CursorKeyframesFile = JSON.parse(keyframesRaw);
  const postProdConfig: PostProductionConfig = JSON.parse(postProdRaw);
  const manifest: RecordingManifest = JSON.parse(manifestRaw);

  const rawVideoName = manifest.rawVideo ?? "raw.webm";
  const rawVideoPath = path.join(recordingDir, rawVideoName);
  const outputPath = path.join(recordingDir, outputFilename);

  onProgress("Rendering cursor overlay frames...");

  await postProduce({
    rawVideoPath,
    keyframesFile,
    postProdConfig,
    outputPath,
    fps: keyframesFile.fps,
    onProgress: (frame, totalFrames) => {
      if (frame % 30 === 0 || frame === totalFrames) {
        onProgress(`Rendering frame ${frame}/${totalFrames}...`);
      }
    },
  });

  onProgress("Export complete");

  return { outputPath };
}
