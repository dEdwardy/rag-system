const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");

test("web trace summary type covers current backend query-source and failure-stage variants", async () => {
  const source = await readFile(resolve(__dirname, "../src/types/api.ts"), "utf8");

  assert.match(source, /retrievalQuerySource:[\s\S]*"rewritten"/);
  assert.match(source, /retrievalQuerySource:[\s\S]*"original_disabled"/);
  assert.match(source, /retrievalQuerySource:[\s\S]*"original_unchanged"/);
  assert.match(source, /failedStage:\s*"retrieval"\s*\|\s*"answering"\s*\|\s*null/);
});
