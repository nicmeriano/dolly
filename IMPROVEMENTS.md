# Dolly Recording Quality Improvements

## Problem

Dolly recordings look robotic compared to tools like Screen Studio or Loom. The main issues are choppy scrolling, disabled CSS animations, and 30fps capture.

## Root Cause Analysis

### Choppy Scrolling (Fixed)

Scroll steps used `page.mouse.wheel()` or `el.scrollBy()` which execute the entire scroll in a single paint frame. CDP screencast only sends frames on screen updates, so it captures 1-2 frames (before/after) for a 500px scroll. The frame duplication logic fills the gap with copies of the "after" frame, producing a visible jump.

**Fix:** Replaced instant scroll with a `page.evaluate()` + `requestAnimationFrame` loop that runs inside Chrome's render loop. The browser scrolls incrementally at native 60fps with cubic ease-in-out easing. CDP captures all intermediate positions. The `duration` field on scroll steps now controls animation time (default 600ms). Set to 0 for instant scroll. In fast/replay mode, scrolls are still instant.

**Why not many small `page.mouse.wheel()` calls?** Each call round-trips through Node.js -> CDP -> Chrome with 5-20ms of unpredictable latency. Over 600ms you'd get maybe 25-50 increments with inconsistent spacing. The in-browser rAF approach has one round-trip to start and one to finish, with Chrome handling all intermediate timing.

### Disabled CSS Animations

`normalization.ts` injects CSS that sets `animation-duration: 0.001ms` and `transition-duration: 0.001ms` on all elements. Combined with `reducedMotion: "reduce"`, every hover transition, accordion expand, dropdown reveal, fade-in, and tooltip appearance snaps instantly to its final state.

This was intentional for determinism (same output every run), but Dolly is a demo video tool, not a testing tool. Authenticity matters more than reproducibility.

**Tradeoff of enabling animations:** Plan authors need to account for animation duration. If you click to expand a 300ms accordion and the next step fires immediately, the recording captures it mid-transition. Add `pauseAfter` or `wait` steps to let animations settle. Two runs on different machines may produce slightly different mid-transition frames.

### 30fps Default

The default frame rate is 30fps. This is fine for static content but noticeable during scrolling and transitions. Screen Studio records at 60fps.

**Tradeoff of 60fps:** Post-production time roughly doubles because the cursor overlay renders one PNG per frame via `@napi-rs/canvas`. Final file size increases ~30-50% (not 2x due to H.264 temporal compression). No visual difference during static content.

The schema already supports `fps: 1-60`, so this is a config default change.

### Linear Cursor Interpolation

Post-production cursor movement uses linear interpolation between keyframes (`cursor-interpolation.ts`). The cursor moves at constant speed between positions, which looks mechanical. Real cursor movement accelerates and decelerates.

**Fix:** Apply ease-in-out (or ease-out) to the interpolation progress in `cursor-interpolation.ts`. This is a post-production-only change — no impact on recording.

---

## Gap Analysis vs Screen Studio

| Gap | Status | Effort | Impact |
|-----|--------|--------|--------|
| Smooth scrolling | **Fixed** | Done | High |
| CSS animations/transitions | Disabled by default, flip to enabled | Trivial (2 lines in defaults.ts) | High |
| 60fps recording | Supported, just change default | Trivial (1 line in defaults.ts) | Medium |
| Cursor easing in post-production | Linear interpolation, needs ease-in-out | Small (cursor-interpolation.ts) | Medium |
| Zoom-to-click / focus effects | Not implemented | Large | High |
| Window chrome / background | Not implemented (drop shadow, wallpaper, rounded corners) | Large | Medium |
| Motion blur on fast movements | Not implemented | Large | Low |

### Quick wins (config changes)

In `packages/schema/src/defaults.ts`:

```ts
// Enable CSS animations for cinematic recordings
disableAnimations: false,  // currently: true
reducedMotion: "no-preference" as const,  // currently: "reduce"

// Bump frame rate
fps: 60,  // currently: 30
```

### Medium effort

**Cursor easing:** In `packages/core/src/post-production/cursor-interpolation.ts`, the linear `t` value used for interpolation should be passed through an easing function before computing x/y positions. Same cubic ease-in-out used for scroll would work.

### Large features

**Zoom-to-click:** Screen Studio's signature feature. Would require a new post-production pass that crops and scales the video around click targets. Implementation would involve:
- Reading click keyframes and their target bounding boxes
- Computing smooth zoom transitions (ease in before click, hold, ease out after)
- An FFmpeg `zoompan` filter or per-frame crop/scale in the overlay pipeline

**Window chrome:** Compositing the browser viewport onto a background with drop shadow, rounded corners, and optional wallpaper. Would be an additional FFmpeg filter step or canvas compositing pass in post-production.

**Motion blur:** Applying directional blur during fast cursor movements or scroll. Would require frame blending in post-production, potentially expensive.

---

## Architecture Notes

### Why scroll needs special treatment but other animations don't

Scroll changes what's on screen (page content moves) and must happen during recording so CDP can capture intermediate positions. CSS animations and video playback happen natively in Chrome's compositor — if you don't suppress them, CDP captures them automatically at whatever frame rate you're recording. The `requestAnimationFrame` technique is only needed for scroll because Dolly programmatically controls the scroll position.

### Why `page.evaluate` + rAF works

The animation runs entirely inside Chrome's render loop. One Playwright round-trip to inject the script, Chrome handles all intermediate frames at native refresh rate, one round-trip when the Promise resolves. `requestAnimationFrame` is not a CSS animation, so `disableAnimations` CSS doesn't affect it. `prefers-reduced-motion` doesn't affect JavaScript-driven animations.

### Video element playback

`<video>` elements aren't CSS animations, so `disableAnimations` doesn't stop them. However, `reducedMotion: "reduce"` can cause some sites to pause autoplay videos via `@media (prefers-reduced-motion: reduce)` queries. Setting `reducedMotion: "no-preference"` fixes this.
