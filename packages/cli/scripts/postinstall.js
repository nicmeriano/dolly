#!/usr/bin/env node

import { execSync } from "node:child_process";
import { createInterface } from "node:readline";

function run(cmd) {
  try {
    execSync(cmd, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function which(bin) {
  try {
    execSync(`which ${bin}`, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function prompt(question) {
  return new Promise((resolve) => {
    // If stdin isn't a TTY (CI, piped), skip the prompt
    if (!process.stdin.isTTY) {
      resolve(false);
      return;
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith("y"));
    });
  });
}

console.log("\n  Dolly — postinstall\n");

// 1. Install Playwright Chromium
console.log("  Installing Playwright Chromium...");
if (run("npx playwright install chromium")) {
  console.log("  ✓ Chromium installed\n");
} else {
  console.warn("  ⚠ Failed to install Chromium. Run manually: npx playwright install chromium\n");
}

// 2. Check agent-browser (needed for /dolly skill to explore apps and generate plans)
if (which("agent-browser")) {
  console.log("  ✓ agent-browser found\n");
} else {
  console.log("  ⚠ agent-browser not found");
  console.log("    Dolly uses agent-browser to explore web apps and generate recording plans.\n");

  const shouldInstall = await prompt("  Install agent-browser now? [Y/n] ");

  if (shouldInstall) {
    console.log("\n  Installing agent-browser...");
    if (run("npm install -g agent-browser")) {
      console.log("  ✓ agent-browser installed");
      console.log("  Installing agent-browser browser...");
      if (run("agent-browser install")) {
        console.log("  ✓ agent-browser browser installed\n");
      } else {
        console.warn("  ⚠ Failed to install agent-browser browser. Run manually: agent-browser install\n");
      }
    } else {
      console.warn("  ⚠ Failed to install agent-browser. Run manually: npm install -g agent-browser && agent-browser install\n");
    }
  } else {
    console.log("\n  Skipped. Install later: npm install -g agent-browser && agent-browser install\n");
  }
}

console.log("  ✓ Dolly installed successfully!\n");
console.log("  Quick start:");
console.log("    dolly record <plan.json>    Record a demo");
console.log("    dolly studio                Open post-production studio");
console.log("    dolly --help                See all commands\n");
