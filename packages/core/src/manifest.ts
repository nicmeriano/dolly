import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { RecordingManifest } from "@nicmeriano/dolly-schema";

export async function writeManifest(
  outputDir: string,
  manifest: RecordingManifest,
): Promise<void> {
  const manifestPath = path.join(outputDir, "manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

export async function readManifest(
  outputDir: string,
): Promise<RecordingManifest> {
  const manifestPath = path.join(outputDir, "manifest.json");
  const content = await fs.readFile(manifestPath, "utf-8");
  return JSON.parse(content) as RecordingManifest;
}
