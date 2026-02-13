#!/usr/bin/env node

import { execSync } from "node:child_process";

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

console.log("\n  Dolly — postinstall\n");

// Install Playwright Chromium
console.log("  Installing Playwright Chromium...");
if (run("npx playwright install chromium")) {
  console.log("  ✓ Chromium installed\n");
} else {
  console.warn("  ⚠ Failed to install Chromium. Run manually: npx playwright install chromium\n");
}

// Check ffmpeg
if (which("ffmpeg")) {
  console.log("  ✓ ffmpeg found\n");
} else {
  console.warn("  ⚠ ffmpeg not found in PATH");
  console.warn("    Install it: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)\n");
}

console.log("  ✓ Dolly installed successfully!\n");
console.log("  Quick start:");
console.log("    dolly record <plan.json>    Record a demo");
console.log("    dolly studio                Open post-production studio");
console.log("    dolly --help                See all commands\n");
