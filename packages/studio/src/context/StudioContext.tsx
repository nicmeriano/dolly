import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
  type Dispatch,
} from "react";
import { studioReducer, initialState } from "./studio-reducer";
import type { StudioState, StudioAction } from "./types";
import { fetchRecording } from "../lib/api-client";

interface StudioContextValue {
  state: StudioState;
  dispatch: Dispatch<StudioAction>;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(studioReducer, initialState);

  useEffect(() => {
    dispatch({ type: "LOAD_START" });
    fetchRecording()
      .then((recording) => dispatch({ type: "LOAD_SUCCESS", recording }))
      .catch((err) =>
        dispatch({ type: "LOAD_ERROR", error: err instanceof Error ? err.message : String(err) }),
      );
  }, []);

  return (
    <StudioContext.Provider value={{ state, dispatch }}>
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within StudioProvider");
  return ctx;
}
