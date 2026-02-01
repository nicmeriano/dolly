import { useCallback, useRef, useEffect } from "react";
import { useStudio } from "../context/StudioContext";
import { savePostProduction, triggerExport } from "../lib/api-client";
import type { RecordingData } from "../context/types";

export function useStudioApi() {
  const { state, dispatch } = useStudio();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounced save of post-production settings
  const saveSettings = useCallback(
    (config: RecordingData["postProduction"]) => {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        savePostProduction(config).catch(console.error);
      }, 500);
    },
    [],
  );

  // Auto-save when settings change
  useEffect(() => {
    if (state.recording && state.settingsChanged) {
      saveSettings(state.recording.postProduction);
    }
  }, [state.recording?.postProduction, state.settingsChanged, saveSettings]);

  const startExport = useCallback(async () => {
    dispatch({ type: "EXPORT_START" });
    try {
      await triggerExport((message) => {
        dispatch({ type: "EXPORT_PROGRESS", message });
      });
      dispatch({ type: "EXPORT_DONE" });
    } catch (err) {
      dispatch({
        type: "EXPORT_ERROR",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [dispatch]);

  return { saveSettings, startExport };
}
