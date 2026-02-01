import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { readManifest } from "@dolly/core";

export const inspectCommand = new Command("inspect")
  .description("Inspect a recording manifest")
  .argument("[dir]", "Recording directory or .dolly base directory")
  .action(async (dir?: string) => {
    let outputDir: string;

    if (dir) {
      outputDir = path.resolve(dir);
    } else {
      // Default: find most recent recording in .dolly/recordings/
      const recordingsBase = path.resolve(".dolly", "recordings");
      try {
        const entries = await fs.readdir(recordingsBase);
        entries.sort().reverse();
        if (entries.length > 0) {
          outputDir = path.join(recordingsBase, entries[0]);
        } else {
          // Fall back to .dolly for backwards compatibility
          outputDir = path.resolve(".dolly");
        }
      } catch {
        // Fall back to .dolly for backwards compatibility
        outputDir = path.resolve(".dolly");
      }
    }

    let manifest;
    try {
      manifest = await readManifest(outputDir);
    } catch {
      console.error(chalk.red(`Cannot read manifest from: ${outputDir}/manifest.json`));
      process.exit(1);
    }

    console.log(chalk.bold.cyan(`\n  Recording: ${manifest.planName}\n`));
    if (manifest.recordingDir) {
      console.log(chalk.dim(`  Directory: ${manifest.recordingDir}`));
    }
    console.log(chalk.dim(`  Started:   ${manifest.startedAt}`));
    console.log(chalk.dim(`  Completed: ${manifest.completedAt || "(incomplete)"}`));
    console.log(chalk.dim(`  Duration:  ${manifest.durationSeconds.toFixed(1)}s`));
    console.log(chalk.dim(`  Actions:   ${manifest.actions.length}`));

    if (manifest.rawVideo) {
      const rawVideoPath = path.join(outputDir, manifest.rawVideo);
      let size = 0;
      try {
        const stat = await fs.stat(rawVideoPath);
        size = stat.size;
      } catch {}
      console.log(chalk.dim(`  Raw:       ${manifest.rawVideo} (${formatBytes(size)})`));
    }

    if (manifest.video) {
      const videoPath = path.join(outputDir, manifest.video);
      let size = 0;
      try {
        const stat = await fs.stat(videoPath);
        size = stat.size;
      } catch {}
      console.log(
        chalk.dim(`  Video:     ${manifest.video} (${formatBytes(size)})`),
      );
    }

    const totalRetries = manifest.actions.reduce((sum, a) => sum + a.retriesUsed, 0);
    if (totalRetries > 0) {
      console.log(chalk.yellow(`  Retries:   ${totalRetries} step retries total`));
    }

    if (manifest.actions.length > 0) {
      console.log(chalk.bold("\n  Actions:\n"));

      for (const action of manifest.actions) {
        const retriesStr =
          action.retriesUsed > 0
            ? chalk.yellow(` (${action.retriesUsed} retries)`)
            : "";
        console.log(chalk.white(`    ${action.actionId}${retriesStr}`));
      }
      console.log();
    }
  });

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
