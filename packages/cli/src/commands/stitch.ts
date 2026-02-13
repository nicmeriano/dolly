import * as path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { readManifest, writeManifest, convertToMp4 } from "@nicmeriano/dolly-core";

export const stitchCommand = new Command("stitch")
  .description("Convert a recorded .webm video to .mp4")
  .argument("[dir]", "Directory containing manifest.json", ".dolly")
  .option("--crf <number>", "H.264 quality (0-51)", "18")
  .option("--fps <number>", "Frame rate", "25")
  .action(async (dir: string, opts) => {
    const outputDir = path.resolve(dir);

    let manifest;
    try {
      manifest = await readManifest(outputDir);
    } catch {
      console.error(chalk.red(`Cannot read manifest from: ${outputDir}/manifest.json`));
      process.exit(1);
    }

    if (!manifest.video) {
      console.error(chalk.red("No video found in manifest"));
      process.exit(1);
    }

    if (!manifest.video.endsWith(".webm")) {
      console.error(chalk.red("Video is already in mp4 format"));
      process.exit(1);
    }

    const inputPath = path.join(outputDir, manifest.video);

    try {
      console.log(chalk.dim(`  Converting ${manifest.video} to mp4...`));

      const mp4Path = await convertToMp4({
        inputPath,
        fps: parseInt(opts.fps, 10),
        crf: parseInt(opts.crf, 10),
      });

      manifest.video = path.basename(mp4Path);
      await writeManifest(outputDir, manifest);

      console.log(chalk.bold.green(`\n  Output: ${mp4Path}\n`));
    } catch (err) {
      console.error(chalk.red(`Conversion failed: ${err instanceof Error ? err.message : err}`));
      process.exit(1);
    }
  });
