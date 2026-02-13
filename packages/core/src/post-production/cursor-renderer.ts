import type { CursorKeyframe, PostProductionCursor } from "@nicmeriano/dolly-schema";
import type { CursorShape } from "./cursor-shapes.js";
import { interpolateCursor } from "./cursor-interpolation.js";

export interface CursorRendererConfig {
  cursor: PostProductionCursor;
  keyframes: CursorKeyframe[];
  shape: CursorShape;
  clickDurationMs: number;
}

export interface CursorRendererEnv {
  Path2D: typeof Path2D;
}

/**
 * Render a single cursor frame onto a canvas context.
 *
 * This is the single source of truth for all cursor drawing — used by both
 * Studio preview (browser Canvas) and export (@napi-rs/canvas).
 *
 * Path2D is injected via `env` rather than referenced as a global, so the
 * same function works in browsers (native Path2D) and Node (@napi-rs/canvas
 * Path2D) without any global mutation.
 *
 * The function is deterministic: same (env, config, timeMs, dimensions) → same output.
 */
export function renderCursorFrame(
  ctx: CanvasRenderingContext2D,
  env: CursorRendererEnv,
  config: CursorRendererConfig,
  timeMs: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  // Full reset to prevent state bleed between frames
  ctx.globalCompositeOperation = "source-over";
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (!config.cursor.enabled || config.keyframes.length === 0) return;

  const pos = interpolateCursor(config.keyframes, timeMs, config.clickDurationMs);
  if (!pos) return;

  const { shape, cursor } = config;
  const isClicking = pos.clicking && cursor.clickEffect === "scale";
  const drawSize = isClicking ? cursor.size * 0.75 : cursor.size;

  // Scale from viewBox coordinates to draw size
  const scale = drawSize / shape.viewBox[2];

  // Position cursor so hotspot aligns with interpolated position
  const dx = pos.x - drawSize * shape.hotspot.x;
  const dy = pos.y - drawSize * shape.hotspot.y;

  ctx.save();
  ctx.globalAlpha = cursor.opacity;
  ctx.translate(dx, dy);
  ctx.scale(scale, scale);

  // Offset by viewBox origin
  ctx.translate(-shape.viewBox[0], -shape.viewBox[1]);

  for (const p of shape.paths) {
    const path2d = new env.Path2D(p.d);

    if (p.fill) {
      ctx.fillStyle = cursor.color;
      ctx.fill(path2d);
    }

    if (p.stroke) {
      ctx.strokeStyle = cursor.color;
      ctx.lineWidth = shape.strokeWidth;
      ctx.lineCap = shape.strokeLinecap;
      ctx.lineJoin = shape.strokeLinejoin;
      ctx.stroke(path2d);
    }
  }

  ctx.restore();
}
