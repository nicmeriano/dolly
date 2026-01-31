import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { FfmpegError } from "./errors.js";

let resolvedFfmpegPath: string | undefined;

export function resolveFfmpegBinary(): string {
  if (resolvedFfmpegPath) return resolvedFfmpegPath;

  // 1. Environment variable
  if (process.env.FFMPEG_PATH) {
    resolvedFfmpegPath = process.env.FFMPEG_PATH;
    return resolvedFfmpegPath;
  }

  // 2. Try @ffmpeg-installer/ffmpeg (optional peer dep)
  try {
    const req = createRequire(import.meta.url);
    const installer = req("@ffmpeg-installer/ffmpeg") as { path?: string };
    if (installer?.path) {
      resolvedFfmpegPath = installer.path;
      return resolvedFfmpegPath;
    }
  } catch {
    // Not installed, fall through
  }

  // 3. Fall back to PATH
  resolvedFfmpegPath = "ffmpeg";
  return resolvedFfmpegPath;
}

export interface FfmpegRunOptions {
  args: string[];
  signal?: AbortSignal;
}

export async function runFfmpeg(options: FfmpegRunOptions): Promise<string> {
  const { args, signal } = options;
  const ffmpegBin = resolveFfmpegBinary();

  return new Promise<string>((resolve, reject) => {
    const proc = spawn(ffmpegBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    let stdout = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

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
      reject(
        new FfmpegError(
          `Failed to spawn ffmpeg: ${err.message}`,
          stderr,
          { cause: err },
        ),
      );
    });

    proc.on("close", (code: number | null) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new FfmpegError(
            `ffmpeg exited with code ${code}`,
            stderr,
          ),
        );
      }
    });
  });
}
