import * as path from "node:path";
import * as fs from "node:fs/promises";
import { runFfmpeg } from "../ffmpeg.js";

export interface CursorImageOptions {
  size: number;
  color: string;
  opacity: number;
  outputDir: string;
}

/**
 * Parse hex color string to RGB values (0-255).
 */
function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace(/^#/, "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return { r, g, b };
}

/**
 * Generate a cursor circle PNG using ffmpeg's lavfi input.
 * Produces a soft-edged filled circle with configurable size, color, and opacity.
 *
 * Generates at 4x resolution with smooth alpha falloff, then downscales with
 * lanczos to produce high-quality antialiased edges matching canvas rendering.
 */
export async function generateCursorImage(
  options: CursorImageOptions,
): Promise<string> {
  const { size, color, opacity, outputDir } = options;
  const outputPath = path.join(outputDir, "cursor.png");

  // Always regenerate — settings may have changed since last export
  await fs.rm(outputPath, { force: true });

  const { r, g, b } = parseHexColor(color);
  const a = Math.round(opacity * 255);

  // Supersampling: generate at 4x resolution for smooth antialiased edges
  const superScale = 4;
  const genSize = size * superScale;
  const radius = genSize / 2;
  const fadeWidth = 2 * superScale; // 2 output-px of falloff
  const innerRadius = radius - fadeWidth;

  // geq filter: filled circle with smooth linear alpha falloff at the edge.
  // - Inside innerRadius: fully opaque
  // - innerRadius → radius: linear fade to 0
  // - Outside radius: transparent
  // Distance expression stored once via st(0,...) to avoid repeating sqrt
  const distStore = `st(0,sqrt((X-${radius})*(X-${radius})+(Y-${radius})*(Y-${radius})))`;
  const alphaExpr = `'${distStore}+if(lte(ld(0),${innerRadius}),${a},if(lte(ld(0),${radius}),${a}*(${radius}-ld(0))/${fadeWidth},0))-ld(0)*0'`;
  const geqFilter = `format=rgba,geq=r=${r}:g=${g}:b=${b}:a=${alphaExpr}`;

  // Downscale to target size with lanczos for crisp antialiasing
  const scaleFilter = `scale=${size}:${size}:flags=lanczos`;

  await runFfmpeg({
    args: [
      "-y",
      "-f", "lavfi",
      "-i", `color=c=black@0:s=${genSize}x${genSize}:d=0.04`,
      "-vf", `${geqFilter},${scaleFilter}`,
      "-frames:v", "1",
      "-update", "1",
      outputPath,
    ],
  });

  return outputPath;
}
