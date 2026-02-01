interface Keyframe {
  x: number;
  y: number;
  timestamp: number;
  type: "move" | "click";
}

/**
 * Binary search for the keyframe segment containing the given time (in ms).
 * Returns the index of the last keyframe <= time.
 */
export function findKeyframeIndex(keyframes: Keyframe[], timeMs: number): number {
  if (keyframes.length === 0) return -1;
  if (timeMs <= keyframes[0].timestamp) return 0;
  if (timeMs >= keyframes[keyframes.length - 1].timestamp) return keyframes.length - 1;

  let low = 0;
  let high = keyframes.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (keyframes[mid].timestamp <= timeMs) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

export interface CursorPosition {
  x: number;
  y: number;
  clicking: boolean;
}

/**
 * Interpolate cursor position at a given time.
 * Returns null if cursor should be hidden (before first keyframe).
 */
export function interpolateCursor(
  keyframes: Keyframe[],
  timeMs: number,
  clickDurationMs: number = 100,
): CursorPosition | null {
  if (keyframes.length === 0) return null;

  // Before first keyframe: cursor hidden
  if (timeMs < keyframes[0].timestamp) return null;

  // After last keyframe: hold at final position
  if (timeMs >= keyframes[keyframes.length - 1].timestamp) {
    const last = keyframes[keyframes.length - 1];
    const clicking = isClickActive(keyframes, timeMs, clickDurationMs);
    return { x: last.x, y: last.y, clicking };
  }

  const idx = findKeyframeIndex(keyframes, timeMs);
  const current = keyframes[idx];
  const next = keyframes[idx + 1];

  if (!next) {
    const clicking = isClickActive(keyframes, timeMs, clickDurationMs);
    return { x: current.x, y: current.y, clicking };
  }

  // Linear interpolation between current and next
  const duration = next.timestamp - current.timestamp;
  const progress = duration > 0 ? (timeMs - current.timestamp) / duration : 1;
  const t = Math.max(0, Math.min(1, progress));

  const x = current.x + (next.x - current.x) * t;
  const y = current.y + (next.y - current.y) * t;
  const clicking = isClickActive(keyframes, timeMs, clickDurationMs);

  return { x, y, clicking };
}

function isClickActive(
  keyframes: Keyframe[],
  timeMs: number,
  clickDurationMs: number,
): boolean {
  for (const kf of keyframes) {
    if (kf.type !== "click") continue;
    if (timeMs >= kf.timestamp && timeMs <= kf.timestamp + clickDurationMs) {
      return true;
    }
    // Keyframes are sorted by time — skip past ones
    if (kf.timestamp > timeMs + clickDurationMs) break;
  }
  return false;
}
