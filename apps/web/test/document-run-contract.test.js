const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");

test("web document run types include backend failureSummary fields for list and summary responses", async () => {
  const source = await readFile(resolve(__dirname, "../src/types/api.ts"), "utf8");

  assert.match(source, /export type KnowledgeBaseDocumentRunRecord = \{[\s\S]*failureSummary\?: \{/);
  assert.match(source, /export type DocumentRunRecord = \{[\s\S]*failureSummary\?: \{/);
  assert.match(source, /latestRetryableFailure: \{[\s\S]*failureSummary: \{/);
  assert.match(source, /latestSkipped: \{[\s\S]*failureSummary: \{/);
  assert.match(source, /latestFailure: \{[\s\S]*failureSummary: \{/);
});
