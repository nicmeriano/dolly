import { useStudio } from "../../context/StudioContext";
import { useStudioApi } from "../../hooks/useStudioApi";
import { getFileUrl } from "../../lib/api-client";
import { Button } from "../ui/button";

export function Header() {
  const { state } = useStudio();
  const { startExport } = useStudioApi();

  const videoFile = state.recording?.manifest.video ?? "output.mp4";
  const canDownload = state.exportStatus === "done" || state.exportVersion > 0;

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

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={startExport}
          disabled={state.exportStatus === "exporting"}
        >
          {state.exportStatus === "exporting" ? "Exporting..." : "Export"}
        </Button>

        <Button
          variant="outline"
          size="sm"
          asChild
          disabled={!canDownload}
        >
          <a
            href={`${getFileUrl(videoFile)}?v=${state.exportVersion}`}
            download={videoFile}
          >
            Download
          </a>
        </Button>
      </div>
    </header>
  );
}
