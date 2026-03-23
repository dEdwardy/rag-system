import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const apiRoot = resolve(import.meta.dirname, "..");
const distRoot = resolve(apiRoot, "dist");
const watchedFiles = [resolve(apiRoot, "tsconfig.json"), resolve(apiRoot, "nest-cli.json")];
const watchedDirs = [resolve(apiRoot, "src")];
const watchedExtensions = new Set([".ts", ".json"]);

if (needsBuild()) {
  console.log("[ensure-build] API sources changed. Running build...");
  execFileSync("pnpm", ["run", "build"], {
    cwd: apiRoot,
    stdio: "inherit",
    shell: true
  });
} else {
  console.log("[ensure-build] Reusing existing API build.");
}

function needsBuild() {
  if (!existsSync(distRoot)) {
    return true;
  }

  const distMtime = getNewestTreeMtime(distRoot);
  const newestSourceMtime = Math.max(
    ...watchedFiles.map(getFileMtime),
    ...watchedDirs.map(getNewestTreeMtime)
  );

  return newestSourceMtime > distMtime;
}

function getFileMtime(filePath) {
  if (!existsSync(filePath)) {
    return 0;
  }

  return statSync(filePath).mtimeMs;
}

function getNewestTreeMtime(rootDir) {
  if (!existsSync(rootDir)) {
    return 0;
  }

  let newest = statSync(rootDir).mtimeMs;

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, getNewestTreeMtime(entryPath));
      continue;
    }

    if (watchedExtensions.has(extname(entry.name))) {
      newest = Math.max(newest, statSync(entryPath).mtimeMs);
    }
  }

  return newest;
}
