import type { CursorKeyframe, PostProductionConfig } from "@dolly/schema";

export interface KeyframeSegment {
  startTime: number; // seconds
  endTime: number;   // seconds
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * Convert cursor keyframes to segments for interpolation.
 * Each segment represents the motion between two consecutive keyframes.
 */
export function keyframesToSegments(keyframes: CursorKeyframe[]): KeyframeSegment[] {
  if (keyframes.length < 2) return [];

  const segments: KeyframeSegment[] = [];
  for (let i = 0; i < keyframes.length - 1; i++) {
    segments.push({
      startTime: keyframes[i].timestamp / 1000,
      endTime: keyframes[i + 1].timestamp / 1000,
      startX: keyframes[i].x,
      startY: keyframes[i].y,
      endX: keyframes[i + 1].x,
      endY: keyframes[i + 1].y,
    });
  }
  return segments;
}

/**
 * Build a click detection expression.
 * Returns an expression that evaluates to >0 during click animation windows.
 */
export function buildClickExpr(
  clickKeyframes: CursorKeyframe[],
  durationSec: number = 0.1,
): string {
  if (clickKeyframes.length === 0) return "0";

  const terms = clickKeyframes.map((kf) => {
    const tc = kf.timestamp / 1000;
    return `between(t,${tc.toFixed(4)},${(tc + durationSec).toFixed(4)})`;
  });

  // Combine with addition — any click active makes sum > 0
  return `gt(${terms.join("+")},0)`;
}

/**
 * Build the overlay X position expression.
 * Uses linear interpolation between keyframes with nested if/between.
 */
export function buildOverlayXExpr(
  segments: KeyframeSegment[],
  clickKeyframes: CursorKeyframe[],
  cursorSize: number,
): string {
  if (segments.length === 0) return "-100";

  const clickExpr = buildClickExpr(clickKeyframes);
  const baseExpr = buildPositionExpr(segments, "x");

  // During click animation, cursor scales to 0.75 — offset by scaledSize/2 to stay centered
  if (clickKeyframes.length > 0) {
    return `if(${clickExpr},(${baseExpr})-${cursorSize}*0.375,(${baseExpr})-${cursorSize}/2)`;
  }
  return `(${baseExpr})-${cursorSize}/2`;
}

/**
 * Build the overlay Y position expression.
 */
export function buildOverlayYExpr(
  segments: KeyframeSegment[],
  clickKeyframes: CursorKeyframe[],
  cursorSize: number,
): string {
  if (segments.length === 0) return "-100";

  const clickExpr = buildClickExpr(clickKeyframes);
  const baseExpr = buildPositionExpr(segments, "y");

  if (clickKeyframes.length > 0) {
    return `if(${clickExpr},(${baseExpr})-${cursorSize}*0.375,(${baseExpr})-${cursorSize}/2)`;
  }
  return `(${baseExpr})-${cursorSize}/2`;
}

/**
 * Build a position expression (x or y) using nested if(between(...), lerp, ...) chains.
 * For large keyframe sets, uses segmented groups with ffmpeg's st()/ld() variables.
 */
function buildPositionExpr(
  segments: KeyframeSegment[],
  axis: "x" | "y",
): string {
  // Simple nested if/between works reliably for typical recordings (<200 segments).
  // The segmented st()/ld() approach is only needed for very long recordings
  // where ffmpeg's expression nesting limit becomes an issue.
  if (segments.length <= 200) {
    return buildSimplePositionExpr(segments, axis);
  }
  return buildSegmentedPositionExpr(segments, axis);
}

function buildSimplePositionExpr(
  segments: KeyframeSegment[],
  axis: "x" | "y",
): string {
  const lastKf = segments[segments.length - 1];
  const holdValue = axis === "x" ? lastKf.endX : lastKf.endY;

  // Build from last segment to first (nested if chain)
  let expr = String(holdValue);

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    const start = axis === "x" ? seg.startX : seg.startY;
    const end = axis === "x" ? seg.endX : seg.endY;
    const duration = seg.endTime - seg.startTime;

    // Linear interpolation: start + (end - start) * (t - startTime) / duration
    const lerp =
      duration > 0
        ? `${start}+(${end - start})*(t-${seg.startTime.toFixed(4)})/${duration.toFixed(4)}`
        : String(end);

    expr = `if(between(t,${seg.startTime.toFixed(4)},${seg.endTime.toFixed(4)}),${lerp},${expr})`;
  }

  // Before first keyframe: cursor off-screen
  const firstSeg = segments[0];
  expr = `if(lt(t,${firstSeg.startTime.toFixed(4)}),-100,${expr})`;

  return expr;
}

function buildSegmentedPositionExpr(
  segments: KeyframeSegment[],
  axis: "x" | "y",
): string {
  // Split segments into groups of ~20, use st()/ld() for each group
  const groupSize = 20;
  const groups: KeyframeSegment[][] = [];

  for (let i = 0; i < segments.length; i += groupSize) {
    groups.push(segments.slice(i, i + groupSize));
  }

  // Use up to 10 st/ld variables (ffmpeg limit)
  const maxVars = Math.min(groups.length, 10);
  const lastKf = segments[segments.length - 1];
  const holdValue = axis === "x" ? lastKf.endX : lastKf.endY;

  const parts: string[] = [];
  for (let g = 0; g < maxVars; g++) {
    const group = groups[g];
    const groupFirst = group[0];
    const groupLast = group[group.length - 1];

    // Build inner expression for this group
    let inner = String(holdValue);
    for (let i = group.length - 1; i >= 0; i--) {
      const seg = group[i];
      const start = axis === "x" ? seg.startX : seg.startY;
      const end = axis === "x" ? seg.endX : seg.endY;
      const duration = seg.endTime - seg.startTime;
      const lerp =
        duration > 0
          ? `${start}+(${end - start})*(t-${seg.startTime.toFixed(4)})/${duration.toFixed(4)}`
          : String(end);
      inner = `if(between(t,${seg.startTime.toFixed(4)},${seg.endTime.toFixed(4)}),${lerp},${inner})`;
    }

    // Store result in variable g: st(g, inner_expr)
    parts.push(
      `st(${g},if(between(t,${groupFirst.startTime.toFixed(4)},${groupLast.endTime.toFixed(4)}),${inner},ld(${g})))`,
    );
  }

  // Chain: compute all st(), then read them with ld() priority
  const stChain = parts.join("+");
  let ldExpr = String(holdValue);
  for (let g = maxVars - 1; g >= 0; g--) {
    const group = groups[g];
    const groupFirst = group[0];
    const groupLast = group[group.length - 1];
    ldExpr = `if(between(t,${groupFirst.startTime.toFixed(4)},${groupLast.endTime.toFixed(4)}),ld(${g}),${ldExpr})`;
  }

  const firstSeg = segments[0];
  return `if(lt(t,${firstSeg.startTime.toFixed(4)}),-100,${stChain}*0+${ldExpr})`;
}

export interface FilterComplexResult {
  filterComplex: string;
  hasAudio: boolean;
}

/**
 * Build the complete ffmpeg filter_complex string for cursor overlay and click sounds.
 */
export function buildFilterComplex(
  keyframes: CursorKeyframe[],
  config: PostProductionConfig,
  videoDurationSec: number,
  clickSoundPath?: string,
): FilterComplexResult {
  const cursorEnabled = config.cursor.enabled && keyframes.length > 0;
  const clickKeyframes = keyframes.filter((kf) => kf.type === "click");
  const hasClickSound = config.audio.clickSound && clickKeyframes.length > 0 && !!clickSoundPath;

  if (!cursorEnabled && !hasClickSound) {
    return { filterComplex: "", hasAudio: false };
  }

  const filters: string[] = [];
  const cursorSize = config.cursor.size;

  if (cursorEnabled) {
    const segments = keyframesToSegments(keyframes);

    // Scale cursor input for click animation
    const clickExpr = buildClickExpr(clickKeyframes);
    const clickScaleSize = Math.round(cursorSize * 0.75);

    if (clickKeyframes.length > 0 && config.cursor.clickEffect === "scale") {
      // Single-quote w/h expressions to prevent ffmpeg from parsing commas as filter separators
      filters.push(
        `[1:v]scale=w='if(${clickExpr},${clickScaleSize},${cursorSize})':h='if(${clickExpr},${clickScaleSize},${cursorSize})':flags=lanczos:eval=frame[cursor_scaled]`,
      );
    } else {
      filters.push(`[1:v]copy[cursor_scaled]`);
    }

    // Build overlay position expressions
    const xExpr = buildOverlayXExpr(segments, clickKeyframes, cursorSize);
    const yExpr = buildOverlayYExpr(segments, clickKeyframes, cursorSize);

    filters.push(
      `[0:v][cursor_scaled]overlay=x='${xExpr}':y='${yExpr}':eval=frame:format=auto[vout]`,
    );
  } else {
    filters.push(`[0:v]copy[vout]`);
  }

  // Audio: click sound mixing
  if (hasClickSound) {
    const n = clickKeyframes.length;

    if (n === 1) {
      const delayMs = Math.round(clickKeyframes[0].timestamp);
      filters.push(
        `[2:a]adelay=${delayMs}|${delayMs}[d0]`,
        `[d0]volume=${config.audio.volume},apad=whole_dur=${videoDurationSec.toFixed(4)}[aout]`,
      );
    } else {
      // Split audio into N copies
      const splitOutputs = clickKeyframes.map((_, i) => `[c${i}]`).join("");
      filters.push(`[2:a]asplit=${n}${splitOutputs}`);

      // Delay each copy to its click time
      const delayOutputs: string[] = [];
      for (let i = 0; i < n; i++) {
        const delayMs = Math.round(clickKeyframes[i].timestamp);
        filters.push(`[c${i}]adelay=${delayMs}|${delayMs}[d${i}]`);
        delayOutputs.push(`[d${i}]`);
      }

      // Mix all delayed copies
      filters.push(
        `${delayOutputs.join("")}amix=inputs=${n}:normalize=0[clicks]`,
        `[clicks]volume=${config.audio.volume},apad=whole_dur=${videoDurationSec.toFixed(4)}[aout]`,
      );
    }
  }

  return {
    filterComplex: filters.join(";"),
    hasAudio: hasClickSound,
  };
}
