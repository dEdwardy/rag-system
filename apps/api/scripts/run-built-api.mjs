import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { resolveBuiltApiEntry } from "./resolve-built-api-entry.mjs";

export function runBuiltApi({ apiRoot }) {
  const legacyEntry = resolve(apiRoot, "dist", "main.js");
  const nestedEntry = resolve(apiRoot, "dist", "apps/api/src/main.js");
  const entry = resolveBuiltApiEntry(apiRoot);
  if (!existsSync(entry)) {
    throw new Error(`Built API entry not found. Expected ${legacyEntry} or ${nestedEntry}. Run pnpm --filter @rag-system/api build first.`);
  }

  const child = spawn(process.execPath, [entry], {
    cwd: apiRoot,
    stdio: "inherit"
  });

  child.on("exit", code => {
    process.exit(code ?? 1);
  });
}
