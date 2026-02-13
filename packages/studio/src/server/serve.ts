import * as http from "node:http";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createApiMiddleware } from "./api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface StartStudioOptions {
  recordingDir: string;
  port?: number;
}

export async function startStudio(options: StartStudioOptions): Promise<void> {
  const { recordingDir, port = 4400 } = options;

  const apiMiddleware = createApiMiddleware({ recordingDir });

  // Try to use sirv for static files, fall back to basic serving
  let sirvHandler: ((req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void) | undefined;

  try {
    const sirv = (await import("sirv")).default;
    const clientDir = path.resolve(__dirname, "../client");
    sirvHandler = sirv(clientDir, { single: true });
  } catch {
    // sirv not available, will serve basic fallback
  }

  const server = http.createServer(async (req, res) => {
    // API routes first
    const url = req.url ?? "/";
    if (url.startsWith("/api/")) {
      await apiMiddleware(req, res);
      return;
    }

    // Static files
    if (sirvHandler) {
      sirvHandler(req, res, () => {
        res.writeHead(404);
        res.end("Not found");
      });
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html>
<html><body>
<h1>Dolly Studio</h1>
<p>Client not built. Run <code>pnpm --filter @nicmeriano/dolly-studio build:client</code> first.</p>
</body></html>`);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`  Dolly Studio running at http://localhost:${port}\n`);
      // Open browser
      const openUrl = `http://localhost:${port}`;
      import("node:child_process").then(({ exec }) => {
        const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        exec(`${cmd} ${openUrl}`);
      });
      resolve();
    });
  });
}
