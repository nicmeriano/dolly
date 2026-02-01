import type { RecordingData } from "../context/types";

const API_BASE = "/api";

export async function fetchRecording(): Promise<RecordingData> {
  const res = await fetch(`${API_BASE}/recording`);
  if (!res.ok) throw new Error(`Failed to load recording: ${res.statusText}`);
  return res.json();
}

export async function fetchPostProduction(): Promise<RecordingData["postProduction"]> {
  const res = await fetch(`${API_BASE}/post-production`);
  if (!res.ok) throw new Error(`Failed to load settings: ${res.statusText}`);
  return res.json();
}

export async function savePostProduction(
  config: RecordingData["postProduction"],
): Promise<void> {
  const res = await fetch(`${API_BASE}/post-production`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Failed to save settings: ${res.statusText}`);
}

export async function triggerExport(
  onProgress: (message: string) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/export`, { method: "POST" });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Export failed: ${text}`);
  }

  if (!res.body) {
    throw new Error("No response body for SSE export");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.message) onProgress(parsed.message);
          if (parsed.done) return;
        } catch {
          onProgress(data);
        }
      }
    }
  }
}

export function getFileUrl(filename: string): string {
  return `${API_BASE}/files/${encodeURIComponent(filename)}`;
}
