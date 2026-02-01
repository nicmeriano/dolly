/**
 * Browser-safe cursor exports.
 *
 * This module contains only the cursor rendering code that works in both
 * browser and Node environments (no fs, child_process, etc.).
 * Import via `@dolly/core/cursor` in browser bundles.
 */
export { renderCursorFrame } from "./cursor-renderer.js";
export type { CursorRendererConfig, CursorRendererEnv } from "./cursor-renderer.js";

export { CURSOR_SHAPES, getCursorShape } from "./cursor-shapes.js";
export type { CursorShape, CursorShapePath } from "./cursor-shapes.js";

export { interpolateCursor, findKeyframeIndex } from "./cursor-interpolation.js";
export type { CursorPosition } from "./cursor-interpolation.js";

export { parseSvgCursor } from "./svg-cursor-parser.js";
