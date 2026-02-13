# Dolly Plan JSON Schema Reference

The plan JSON schema is defined in the `@nicmeriano/dolly-schema` package. When installed via npm, the schema source is inside `node_modules/@nicmeriano/dolly-schema/dist/`.

## Source of Truth

| Concern | Package Path |
|---|---|
| Step types (click, type, scroll, hover, wait, waitForSelector, select, navigate) | `@nicmeriano/dolly-schema` — `steps.ts` |
| Default values for all fields | `@nicmeriano/dolly-schema` — `defaults.ts` |
| PlanConfig, NormalizationConfig, CursorConfig, RetryConfig, ViewportSchema | `@nicmeriano/dolly-schema` — `config.ts` |
| Plan and Action schemas, validation function | `@nicmeriano/dolly-schema` — `plan.ts` |
| PostProductionConfig (cursor overlay + audio settings) | `@nicmeriano/dolly-schema` — `post-production.ts` |
| CursorKeyframe, CursorKeyframesFile (recorded cursor data) | `@nicmeriano/dolly-schema` — `cursor-keyframes.ts` |
| RecordingManifest (recording metadata) | `@nicmeriano/dolly-schema` — `manifest.ts` |

## Working Example

A complete 9-action demo plan is available at:

```
examples/test-demo.json
```

Use this as the reference pattern for structure, timing, and selector usage when generating new plans.

## Recording Directory Structure

Each recording produces a timestamped directory under `.dolly/recordings/<YYYYMMDD-HHmmss>/`:

```
.dolly/recordings/20260131-143022/
  plan.json                # Copy of the input plan
  raw.webm                 # Playwright video (no cursor)
  cursor-keyframes.json    # Cursor positions + click events
  post-production.json     # Cursor/audio settings (editable)
  manifest.json            # Recording metadata
  output.mp4               # Final exported video
```

## Post-Production Schema

The `postProduction` field on the plan (and `post-production.json` in the recording dir) controls ffmpeg post-production:

```
postProduction.cursor.enabled      boolean   (default: true)
postProduction.cursor.style        "dot"     (default: "dot")
postProduction.cursor.size         4-64      (default: 20)
postProduction.cursor.color        string    (default: "#000000")
postProduction.cursor.opacity      0-1       (default: 0.8)
postProduction.cursor.clickEffect  "scale" | "none" (default: "scale")
postProduction.audio.clickSound    boolean   (default: true)
postProduction.audio.volume        0-1       (default: 0.5)
postProduction.audio.customFile    string?   (optional path to WAV)
```

## Recording Scale (High-DPI)

```
config.scale    1 | 2 | 4    (default: 2) — deviceScaleFactor for high-DPI recording
```

The page lays out at the CSS viewport (e.g. 1280x720) but Playwright captures at `viewport × scale` physical pixels. At the default scale of 2, a 1280x720 viewport produces 2560x1440 output. The `cursor-keyframes.json` stores keyframe positions in CSS pixels and the `scale` value used during recording.
