import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Command } from "commander";
import chalk from "chalk";

export const studioCommand = new Command("studio")
  .description("Open post-production studio for a recording")
  .argument("[dir]", "Recording directory (defaults to most recent)")
  .option("-p, --port <port>", "Server port", "4400")
  .action(async (dir: string | undefined, opts) => {
    let recordingDir: string;

    if (dir) {
      recordingDir = path.resolve(dir);
    } else {
      // Find most recent recording in .dolly/recordings/
      const recordingsBase = path.resolve(".dolly", "recordings");
      let entries: string[];
      try {
        entries = await fs.readdir(recordingsBase);
      } catch {
        console.error(chalk.red("No recordings found in .dolly/recordings/"));
        console.error(chalk.dim("  Run 'dolly record <plan>' first to create a recording."));
        process.exit(1);
      }

      // Sort descending (most recent first)
      entries.sort().reverse();
      if (entries.length === 0) {
        console.error(chalk.red("No recordings found in .dolly/recordings/"));
        process.exit(1);
      }

      recordingDir = path.join(recordingsBase, entries[0]);
    }

    // Validate recording directory
    const requiredFiles = ["manifest.json", "cursor-keyframes.json"];
    const missing: string[] = [];
    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(recordingDir, file));
      } catch {
        missing.push(file);
      }
    }

    // Check for raw video (either raw.mp4 or raw.webm for backward compat)
    let hasRawVideo = false;
    for (const name of ["raw.mp4", "raw.webm"]) {
      try {
        await fs.access(path.join(recordingDir, name));
        hasRawVideo = true;
        break;
      } catch {
        // try next
      }
    }
    if (!hasRawVideo) {
      missing.push("raw.mp4 (or raw.webm)");
    }

    if (missing.length > 0) {
      console.error(chalk.red(`Invalid recording directory: ${recordingDir}`));
      console.error(chalk.dim(`  Missing: ${missing.join(", ")}`));
      process.exit(1);
    }

    const port = parseInt(opts.port, 10);

    console.log(chalk.bold.cyan("\n  Dolly Studio\n"));
    console.log(chalk.dim(`  Recording: ${recordingDir}`));
    console.log(chalk.dim(`  Starting server on port ${port}...\n`));

    try {
      const { startStudio } = await import("@dolly/studio/server");
      await startStudio({ recordingDir, port });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Cannot find module") || message.includes("MODULE_NOT_FOUND")) {
        console.error(chalk.red("Studio package not found."));
        console.error(chalk.dim("  Make sure @dolly/studio is built: pnpm -r build"));
      } else {
        console.error(chalk.red(`Failed to start studio: ${message}`));
      }
      process.exit(1);
    }
  });
