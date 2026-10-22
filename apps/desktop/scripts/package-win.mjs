import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const releaseDir = path.resolve(desktopRoot, "release", "Tutu-Twat-Mal-win32-x64");
const electronDist = path.resolve(desktopRoot, "node_modules", "electron", "dist");

console.log("Packaging တူတူတွက်မယ် Desktop for Windows (win32-x64)...");

if (!fs.existsSync(electronDist)) {
  console.error("Error: Electron dist binary not found at", electronDist);
  process.exit(1);
}

// 1. Ensure build outputs exist
const mainBundle = path.resolve(desktopRoot, "dist-electron", "main.cjs");
const preloadBundle = path.resolve(desktopRoot, "dist-electron", "preload.cjs");
const rendererIndex = path.resolve(desktopRoot, "dist", "index.html");

if (!fs.existsSync(mainBundle) || !fs.existsSync(preloadBundle) || !fs.existsSync(rendererIndex)) {
  console.error("Error: Required build assets are missing. Run 'pnpm build' first.");
  process.exit(1);
}

// 2. Prepare release directory
if (fs.existsSync(releaseDir)) {
  console.log("Cleaning previous release directory...");
  fs.rmSync(releaseDir, { recursive: true, force: true });
}
fs.mkdirSync(releaseDir, { recursive: true });

// 3. Copy Electron binaries and resources
console.log("Copying Electron runtime binaries...");
fs.cpSync(electronDist, releaseDir, { recursive: true });

// 4. Rename executable
const originalExe = path.resolve(releaseDir, "electron.exe");
const targetExe = path.resolve(releaseDir, "Tutu-Twat-Mal-Assistant.exe");
if (fs.existsSync(originalExe)) {
  fs.renameSync(originalExe, targetExe);
  console.log("Renamed executable to Tutu-Twat-Mal-Assistant.exe");
}

// 5. Setup resources/app
const resourcesDir = path.resolve(releaseDir, "resources");
const defaultAsar = path.resolve(resourcesDir, "default_app.asar");
if (fs.existsSync(defaultAsar)) {
  fs.unlinkSync(defaultAsar);
}

const appDir = path.resolve(resourcesDir, "app");
fs.mkdirSync(appDir, { recursive: true });

console.log("Packaging application bundles into resources/app...");
// Copy dist-electron
fs.cpSync(path.resolve(desktopRoot, "dist-electron"), path.resolve(appDir, "dist-electron"), { recursive: true });
// Copy dist (renderer)
fs.cpSync(path.resolve(desktopRoot, "dist"), path.resolve(appDir, "dist"), { recursive: true });

// Minimal production package.json
const pkgJson = {
  name: "tutu-twat-mal-assistant",
  productName: "တူတူတွက်မယ် Assistant",
  version: "0.1.0",
  main: "dist-electron/main.cjs",
  type: "module",
};
fs.writeFileSync(path.resolve(appDir, "package.json"), JSON.stringify(pkgJson, null, 2), "utf8");

// Runtime dependencies (zod, contracts, ui) are bundled into main.cjs & dist/ by Vite

// 6. Create quick portable launcher batch file
const launcherBat = `@echo off
start "" "%~dp0Tutu-Twat-Mal-Assistant.exe" %*
`;
fs.writeFileSync(path.resolve(releaseDir, "run-tutu-twat-mal.bat"), launcherBat, "utf8");

console.log("Windows packaging complete!");
console.log(`Executable: ${targetExe}`);
console.log(`Release folder: ${releaseDir}`);
