import { useStudio } from "../../context/StudioContext";
import { useStudioApi } from "../../hooks/useStudioApi";
import { getFileUrl } from "../../lib/api-client";
import { Button } from "../ui/button";

export function Header() {
  const { state, dispatch } = useStudio();
  const { startExport, startRender } = useStudioApi();

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
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <Button
            variant={state.previewMode === "canvas" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => dispatch({ type: "SET_PREVIEW_MODE", mode: "canvas" })}
          >
            Canvas
          </Button>
          <Button
            variant={state.previewMode === "rendered" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              dispatch({ type: "SET_PREVIEW_MODE", mode: "rendered" });
              if (state.settingsChanged) {
                startRender();
              }
            }}
          >
            Rendered
          </Button>
        </div>

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
