const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, utimesSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");

test("resolveBuiltApiEntry returns the only existing legacy entry", async () => {
  const apiRoot = mkdtempSync(join(tmpdir(), "rag-api-entry-"));
  const legacyEntry = join(apiRoot, "dist", "main.js");

  mkdirSync(join(apiRoot, "dist"), { recursive: true });
  writeFileSync(legacyEntry, "// legacy");

  const { resolveBuiltApiEntry } = await import("../scripts/resolve-built-api-entry.mjs");

  assert.equal(resolveBuiltApiEntry(apiRoot), legacyEntry);
});

test("resolveBuiltApiEntry falls back to nested dist/apps/api/src/main.js when legacy output is absent", async () => {
  const apiRoot = mkdtempSync(join(tmpdir(), "rag-api-entry-"));
  const nestedEntry = join(apiRoot, "dist", "apps", "api", "src", "main.js");

  mkdirSync(join(apiRoot, "dist", "apps", "api", "src"), { recursive: true });
  writeFileSync(nestedEntry, "// nested");

  const { resolveBuiltApiEntry } = await import("../scripts/resolve-built-api-entry.mjs");

  assert.equal(resolveBuiltApiEntry(apiRoot), nestedEntry);
});

test("resolveBuiltApiEntry prefers the most recently updated built entry when both layouts exist", async () => {
  const apiRoot = mkdtempSync(join(tmpdir(), "rag-api-entry-"));
  const legacyEntry = join(apiRoot, "dist", "main.js");
  const nestedEntry = join(apiRoot, "dist", "apps", "api", "src", "main.js");

  mkdirSync(join(apiRoot, "dist", "apps", "api", "src"), { recursive: true });
  writeFileSync(legacyEntry, "// legacy");
  writeFileSync(nestedEntry, "// nested");
  utimesSync(legacyEntry, new Date("2026-04-01T00:00:00.000Z"), new Date("2026-04-01T00:00:00.000Z"));
  utimesSync(nestedEntry, new Date("2026-04-01T00:00:01.000Z"), new Date("2026-04-01T00:00:01.000Z"));

  const { resolveBuiltApiEntry } = await import("../scripts/resolve-built-api-entry.mjs");

  assert.equal(resolveBuiltApiEntry(apiRoot), nestedEntry);
});

test("resolveBuiltApiEntry returns the expected nested path when nothing has been built yet", async () => {
  const apiRoot = mkdtempSync(join(tmpdir(), "rag-api-entry-"));
  const expectedEntry = join(apiRoot, "dist", "apps", "api", "src", "main.js");

  const { resolveBuiltApiEntry } = await import("../scripts/resolve-built-api-entry.mjs");

  assert.equal(resolveBuiltApiEntry(apiRoot), expectedEntry);
});
