export const DEFAULTS = {
  fps: 25,
  browser: "chromium" as const,
  outputDir: ".dolly",
  outputName: "demo",
  outputFormat: "mp4" as const,

  retries: {
    stepRetries: 2,
    actionRetries: 1,
    retryDelay: 500,
  },

  normalization: {
    hideScrollbars: true,
    disableCursorBlink: true,
    disableAnimations: true,
    forceConsistentFonts: true,
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    locale: "en-US",
    timezone: "America/New_York",
    colorScheme: "light" as const,
    reducedMotion: "reduce" as const,
    clearStorageBetweenActions: false,
  },

  cursor: {
    show: true,
    size: 20,
    color: "#000000",
    opacity: 0.8,
  },

  step: {
    typeDelay: 50,
  },

  action: {
    leadIn: 500,
    leadOut: 500,
  },
} as const;
