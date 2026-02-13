---
name: dolly
description: Record cinematic product demo videos from web apps. Use when the user wants to create a Dolly recording plan by exploring a live web app with agent-browser, then record the demo. Invoked via `/dolly <url> <prompt>`.
user_invocable: true
allowed-tools: Bash(agent-browser *), Bash(dolly *), Bash(node *), Bash(which *), Bash(npm *), Bash(npx *), Bash(pnpm *), Bash(ffmpeg *), Bash(readlink *), Bash(curl *), Bash(pkill *), Bash(mkdir *), Bash(python3 *), Bash(find *), Read, Write, Glob, Grep, WebFetch
---

# Dolly — Cinematic Product Demo Recorder

## Commands

- `/dolly <url> <prompt>` — Full workflow: explore, plan, test, record, and open studio
- `/dolly plan <url> <prompt>` — Explore + generate plan only
- `/dolly record <plan.json>` — Record from existing plan
- `/dolly studio [dir]` — Open post-production studio for a recording
- `/dolly export [dir]` — Render final video with current studio settings

## Prerequisites

Run before starting: `which agent-browser && which dolly && which ffmpeg`

- **agent-browser**: If missing → `npm i -g agent-browser && agent-browser install`
- **dolly**: Should be globally available after `npm install -g @nicmeriano/dolly`
- **ffmpeg**: Required for mp4 output and post-production

Stop and report if any are missing.

## Workflow

### 1. Parse intent

Extract from user input:
- **Target URL** → `config.baseUrl`
- **Demo flow** → what journey to record
- **Demo name** → kebab-case (e.g., `acme-login-flow`)
- **Viewport** → default `1280x720`
- **Scale** → default `2` (high-DPI). Viewport `1280x720` at scale 2 → `2560x1440` physical output

If ambiguous, ask the user to clarify the flow before proceeding.

### 2. Explore with agent-browser

Walk the app page-by-page. Derive **Playwright role locators** from the snapshot tree.

```bash
agent-browser open <url>
agent-browser snapshot -i    # Interactive elements with refs
```

#### Deriving selectors from snapshots

The snapshot shows elements like:
```
@e8  textbox "Email"
@e10 button "Sign in"
@e15 link "Dashboard"
@e20 checkbox "Remember me"
```

Derive `role=<role>[name="<accessible name>"]` locators directly:
- `@e8`  → `role=textbox[name="Email"]`
- `@e10` → `role=button[name="Sign in"]`
- `@e15` → `role=link[name="Dashboard"]`
- `@e20` → `role=checkbox[name="Remember me"]`

These strings go directly into the plan JSON `selector` fields. They work with Playwright's `page.locator()` (the same API used internally).

**Fallback priority** (when no accessible name or role is ambiguous):
1. `[data-testid="value"]`
2. `#id`
3. `[aria-label="value"]`
4. `input[name="value"]`
5. CSS path (last resort)

#### Navigating the flow

- Interact to advance: `agent-browser click @eN`, `agent-browser fill @eN "text"`
- Re-snapshot after each navigation: `agent-browser snapshot -i`
- Extract ALL selectors for a page BEFORE navigating away (refs are invalidated by navigation)

```bash
agent-browser close
```

### 3. Generate plan JSON

Write to `./<demo-name>.json`. Structure:

```json
{
  "$schema": "dolly/v1",
  "version": 1,
  "name": "demo-name",
  "config": {
    "baseUrl": "http://localhost:3000",
    "viewport": { "width": 1280, "height": 720 },
    "scale": 2,
    "normalization": {
      "hideScrollbars": true,
      "disableCursorBlink": true,
      "disableAnimations": false,
      "reducedMotion": "no-preference"
    },
    "cursor": { "show": true },
    "outputFormat": "mp4"
  },
  "postProduction": {
    "cursor": {
      "enabled": true,
      "size": 20,
      "color": "#000000",
      "opacity": 0.8,
      "clickEffect": "scale"
    },
    "audio": {
      "clickSound": true,
      "volume": 0.5
    }
  },
  "actions": [
    {
      "id": "login",
      "description": "Sign in to the app",
      "leadIn": 600,
      "leadOut": 400,
      "steps": [
        { "type": "navigate", "url": "/", "waitUntil": "networkidle" },
        { "type": "click", "selector": "role=textbox[name=\"Email\"]" },
        { "type": "type", "selector": "role=textbox[name=\"Email\"]", "text": "demo@example.com", "typeDelay": 55 },
        { "type": "click", "selector": "role=textbox[name=\"Password\"]", "pauseBefore": 200 },
        { "type": "type", "selector": "role=textbox[name=\"Password\"]", "text": "s3cureP@ss!", "typeDelay": 50 },
        { "type": "click", "selector": "role=button[name=\"Sign in\"]", "pauseAfter": 800 },
        { "type": "waitForSelector", "selector": "role=navigation", "state": "visible", "timeout": 5000 }
      ]
    }
  ]
}
```

**Actions**: Group steps into logical scenes with kebab-case IDs. Each action has `leadIn` (200–800ms) and `leadOut` (300–1200ms).

**Step types**: `click`, `type`, `scroll`, `hover`, `wait`, `waitForSelector`, `select`, `navigate`

**Timing**: Use `pauseBefore`/`pauseAfter` (200–500ms) between field entries. `typeDelay` 30–80ms. `holdDuration` 500–1000ms for hovers. `wait` 400–1500ms for transitions/loads.

**Navigation**: Use relative URLs. Set `waitUntil: "networkidle"` for initial loads. Add `waitForSelector` after navigation to confirm state.

**Demo data**: `demo@example.com`, `s3cureP@ss!`, `Jane Smith`, `Acme Studios`

**postProduction** (optional): Controls how the cursor overlay and click sounds are applied in the final video. If omitted, defaults are used. This field is baked into the recording directory and can be tweaked later in the studio UI.

### 4. Validate

```bash
dolly validate <plan.json>
```

Fix any schema errors and re-validate.

### 5. Test

```bash
dolly test <plan.json> --verbose          # Fast headless validation
dolly test <plan.json> --verbose --headed  # With visible browser
```

Test runs all steps with `fast: true` (no timing pauses, no video). Reports pass/fail per action with screenshots on failure at `.dolly/test/screenshots/`.

If a test fails:
1. Check which selector failed and the screenshot
2. Fix the selector in the plan (update the role locator or fall back)
3. Re-test
4. If structural issue, re-explore that page with agent-browser

### 6. Record

```bash
dolly record <plan.json> --verbose
```

Report: recording directory path, video path, duration, any retries.

Recording produces a timestamped directory under `.dolly/recordings/<YYYYMMDD-HHmmss>/`:
- `plan.json` — copy of the input plan
- `raw.webm` — raw Playwright video (no cursor overlay)
- `cursor-keyframes.json` — cursor positions + click events with timestamps
- `post-production.json` — cursor/audio settings (editable in studio)
- `manifest.json` — recording metadata
- `output.mp4` — final exported video with cursor overlay + click sounds

The raw video has NO cursor baked in — the cursor is added in post-production via ffmpeg. This allows changing cursor style/size/color after recording.

### 7. Studio (post-production)

After recording, launch the studio UI:

```bash
dolly studio                              # Opens most recent recording
dolly studio .dolly/recordings/20260131-143022  # Specific recording
dolly studio --port 3001                  # Custom port (default 4400)
```

This opens a local React app at `http://localhost:4400` with:
- **Canvas preview**: Real-time cursor overlay on the raw video using `<canvas>`
- **Rendered preview**: Toggle to see the actual ffmpeg output
- **Settings panel**: Adjust cursor size/color/opacity, click effect, click sound volume
- **Export button**: Re-run ffmpeg with current settings

Settings are auto-saved to `post-production.json` in the recording directory.

#### Post-production config fields

```json
{
  "cursor": {
    "enabled": true,
    "style": "dot",
    "size": 20,
    "color": "#000000",
    "opacity": 0.8,
    "clickEffect": "scale"
  },
  "audio": {
    "clickSound": true,
    "volume": 0.5,
    "customFile": "/path/to/click.wav"
  }
}
```

- **cursor.enabled**: Show/hide cursor overlay
- **cursor.size**: 4–64px diameter of the cursor dot
- **cursor.color**: Hex color string
- **cursor.opacity**: 0–1 transparency
- **cursor.clickEffect**: `"scale"` (pulse to 0.75x on click) or `"none"`
- **audio.clickSound**: Enable/disable click sound effects
- **audio.volume**: 0–1 volume for click sounds
- **audio.customFile**: Optional path to a custom click WAV file

#### Guidance for setting cursor style in plans

- Dark backgrounds → use light cursor: `"color": "#FFFFFF"`
- Light backgrounds → use dark cursor: `"color": "#000000"` (default)
- Colorful/branded demos → match brand accent color
- Large viewport / presentation → increase size to 24–32px
- Subtle effect → lower opacity to 0.5–0.6

### 8. Export

Re-export with current studio settings:

```bash
dolly studio <dir>   # then click Export in the UI
```

Or programmatically via the API — the studio exposes `POST /api/export` which triggers ffmpeg with the current `post-production.json` settings.

## Error Recovery

| Problem | Fix |
|---|---|
| Selector not found | Re-explore page with agent-browser, derive corrected role locator |
| Timeout on waitForSelector | Increase `timeout` or add a preceding `wait` step |
| Element not interactable | Add `waitForSelector` with `state: "visible"` before the step |
| Navigation timing | Use `waitUntil: "domcontentloaded"` for SPAs |
| Modal not appearing | Add `wait` (400–600ms) after the triggering click |
| Flaky typing | Increase `typeDelay`, add `pauseBefore` |
| No cursor in output | Verify `cursor-keyframes.json` has keyframes; ensure `cursor.show: true` in plan config |
| Studio port in use | Use `dolly studio --port 3001` |
| Export fails | Check ffmpeg is installed: `which ffmpeg` |
| Post-prod settings lost | Settings are in `post-production.json` in the recording directory |
