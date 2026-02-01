import { CursorSettings } from "./CursorSettings";
import { AudioSettings } from "./AudioSettings";

export function SettingsPanel() {
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold">Settings</h2>
      <CursorSettings />
      <AudioSettings />
    </div>
  );
}
