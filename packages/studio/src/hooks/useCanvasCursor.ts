import { useRef, useEffect, useMemo } from "react";
import { useStudio } from "../context/StudioContext";
import { renderCursorFrame, getCursorShape } from "@nicmeriano/dolly-core/cursor";
import type { CursorRendererConfig, CursorRendererEnv } from "@nicmeriano/dolly-core/cursor";

const env: CursorRendererEnv = { Path2D };

export function useCanvasCursor(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const { state } = useStudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const rendererConfig = useMemo((): CursorRendererConfig | null => {
    const recording = state.recording;
    if (!recording) return null;

    const { cursor } = recording.postProduction;
    if (!cursor.enabled || recording.keyframes.keyframes.length === 0) return null;

    return {
      cursor,
      keyframes: recording.keyframes.keyframes,
      shape: getCursorShape(cursor.style),
      clickDurationMs: 100,
    };
  }, [
    state.recording?.postProduction.cursor,
    state.recording?.keyframes.keyframes,
  ]);

  useEffect(() => {
    function draw() {
      rafRef.current = requestAnimationFrame(draw);

      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (!rendererConfig) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const timeMs = video.currentTime * 1000;
      renderCursorFrame(ctx, env, rendererConfig, timeMs, canvas.width, canvas.height);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [rendererConfig, videoRef]);

  // Sync canvas dimensions to viewport
  useEffect(() => {
    if (canvasRef.current && state.recording) {
      canvasRef.current.width = state.recording.keyframes.viewport.w;
      canvasRef.current.height = state.recording.keyframes.viewport.h;
    }
  }, [state.recording?.keyframes.viewport.w, state.recording?.keyframes.viewport.h]);

  return { canvasRef };
}
