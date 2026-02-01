import { useStudio } from "../../context/StudioContext";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { formatTime } from "../../lib/utils";

interface PlaybackControlsProps {
  togglePlay: () => void;
  seek: (time: number) => void;
}

export function PlaybackControls({ togglePlay, seek }: PlaybackControlsProps) {
  const { state } = useStudio();
  const { playing, currentTime, duration } = state.player;

  return (
    <div className="flex items-center gap-3 px-2">
      <Button variant="ghost" size="icon" onClick={togglePlay}>
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2.5v11l9-5.5z" />
          </svg>
        )}
      </Button>

      <span className="text-xs text-muted-foreground tabular-nums w-14 text-right">
        {formatTime(currentTime)}
      </span>

      <div className="flex-1">
        <Slider
          min={0}
          max={duration || 1}
          step={0.01}
          value={currentTime}
          onChange={(e) => seek(parseFloat(e.target.value))}
        />
      </div>

      <span className="text-xs text-muted-foreground tabular-nums w-14">
        {formatTime(duration)}
      </span>
    </div>
  );
}
