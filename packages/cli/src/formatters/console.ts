import chalk from "chalk";
import ora, { type Ora } from "ora";
import type { TypedEmitter, RunEvents } from "@dolly/core";

export interface ConsoleFormatterOptions {
  verbose?: boolean;
  json?: boolean;
}

export function attachConsoleFormatter(
  events: TypedEmitter,
  options: ConsoleFormatterOptions = {},
): void {
  if (options.json) {
    attachJsonFormatter(events);
    return;
  }

  let spinner: Ora | undefined;

  events.on("run:start", (data) => {
    console.log(
      chalk.bold.cyan(`\n  Recording "${data.planName}" — ${data.totalActions} action(s)\n`),
    );
  });

  events.on("action:start", (data) => {
    spinner?.stop();
    spinner = ora({
      text: chalk.white(`Action ${data.index + 1}/${data.total}: ${data.actionId}`),
      prefixText: "  ",
    }).start();
  });

  events.on("step:start", (data) => {
    if (options.verbose && spinner) {
      spinner.text = chalk.white(
        `Action ${data.actionId} — step ${data.stepIndex + 1}/${data.totalSteps} (${data.stepType})`,
      );
    }
  });

  events.on("step:retry", (data) => {
    if (spinner) {
      spinner.text = chalk.yellow(
        `Action ${data.actionId} — retrying step ${data.stepIndex + 1} (attempt ${data.attempt + 1})`,
      );
    }
  });

  events.on("action:complete", (data) => {
    const retriesStr =
      data.retriesUsed > 0
        ? chalk.yellow(` (${data.retriesUsed} step retries)`)
        : "";
    spinner?.succeed(chalk.green(`${data.actionId}${retriesStr}`));
  });

  events.on("convert:start", () => {
    spinner = ora({
      text: chalk.white("Converting to mp4..."),
      prefixText: "  ",
    }).start();
  });

  events.on("convert:complete", (data) => {
    spinner?.succeed(chalk.green(`Converted → ${data.outputPath}`));
  });

  events.on("run:complete", (data) => {
    console.log(
      chalk.bold.green(`\n  Done in ${(data.durationMs / 1000).toFixed(1)}s\n`),
    );
  });

  events.on("run:error", (data) => {
    spinner?.fail(chalk.red(data.error.message));
  });
}

function attachJsonFormatter(events: TypedEmitter): void {
  const eventNames: Array<keyof RunEvents> = [
    "run:start",
    "run:complete",
    "run:error",
    "action:start",
    "action:complete",
    "step:start",
    "step:complete",
    "step:retry",
    "convert:start",
    "convert:complete",
  ];

  for (const name of eventNames) {
    events.on(name, (data: unknown) => {
      const payload: Record<string, unknown> = { event: name };
      if (data && typeof data === "object") {
        Object.assign(payload, data);
        if ("error" in payload && payload.error instanceof Error) {
          payload.error = { message: (payload.error as Error).message };
        }
      }
      console.log(JSON.stringify(payload));
    });
  }
}
