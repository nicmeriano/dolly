import { runFfmpeg } from "./ffmpeg.js";

export interface ConvertToMp4Options {
  inputPath: string;
  fps?: number;
  crf?: number;
  signal?: AbortSignal;
}

export async function convertToMp4(options: ConvertToMp4Options): Promise<string> {
  const { inputPath, fps = 25, crf = 18, signal } = options;
  const outputPath = inputPath.replace(/\.webm$/, ".mp4");

  await runFfmpeg({
    args: [
      "-y",
      "-i", inputPath,
      "-c:v", "libx264",
      "-preset", "medium",
      "-crf", String(crf),
      "-pix_fmt", "yuv420p",
      "-r", String(fps),
      "-an",
      outputPath,
    ],
    signal,
  });

  return outputPath;
}
