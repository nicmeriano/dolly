import { useEffect } from "react";

interface ShortcutHandlers {
  togglePlay: () => void;
  seekRelative: (delta: number) => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't capture shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          handlers.togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handlers.seekRelative(e.shiftKey ? -5 : -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          handlers.seekRelative(e.shiftKey ? 5 : 1);
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers.togglePlay, handlers.seekRelative]);
}
