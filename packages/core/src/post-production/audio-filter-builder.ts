import type { CursorKeyframe } from "@nicmeriano/dolly-schema";

export interface AudioFilterResult {
  filters: string[];
  hasAudio: boolean;
}

/**
 * Build ffmpeg audio filter expressions for click sound mixing.
 *
 * Generates asplit/adelay/amix/volume/apad filters that mix a single click
 * sound file at each click keyframe timestamp.
 *
 * @param clickKeyframes - Keyframes with type "click"
 * @param audioInputIndex - The ffmpeg input index for the click sound file
 * @param volume - Volume level 0-1
 * @param videoDurationSec - Total video duration for apad
 */
export function buildAudioFilters(
  clickKeyframes: CursorKeyframe[],
  audioInputIndex: number,
  volume: number,
  videoDurationSec: number,
): AudioFilterResult {
  if (clickKeyframes.length === 0) {
    return { filters: [], hasAudio: false };
  }

  const n = clickKeyframes.length;
  const inputLabel = `[${audioInputIndex}:a]`;
  const filters: string[] = [];

  if (n === 1) {
    const delayMs = Math.round(clickKeyframes[0].timestamp);
    filters.push(
      `${inputLabel}adelay=${delayMs}|${delayMs}[d0]`,
      `[d0]volume=${volume},apad=whole_dur=${videoDurationSec.toFixed(4)}[aout]`,
    );
  } else {
    // Split audio into N copies
    const splitOutputs = clickKeyframes.map((_, i) => `[c${i}]`).join("");
    filters.push(`${inputLabel}asplit=${n}${splitOutputs}`);

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
      `[clicks]volume=${volume},apad=whole_dur=${videoDurationSec.toFixed(4)}[aout]`,
    );
  }

  return { filters, hasAudio: true };
}
