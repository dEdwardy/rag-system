import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

export function resolveBuiltApiEntry(apiRoot) {
  const legacyEntry = resolve(apiRoot, "dist/main.js");
  const nestedEntry = resolve(apiRoot, "dist/apps/api/src/main.js");
  const existingEntries = [legacyEntry, nestedEntry].filter(entryPath => existsSync(entryPath));

  if (existingEntries.length === 1) {
    return existingEntries[0];
  }

  if (existingEntries.length === 2) {
    const [firstEntry, secondEntry] = existingEntries;
    const firstMtime = statSync(firstEntry).mtimeMs;
    const secondMtime = statSync(secondEntry).mtimeMs;

    return secondMtime >= firstMtime ? secondEntry : firstEntry;
  }

  return nestedEntry;
}
