import { useStudio } from "../../context/StudioContext";
import { CanvasPreview } from "./CanvasPreview";
import { RenderedPreview } from "./RenderedPreview";
import { PlaybackControls } from "./PlaybackControls";
import { useVideoPlayer } from "../../hooks/useVideoPlayer";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";

export function PreviewArea() {
  const { state } = useStudio();
  const player = useVideoPlayer();

  useKeyboardShortcuts({
    togglePlay: player.togglePlay,
    seekRelative: player.seekRelative,
  });

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex-1 flex items-center justify-center overflow-hidden rounded-lg bg-black/50">
        {state.previewMode === "canvas" ? (
          <CanvasPreview videoRef={player.videoRef} onLoaded={player.onVideoLoaded} onEnded={player.onVideoEnded} />
        ) : (
          <RenderedPreview onLoaded={player.onVideoLoaded} onEnded={player.onVideoEnded} />
        )}
      </div>
      <PlaybackControls
        togglePlay={player.togglePlay}
        seek={player.seek}
      />
      {state.exportStatus === "exporting" && (
        <div className="text-xs text-muted-foreground text-center">
          {state.exportProgress}
        </div>
      )}
      {state.exportStatus === "done" && (
        <div className="text-xs text-green-500 text-center">
          Export complete
        </div>
      )}
      {state.exportStatus === "error" && (
        <div className="text-xs text-red-500 text-center">
          {state.exportProgress}
        </div>
      )}
    </div>
  );
}
