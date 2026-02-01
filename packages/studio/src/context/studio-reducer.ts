import type { StudioState, StudioAction } from "./types";

export const initialState: StudioState = {
  recording: null,
  loading: true,
  error: null,
  exportStatus: "idle",
  exportProgress: "",
  settingsChanged: false,
  exportVersion: 0,
  player: {
    playing: false,
    currentTime: 0,
    duration: 0,
  },
};

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: null };

    case "LOAD_SUCCESS":
      return {
        ...state,
        loading: false,
        recording: action.recording,
        player: {
          ...state.player,
          duration: action.recording.keyframes.durationMs / 1000,
        },
      };

    case "LOAD_ERROR":
      return { ...state, loading: false, error: action.error };

    case "UPDATE_CURSOR_SETTINGS":
      if (!state.recording) return state;
      return {
        ...state,
        settingsChanged: true,
        recording: {
          ...state.recording,
          postProduction: {
            ...state.recording.postProduction,
            cursor: { ...state.recording.postProduction.cursor, ...action.cursor },
          },
        },
      };

    case "UPDATE_AUDIO_SETTINGS":
      if (!state.recording) return state;
      return {
        ...state,
        settingsChanged: true,
        recording: {
          ...state.recording,
          postProduction: {
            ...state.recording.postProduction,
            audio: { ...state.recording.postProduction.audio, ...action.audio },
          },
        },
      };

    case "EXPORT_START":
      return { ...state, exportStatus: "exporting", exportProgress: "Starting export..." };

    case "EXPORT_PROGRESS":
      return { ...state, exportProgress: action.message };

    case "EXPORT_DONE":
      return { ...state, exportStatus: "done", settingsChanged: false, exportVersion: state.exportVersion + 1 };

    case "EXPORT_ERROR":
      return { ...state, exportStatus: "error", exportProgress: action.error };

    case "SET_PLAYER_STATE":
      return { ...state, player: { ...state.player, ...action.player } };

    case "MARK_SETTINGS_SAVED":
      return { ...state, settingsChanged: false };
  }
}
