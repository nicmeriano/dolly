import { useStudio } from "../../context/StudioContext";
import { useStudioApi } from "../../hooks/useStudioApi";
import { getFileUrl } from "../../lib/api-client";
import { Button } from "../ui/button";

export function Header() {
  const { state } = useStudio();
  const { exportAndDownload } = useStudioApi();

  const videoFile = state.recording?.manifest.video ?? "output.mp4";
  const isExporting = state.exportStatus === "exporting";

  const handleDownload = () => {
    const url = `${getFileUrl(videoFile)}?v=${state.exportVersion + 1}`;
    exportAndDownload(url, videoFile);
  };

  return (
    <header className="col-span-2 flex items-center justify-between border-b border-border px-4 py-2">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold">Dolly Studio</h1>
        {state.recording && (
          <span className="text-xs text-muted-foreground">
            {state.recording.manifest.planName}
          </span>
        )}
      </div>

      <Button
        size="sm"
        onClick={handleDownload}
        disabled={isExporting}
      >
        {isExporting ? "Exporting..." : "Export"}
      </Button>
    </header>
  );
}
