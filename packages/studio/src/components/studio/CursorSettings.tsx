import { useStudio } from "../../context/StudioContext";
import { Switch } from "../ui/switch";
import { Slider } from "../ui/slider";
import { Select } from "../ui/select";

export function CursorSettings() {
  const { state, dispatch } = useStudio();
  if (!state.recording) return null;

  const { cursor } = state.recording.postProduction;

  const updateCursor = (updates: Partial<typeof cursor>) => {
    dispatch({ type: "UPDATE_CURSOR_SETTINGS", cursor: updates });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Cursor
      </h3>

      <Switch
        checked={cursor.enabled}
        onCheckedChange={(enabled) => updateCursor({ enabled })}
        label="Show cursor"
      />

      {cursor.enabled && (
        <>
          <Select
            label="Style"
            value={cursor.style}
            onChange={(e) => updateCursor({ style: e.target.value as "pointer" | "pointer-alt" | "hand" | "dot" })}
            options={[
              { value: "pointer", label: "Pointer" },
              { value: "pointer-alt", label: "Pointer Alt" },
              { value: "hand", label: "Hand" },
              { value: "dot", label: "Dot" },
            ]}
          />

          <Slider
            label="Size"
            displayValue={`${cursor.size}px`}
            min={4}
            max={64}
            step={1}
            value={cursor.size}
            onChange={(e) => updateCursor({ size: parseInt(e.target.value) })}
          />

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={cursor.color}
                onChange={(e) => updateCursor({ color: e.target.value })}
                className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
              />
              <span className="text-xs text-muted-foreground font-mono">
                {cursor.color}
              </span>
            </div>
          </div>

          <Slider
            label="Opacity"
            displayValue={`${Math.round(cursor.opacity * 100)}%`}
            min={0}
            max={1}
            step={0.05}
            value={cursor.opacity}
            onChange={(e) => updateCursor({ opacity: parseFloat(e.target.value) })}
          />

          <Select
            label="Click effect"
            value={cursor.clickEffect}
            onChange={(e) => updateCursor({ clickEffect: e.target.value as "scale" | "none" })}
            options={[
              { value: "scale", label: "Scale pulse" },
              { value: "none", label: "None" },
            ]}
          />
        </>
      )}
    </div>
  );
}
