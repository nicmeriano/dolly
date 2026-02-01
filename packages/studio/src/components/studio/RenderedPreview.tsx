import { useRef } from "react";
import { useStudio } from "../../context/StudioContext";
import { getFileUrl } from "../../lib/api-client";

interface RenderedPreviewProps {
  onLoaded: () => void;
  onEnded: () => void;
}

export function RenderedPreview({ onLoaded, onEnded }: RenderedPreviewProps) {
  const { state } = useStudio();
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!state.recording) return null;

  const { w, h } = state.recording.keyframes.viewport;
  const videoFile = state.recording.manifest.video ?? "output.mp4";
  const videoSrc = `${getFileUrl(videoFile)}?v=${state.exportVersion}`;

  return (
    <div className="relative w-full" style={{ aspectRatio: `${w}/${h}` }}>
      <video
        ref={videoRef}
        src={videoSrc}
        onLoadedMetadata={onLoaded}
        onEnded={onEnded}
        className="absolute inset-0 w-full h-full"
        playsInline
        controls
      />
      {state.settingsChanged && (
        <div className="absolute top-2 right-2 bg-yellow-600/90 text-xs text-white px-2 py-1 rounded">
          Settings changed — re-render to update
        </div>
      )}
    </div>
  );
}
