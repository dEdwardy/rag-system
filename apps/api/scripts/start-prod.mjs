import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const apiRoot = resolve(import.meta.dirname, "..");
const workspaceRoot = resolve(apiRoot, "..", "..");
const preferredEntry = resolve(apiRoot, "dist/apps/api/src/main.js");
const legacyEntry = resolve(apiRoot, "dist/main.js");
const entry = existsSync(preferredEntry) ? preferredEntry : legacyEntry;

const candidateEnvFiles = [resolve(workspaceRoot, ".env.local"), resolve(workspaceRoot, ".env")];
const envFileArgs = candidateEnvFiles.flatMap(filePath =>
  existsSync(filePath) ? ["--env-file", filePath] : []
);

if (!existsSync(entry)) {
  throw new Error(`Built API entry not found. Expected ${preferredEntry} or ${legacyEntry}. Run pnpm --filter @rag-system/api build first.`);
}

const child = spawn(process.execPath, [...envFileArgs, entry], {
  cwd: apiRoot,
  stdio: "inherit"
});

child.on("exit", code => {
  process.exit(code ?? 1);
});
