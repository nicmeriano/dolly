import type { RefObject } from "react";
import { useStudio } from "../../context/StudioContext";
import { useCanvasCursor } from "../../hooks/useCanvasCursor";
import { useClickSound } from "../../hooks/useClickSound";
import { getFileUrl } from "../../lib/api-client";

interface CanvasPreviewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  onLoaded: () => void;
  onEnded: () => void;
}

export function CanvasPreview({ videoRef, onLoaded, onEnded }: CanvasPreviewProps) {
  const { state } = useStudio();
  const { canvasRef } = useCanvasCursor(videoRef);
  useClickSound(videoRef);

  if (!state.recording) return null;

  const { w, h } = state.recording.keyframes.viewport;
  const rawVideo = state.recording.manifest.rawVideo ?? "raw.webm";

  return (
    <div className="relative w-full" style={{ aspectRatio: `${w}/${h}` }}>
      <video
        ref={videoRef}
        src={getFileUrl(rawVideo)}
        onLoadedMetadata={onLoaded}
        onEnded={onEnded}
        className="absolute inset-0 w-full h-full"
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        width={w}
        height={h}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
}
