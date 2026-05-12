'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { appBuilderPath } = require('app-builder-bin');

async function afterPack(context) {
  // Only apply for Windows targets (electronPlatformName is typically 'win32')
  if (context.electronPlatformName !== 'win32') return;

  const iconPath = path.join(process.cwd(), 'build', 'icon.ico');
  if (!fs.existsSync(iconPath)) {
    throw new Error(`Icon not found: ${iconPath}`);
  }

  const appOutDir = context.appOutDir;
  const exeCandidates = fs
    .readdirSync(appOutDir)
    .filter((f) => f.toLowerCase().endsWith('.exe'))
    .map((f) => path.join(appOutDir, f));

  if (exeCandidates.length === 0) {
    throw new Error(`No .exe found in appOutDir: ${appOutDir}`);
  }

  // In this project there is usually a single exe in win-unpacked, but we pick the biggest file to be safe.
  const exePath = exeCandidates
    .map((p) => ({ p, size: fs.statSync(p).size }))
    .sort((a, b) => b.size - a.size)[0].p;

  // app-builder rcedit args: [file, '--set-icon', iconPath]
  const rceditArgs = [exePath, '--set-icon', iconPath];

  const result = spawnSync(appBuilderPath, ['rcedit', '--args', JSON.stringify(rceditArgs)], {
    stdio: 'inherit',
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error(`rcedit failed with exit code ${result.status}`);
  }
}

module.exports = afterPack;

