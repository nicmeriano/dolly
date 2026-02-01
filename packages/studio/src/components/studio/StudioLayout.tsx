import { useStudio } from "../../context/StudioContext";
import { Header } from "./Header";
import { PreviewArea } from "./PreviewArea";
import { SettingsPanel } from "./SettingsPanel";

export function StudioLayout() {
  const { state } = useStudio();

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading recording...</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-destructive-foreground">Failed to load recording</p>
          <p className="text-sm text-muted-foreground">{state.error}</p>
        </div>
      </div>
    );
  }

  if (!state.recording) return null;

  return (
    <div className="h-screen grid grid-rows-[auto_1fr] grid-cols-[1fr_220px]">
      <header className="col-span-2">
        <Header />
      </header>
      <main className="overflow-hidden p-4">
        <PreviewArea />
      </main>
      <aside className="border-l border-border overflow-y-auto p-3">
        <SettingsPanel />
      </aside>
    </div>
  );
}
