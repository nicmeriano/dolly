import { spawn, type ChildProcess } from "node:child_process";
import type { Page, CDPSession } from "playwright";
import { resolveFfmpegBinary } from "./ffmpeg.js";
import { FfmpegError } from "./errors.js";

export interface ScreencastRecorderOptions {
  page: Page;
  outputPath: string;
  fps: number;
  width: number;
  height: number;
}

/**
 * Records a page using Chrome DevTools Protocol's Page.startScreencast,
 * piping JPEG frames into ffmpeg for high-quality H.264 encoding.
 *
 * Replaces Playwright's built-in recordVideo which uses VP8 with
 * low-quality hardcoded defaults.
 *
 * CDP sends frames at irregular intervals (only on screen updates), so
 * we duplicate frames to maintain constant framerate aligned with wall
 * clock time — keeping the video in sync with cursor keyframes.
 */
export class ScreencastRecorder {
  private cdp: CDPSession | null = null;
  private ffmpeg: ChildProcess | null = null;
  private ffmpegStderr = "";
  private stopped = false;

  /** Total frames written to ffmpeg stdin */
  private framesWritten = 0;
  /** Wall-clock timestamp (ms) when recording started */
  startTimeMs = 0;
  /** Most recent decoded JPEG buffer for frame duplication */
  private lastFrameBuffer: Buffer | null = null;

  private readonly page: Page;
  private readonly outputPath: string;
  private readonly fps: number;
  private readonly width: number;
  private readonly height: number;

  constructor(options: ScreencastRecorderOptions) {
    this.page = options.page;
    this.outputPath = options.outputPath;
    this.fps = options.fps;
    this.width = options.width;
    this.height = options.height;
  }

  async start(): Promise<void> {
    const ffmpegBin = resolveFfmpegBinary();

    // Spawn ffmpeg: read JPEG frames from stdin, encode to H.264
    this.ffmpeg = spawn(ffmpegBin, [
      "-f", "image2pipe",
      "-vcodec", "mjpeg",
      "-r", String(this.fps),
      "-i", "pipe:0",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "4",
      "-pix_fmt", "yuv420p",
      "-r", String(this.fps),
      "-an",
      "-y",
      this.outputPath,
    ], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Collect ffmpeg stderr for error reporting
    this.ffmpegStderr = "";
    this.ffmpeg.stderr?.on("data", (chunk: Buffer) => {
      this.ffmpegStderr += chunk.toString();
    });

    this.ffmpeg.on("error", (err) => {
      if (!this.stopped) {
        console.error("[ScreencastRecorder] ffmpeg error:", err.message);
      }
    });

    // Open CDP session
    this.cdp = await this.page.context().newCDPSession(this.page);

    this.startTimeMs = Date.now();

    // Listen for screencast frames
    this.cdp.on("Page.screencastFrame", (params) => {
      if (this.stopped || !this.ffmpeg?.stdin?.writable) return;

      const frameBuffer = Buffer.from(params.data, "base64");

      // Calculate how many frames should have been written by now
      // to keep the video in sync with wall-clock time.
      // CDP sends frames at irregular intervals (only on screen updates),
      // often faster than target fps during activity. We must:
      //   - Skip frames when ahead of wall clock (CDP sending too fast)
      //   - Duplicate frames when behind wall clock (static screen gaps)
      const elapsedMs = Date.now() - this.startTimeMs;
      const expectedFrames = Math.round((elapsedMs / 1000) * this.fps);

      if (expectedFrames <= this.framesWritten) {
        // We've already written enough frames for this point in time.
        // Just save the latest image (so gap-fills use the newest content)
        // and ack without writing.
        this.lastFrameBuffer = frameBuffer;
        this.cdp?.send("Page.screencastFrameAck", {
          sessionId: params.sessionId,
        }).catch(() => {});
        return;
      }

      // Fill any gap with duplicates of the previous frame
      if (this.lastFrameBuffer) {
        const gap = expectedFrames - this.framesWritten - 1;
        for (let i = 0; i < gap; i++) {
          if (!this.ffmpeg?.stdin?.writable) break;
          this.ffmpeg.stdin.write(this.lastFrameBuffer);
          this.framesWritten++;
        }
      }

      // Write the current frame
      const canWrite = this.ffmpeg.stdin.write(frameBuffer);
      this.framesWritten++;
      this.lastFrameBuffer = frameBuffer;

      // Acknowledge the frame so Chrome sends the next one
      this.cdp?.send("Page.screencastFrameAck", {
        sessionId: params.sessionId,
      }).catch(() => {
        // Ignore ack errors if session is already detached
      });

      // Handle backpressure: if the write buffer is full, wait for drain
      if (!canWrite && this.ffmpeg.stdin) {
        this.cdp?.send("Page.stopScreencast").catch(() => {});
        this.ffmpeg.stdin.once("drain", () => {
          if (!this.stopped) {
            this.cdp?.send("Page.startScreencast", {
              format: "jpeg",
              quality: 100,
              maxWidth: this.width,
              maxHeight: this.height,
              everyNthFrame: 1,
            }).catch(() => {});
          }
        });
      }
    });

    // Start the screencast
    await this.cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 100,
      maxWidth: this.width,
      maxHeight: this.height,
      everyNthFrame: 1,
    });
  }

  async stop(): Promise<string> {
    if (this.stopped) return this.outputPath;
    this.stopped = true;

    // Fill remaining frames up to the final wall-clock time
    if (this.lastFrameBuffer && this.ffmpeg?.stdin?.writable) {
      const elapsedMs = Date.now() - this.startTimeMs;
      const expectedFrames = Math.round((elapsedMs / 1000) * this.fps);
      const gap = expectedFrames - this.framesWritten;
      for (let i = 0; i < gap; i++) {
        if (!this.ffmpeg.stdin.writable) break;
        this.ffmpeg.stdin.write(this.lastFrameBuffer);
        this.framesWritten++;
      }
    }

    // Stop the screencast
    if (this.cdp) {
      await this.cdp.send("Page.stopScreencast").catch(() => {});
      await this.cdp.detach().catch(() => {});
      this.cdp = null;
    }

    // Close ffmpeg stdin and wait for it to finish encoding
    if (this.ffmpeg) {
      await new Promise<void>((resolve, reject) => {
        const proc = this.ffmpeg!;

        proc.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new FfmpegError(
              `ffmpeg screencast encoder exited with code ${code}`,
              this.ffmpegStderr,
            ));
          }
        });

        proc.on("error", (err) => {
          reject(new FfmpegError(
            `ffmpeg screencast encoder error: ${err.message}`,
            "",
            { cause: err },
          ));
        });

        // End stdin to signal ffmpeg to finalize
        proc.stdin?.end();
      });

      this.ffmpeg = null;
    }

    return this.outputPath;
  }
}
