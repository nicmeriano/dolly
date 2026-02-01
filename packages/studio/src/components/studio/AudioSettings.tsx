import { useStudio } from "../../context/StudioContext";
import { Switch } from "../ui/switch";
import { Slider } from "../ui/slider";

export function AudioSettings() {
  const { state, dispatch } = useStudio();
  if (!state.recording) return null;

  const { audio } = state.recording.postProduction;

  const updateAudio = (updates: Partial<typeof audio>) => {
    dispatch({ type: "UPDATE_AUDIO_SETTINGS", audio: updates });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Audio
      </h3>

      <Switch
        checked={audio.clickSound}
        onCheckedChange={(clickSound) => updateAudio({ clickSound })}
        label="Click sounds"
      />

      {audio.clickSound && (
        <Slider
          label="Volume"
          displayValue={`${Math.round(audio.volume * 100)}%`}
          min={0}
          max={1}
          step={0.05}
          value={audio.volume}
          onChange={(e) => updateAudio({ volume: parseFloat(e.target.value) })}
        />
      )}
    </div>
  );
}
