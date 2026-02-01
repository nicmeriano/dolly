export interface RecordingData {
  manifest: {
    planName: string;
    startedAt: string;
    completedAt: string;
    video: string | null;
    rawVideo: string | null;
    recordingDir: string;
    durationSeconds: number;
    actions: Array<{ actionId: string; retriesUsed: number }>;
  };
  keyframes: {
    version: number;
    fps: number;
    viewport: { w: number; h: number };
    recordingStartedAt: string;
    durationMs: number;
    keyframes: Array<{
      x: number;
      y: number;
      timestamp: number;
      type: "move" | "click";
      actionId: string;
      stepIndex: number;
    }>;
  };
  postProduction: {
    cursor: {
      enabled: boolean;
      style: string;
      size: number;
      color: string;
      opacity: number;
      clickEffect: "scale" | "none";
    };
    audio: {
      clickSound: boolean;
      volume: number;
      customFile?: string;
    };
  };
}

export type PreviewMode = "canvas" | "rendered";

export type ExportStatus = "idle" | "exporting" | "done" | "error";

export interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
}

export interface StudioState {
  recording: RecordingData | null;
  loading: boolean;
  error: string | null;
  previewMode: PreviewMode;
  exportStatus: ExportStatus;
  exportProgress: string;
  settingsChanged: boolean;
  exportVersion: number;
  player: PlayerState;
}

export type StudioAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; recording: RecordingData }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "SET_PREVIEW_MODE"; mode: PreviewMode }
  | { type: "UPDATE_CURSOR_SETTINGS"; cursor: Partial<RecordingData["postProduction"]["cursor"]> }
  | { type: "UPDATE_AUDIO_SETTINGS"; audio: Partial<RecordingData["postProduction"]["audio"]> }
  | { type: "EXPORT_START" }
  | { type: "EXPORT_PROGRESS"; message: string }
  | { type: "EXPORT_DONE" }
  | { type: "EXPORT_ERROR"; error: string }
  | { type: "SET_PLAYER_STATE"; player: Partial<PlayerState> }
  | { type: "MARK_SETTINGS_SAVED" };
