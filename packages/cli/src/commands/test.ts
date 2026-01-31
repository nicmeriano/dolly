import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { validatePlan } from "@dolly/schema";
import { test } from "@dolly/core";

export const testCommand = new Command("test")
  .description("Fast plan validation — runs all steps without video recording")
  .argument("<plan>", "Path to plan.json file")
  .option("-o, --output-dir <dir>", "Override output directory")
  .option("--headed", "Show browser window")
  .option("-v, --verbose", "Show step-level detail")
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

    const plan = validation.plan;

    console.log(
      chalk.bold.cyan(
        `\n  Testing "${plan.name}" — ${plan.actions.length} action(s), ` +
          `${plan.actions.reduce((sum, a) => sum + a.steps.length, 0)} total step(s)\n`,
      ),
    );

    const handle = test({
      plan,
      headed: opts.headed,
      outputDir: opts.outputDir,
    });

    process.on("SIGINT", () => {
      handle.abort();
    });

    try {
      const result = await handle.result;

      // Print results
      let actionIndex = 0;
      for (const action of plan.actions) {
        const actionSteps = result.steps.filter((s) => s.actionId === action.id);
        const actionPassed = actionSteps.every((s) => s.passed);
        const failedStep = actionSteps.find((s) => !s.passed);

        const icon = actionPassed ? chalk.green("✓") : chalk.red("✗");
        const label = `Action ${actionIndex + 1}/${plan.actions.length}: ${action.id} (${action.steps.length} steps)`;

        console.log(`  ${icon} ${actionPassed ? chalk.white(label) : chalk.red(label)}`);

        if (opts.verbose && actionPassed) {
          for (const step of actionSteps) {
            console.log(chalk.dim(`    ✓ Step ${step.stepIndex + 1}: ${step.stepType}`));
          }
        }

        if (failedStep) {
          console.log(chalk.red(`    Step ${failedStep.stepIndex + 1} failed: ${failedStep.stepType}`));
          console.log(chalk.red(`    Error: ${failedStep.error}`));
          if (failedStep.screenshot) {
            console.log(chalk.dim(`    Screenshot: ${failedStep.screenshot}`));
          }
        }

        actionIndex++;

        // Stop printing after a failed action (test stops on first failure)
        if (!actionPassed) break;
      }

      console.log();

      if (result.passed) {
        console.log(
          chalk.bold.green(
            `  All ${result.totalActions} action(s) passed in ${(result.durationMs / 1000).toFixed(1)}s\n`,
          ),
        );
        console.log(chalk.dim(`  Screenshots: ${result.screenshotDir}\n`));
      } else {
        console.log(
          chalk.bold.red(
            `  Failed: ${result.failedActions}/${result.totalActions} action(s) in ${(result.durationMs / 1000).toFixed(1)}s\n`,
          ),
        );
        process.exit(1);
      }
    } catch (err) {
      console.error(chalk.red(`\n  ${err instanceof Error ? err.message : String(err)}\n`));
      process.exit(1);
    }
  });
