import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const apiRoot = resolve(import.meta.dirname, "..");
const preferredEntry = resolve(apiRoot, "dist/apps/api/src/main.js");
const legacyEntry = resolve(apiRoot, "dist/main.js");
const entry = existsSync(preferredEntry) ? preferredEntry : legacyEntry;

if (!existsSync(entry)) {
  throw new Error(`Built API entry not found. Expected ${preferredEntry} or ${legacyEntry}. Run pnpm --filter @rag-system/api build first.`);
}

const child = spawn(process.execPath, [entry], {
  cwd: apiRoot,
  stdio: "inherit"
});

child.on("exit", code => {
  process.exit(code ?? 1);
});
