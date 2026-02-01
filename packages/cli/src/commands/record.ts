import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { validatePlan } from "@dolly/schema";
import { run } from "@dolly/core";
import { attachConsoleFormatter } from "../formatters/console.js";

export const recordCommand = new Command("record")
  .description("Record a product demo from a plan file")
  .argument("<plan>", "Path to plan.json file")
  .option("-o, --output-dir <dir>", "Override output directory")
  .option("--format <format>", "Output format: mp4 or webm")
  .option("--headed", "Show browser window")
  .option("-v, --verbose", "Verbose output")
  .option("--json", "NDJSON progress output")
  .option("--dry-run", "Validate plan only, don't execute")
  .action(async (planPath: string, opts) => {
    const resolvedPath = path.resolve(planPath);

    let raw: string;
    try {
      raw = await fs.readFile(resolvedPath, "utf-8");
    } catch {
      console.error(chalk.red(`Cannot read plan file: ${resolvedPath}`));
      process.exit(1);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error(chalk.red("Plan file is not valid JSON"));
      process.exit(1);
    }

    const validation = validatePlan(parsed);
    if (!validation.success || !validation.plan) {
      console.error(chalk.red("Plan validation failed:\n"));
      for (const issue of validation.errors?.issues ?? []) {
        console.error(chalk.red(`  • ${issue.path.join(".")}: ${issue.message}`));
      }
      process.exit(1);
    }

    if (opts.dryRun) {
      console.log(chalk.green("Plan is valid."));
      console.log(
        chalk.dim(
          `  ${validation.plan.actions.length} action(s), ` +
            `${validation.plan.actions.reduce((sum, a) => sum + a.steps.length, 0)} total step(s)`,
        ),
      );
      return;
    }

    const handle = run({
      plan: validation.plan,
      headed: opts.headed,
      outputDir: opts.outputDir,
      format: opts.format as "mp4" | "webm" | undefined,
    });

    attachConsoleFormatter(handle.events, {
      verbose: opts.verbose,
      json: opts.json,
    });

    process.on("SIGINT", () => {
      handle.abort();
    });

    try {
      const result = await handle.result;

      if (!opts.json) {
        console.log(chalk.dim(`  Recording: ${result.outputDir}`));
        console.log(chalk.dim(`  Manifest:  ${path.join(result.outputDir, "manifest.json")}`));
        if (result.manifest.video) {
          console.log(chalk.dim(`  Video:     ${path.join(result.outputDir, result.manifest.video)}`));
        }
      }
    } catch (err) {
      handle.events.emit("run:error", {
        error: err instanceof Error ? err : new Error(String(err)),
      });
      process.exit(1);
    }
  });
