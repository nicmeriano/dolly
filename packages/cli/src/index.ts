#!/usr/bin/env node

import { Command } from "commander";
import { recordCommand } from "./commands/record.js";
import { stitchCommand } from "./commands/stitch.js";
import { validateCommand } from "./commands/validate.js";
import { inspectCommand } from "./commands/inspect.js";

const program = new Command()
  .name("dolly")
  .description("Record cinematic product demo videos from web apps")
  .version("0.1.0");

program.addCommand(recordCommand);
program.addCommand(stitchCommand);
program.addCommand(validateCommand);
program.addCommand(inspectCommand);

program.parse();
