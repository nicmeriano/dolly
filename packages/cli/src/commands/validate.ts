import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import { validatePlan } from "@nicmeriano/dolly-schema";
import { chromium } from "playwright";

export const validateCommand = new Command("validate")
  .description("Validate a plan file")
  .argument("<plan>", "Path to plan.json file")
  .option("--check-selectors", "Launch browser to verify selectors exist")
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
      console.error(chalk.red("Validation failed:\n"));
      for (const issue of validation.errors?.issues ?? []) {
        console.error(chalk.red(`  • ${issue.path.join(".")}: ${issue.message}`));
      }
      process.exit(1);
    }

    const plan = validation.plan;
    console.log(chalk.green("Schema validation passed."));
    console.log(chalk.dim(`  Name: ${plan.name}`));
    console.log(chalk.dim(`  Actions: ${plan.actions.length}`));
    console.log(
      chalk.dim(
        `  Steps: ${plan.actions.reduce((sum, a) => sum + a.steps.length, 0)}`,
      ),
    );

    if (opts.checkSelectors) {
      console.log(chalk.dim("\n  Checking selectors...\n"));

      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: plan.config.viewport,
      });
      const page = await context.newPage();

      const selectors: Array<{ actionId: string; stepIndex: number; selector: string }> = [];

      for (const action of plan.actions) {
        for (let i = 0; i < action.steps.length; i++) {
          const step = action.steps[i];
          if ("selector" in step && step.selector) {
            selectors.push({
              actionId: action.id,
              stepIndex: i,
              selector: step.selector,
            });
          }
        }
      }

      // Navigate to baseUrl first
      try {
        await page.goto(plan.config.baseUrl, { waitUntil: "domcontentloaded" });
      } catch (err) {
        console.error(chalk.yellow(`  Could not navigate to ${plan.config.baseUrl}`));
      }

      let failures = 0;
      for (const { actionId, stepIndex, selector } of selectors) {
        try {
          const count = await page.locator(selector).count();
          if (count === 0) {
            console.error(
              chalk.yellow(
                `  ⚠ ${actionId}[${stepIndex}]: "${selector}" — not found on current page`,
              ),
            );
            failures++;
          } else {
            console.log(
              chalk.dim(`  ✓ ${actionId}[${stepIndex}]: "${selector}" — ${count} match(es)`),
            );
          }
        } catch {
          console.error(
            chalk.red(`  ✗ ${actionId}[${stepIndex}]: "${selector}" — invalid selector`),
          );
          failures++;
        }
      }

      await browser.close();

      if (failures > 0) {
        console.log(
          chalk.yellow(
            `\n  ${failures} selector issue(s) found. Note: selectors are checked against the base URL only.\n`,
          ),
        );
      } else {
        console.log(chalk.green("\n  All selectors found.\n"));
      }
    }
  });
