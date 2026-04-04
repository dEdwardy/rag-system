import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

const apiRoot = resolve(import.meta.dirname, "..");

loadLocalEnvFiles();
cleanBuildArtifacts();
runPrismaGenerate();
runWatchServer();

function loadLocalEnvFiles() {
  for (const filePath of [resolve(apiRoot, ".env"), resolve(apiRoot, ".env.local")]) {
    if (existsSync(filePath)) {
      loadEnvFile(filePath);
    }
  }
}

function cleanBuildArtifacts() {
  rmSync(resolve(apiRoot, "dist"), { force: true, recursive: true });
  rmSync(resolve(apiRoot, "tsconfig.tsbuildinfo"), { force: true });
}

function runPrismaGenerate() {
  const result = runSyncPnpmCommand(["run", "prisma:generate"]);

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runWatchServer() {
  const child = runAsyncPnpmCommand(["exec", "tsx", "watch", "src/main.ts"]);

  const forwardSignal = signal => {
    child.kill(signal);
  };

  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);

  child.on("exit", code => {
    process.exit(code ?? 1);
  });
}

function runSyncPnpmCommand(args) {
  return process.platform === "win32"
    ? spawnSync("cmd.exe", ["/c", "pnpm", ...args], {
        cwd: apiRoot,
        env: process.env,
        stdio: "inherit"
      })
    : spawnSync("pnpm", args, {
        cwd: apiRoot,
        env: process.env,
        stdio: "inherit"
      });
}

function runAsyncPnpmCommand(args) {
  return process.platform === "win32"
    ? spawn("cmd.exe", ["/c", "pnpm", ...args], {
        cwd: apiRoot,
        env: process.env,
        stdio: "inherit"
      })
    : spawn("pnpm", args, {
        cwd: apiRoot,
        env: process.env,
        stdio: "inherit"
      });
}
