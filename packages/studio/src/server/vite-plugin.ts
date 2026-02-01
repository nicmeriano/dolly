import type { Plugin } from "vite";
import { createApiMiddleware } from "./api.js";

export interface StudioVitePluginOptions {
  recordingDir: string;
}

export function studioApiPlugin(options: StudioVitePluginOptions): Plugin {
  const middleware = createApiMiddleware({ recordingDir: options.recordingDir });

  return {
    name: "dolly-studio-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        middleware(req, res, next);
      });
    },
  };
}
