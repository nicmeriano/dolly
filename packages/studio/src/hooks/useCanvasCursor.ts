import { useRef, useEffect } from "react";
import { useStudio } from "../context/StudioContext";
import { interpolateCursor } from "../lib/cursor-interpolation";

export function useCanvasCursor(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const { state } = useStudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const recording = state.recording;

    function draw() {
      rafRef.current = requestAnimationFrame(draw);

      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || !recording) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { cursor } = recording.postProduction;
      const { keyframes } = recording.keyframes;
      if (!cursor.enabled || keyframes.length === 0) return;

      const timeMs = video.currentTime * 1000;
      const pos = interpolateCursor(keyframes, timeMs);
      if (!pos) return;

      const drawRadius = pos.clicking && cursor.clickEffect === "scale"
        ? (cursor.size * 0.75) / 2
        : cursor.size / 2;

      ctx.save();
      ctx.globalAlpha = cursor.opacity;
      ctx.fillStyle = cursor.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, drawRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.recording, videoRef]);

  // Sync canvas dimensions to viewport
  useEffect(() => {
    if (canvasRef.current && state.recording) {
      canvasRef.current.width = state.recording.keyframes.viewport.w;
      canvasRef.current.height = state.recording.keyframes.viewport.h;
    }
  }, [state.recording?.keyframes.viewport.w, state.recording?.keyframes.viewport.h]);

  return { canvasRef };
}
