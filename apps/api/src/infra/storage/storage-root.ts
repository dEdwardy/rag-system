import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const REPO_ROOT_MARKERS = ["pnpm-workspace.yaml", ".git"];

export function resolveRepoRoot(startDir: string) {
  let currentDir = resolve(startDir);

  while (true) {
    if (REPO_ROOT_MARKERS.some(marker => existsSync(join(currentDir, marker)))) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

export function resolveStorageRoot(options?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  moduleDir?: string;
}) {
  const cwd = options?.cwd ?? process.cwd();
  const env = options?.env ?? process.env;
  const moduleDir = options?.moduleDir ?? __dirname;
  const configuredStorageRoot = env.STORAGE_ROOT?.trim();
  const repoRoot = resolveRepoRoot(cwd) ?? resolveRepoRoot(moduleDir) ?? resolve(cwd);

  if (!configuredStorageRoot) {
    return join(repoRoot, "storage");
  }

  if (isAbsolute(configuredStorageRoot)) {
    return configuredStorageRoot;
  }

  return resolve(repoRoot, configuredStorageRoot);
}
