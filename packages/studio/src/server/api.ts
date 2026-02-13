import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Resolve click.wav from @nicmeriano/dolly-core assets for canvas preview audio
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_ASSETS_DIR = path.resolve(__dirname, "../../../core/assets");

export interface ApiOptions {
  recordingDir: string;
}

export function createApiMiddleware(options: ApiOptions) {
  const { recordingDir } = options;

  return async function apiMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next?: () => void,
  ): Promise<void> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (!pathname.startsWith("/api/")) {
      next?.();
      return;
    }

    try {
      // GET /api/recording — merged recording data
      if (req.method === "GET" && pathname === "/api/recording") {
        const [manifestRaw, keyframesRaw, postProdRaw] = await Promise.all([
          fs.readFile(path.join(recordingDir, "manifest.json"), "utf-8"),
          fs.readFile(path.join(recordingDir, "cursor-keyframes.json"), "utf-8"),
          fs.readFile(path.join(recordingDir, "post-production.json"), "utf-8"),
        ]);

        const data = {
          manifest: JSON.parse(manifestRaw),
          keyframes: JSON.parse(keyframesRaw),
          postProduction: JSON.parse(postProdRaw),
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
        return;
      }

      // GET /api/post-production
      if (req.method === "GET" && pathname === "/api/post-production") {
        const raw = await fs.readFile(path.join(recordingDir, "post-production.json"), "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(raw);
        return;
      }

      // PUT /api/post-production
      if (req.method === "PUT" && pathname === "/api/post-production") {
        const body = await readBody(req);
        const config = JSON.parse(body);
        await fs.writeFile(
          path.join(recordingDir, "post-production.json"),
          JSON.stringify(config, null, 2),
          "utf-8",
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      // GET /api/files/:name — serve raw video/media files with Range support
      if (req.method === "GET" && pathname.startsWith("/api/files/")) {
        const filename = decodeURIComponent(pathname.slice("/api/files/".length));
        const filePath = path.join(recordingDir, filename);

        // Security: ensure the file is within the recording directory
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(path.resolve(recordingDir))) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }

        // Try recording dir first, fall back to core assets (e.g. click.wav)
        let actualPath = filePath;
        if (!existsSync(filePath) && existsSync(path.join(CORE_ASSETS_DIR, filename))) {
          actualPath = path.join(CORE_ASSETS_DIR, filename);
        }

        let stat;
        try {
          stat = statSync(actualPath);
        } catch {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const ext = path.extname(filename).toLowerCase();
        const contentType =
          ext === ".mp4" ? "video/mp4" :
          ext === ".webm" ? "video/webm" :
          ext === ".wav" ? "audio/wav" :
          ext === ".png" ? "image/png" :
          "application/octet-stream";

        // Handle Range requests for video seeking
        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
          const chunkSize = end - start + 1;

          res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": contentType,
          });

          createReadStream(actualPath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            "Content-Length": stat.size,
            "Content-Type": contentType,
            "Accept-Ranges": "bytes",
          });
          createReadStream(actualPath).pipe(res);
        }
        return;
      }

      // POST /api/export — trigger ffmpeg export with SSE progress
      if (req.method === "POST" && pathname === "/api/export") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        });

        const send = (data: object) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
          send({ message: "Starting export..." });
          const { runExport } = await import("./ffmpeg-export.js");
          const result = await runExport(recordingDir, (msg) => send({ message: msg }));
          send({ done: true, outputPath: result.outputPath });
        } catch (err) {
          send({ error: err instanceof Error ? err.message : String(err) });
        }
        res.end();
        return;
      }

      // 404 for unmatched API routes
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
