const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const assistantPagePath = resolve(__dirname, "../src/pages/assistant/AssistantPage.tsx");

test("assistant page keeps stable strategy override section markers for future UI coverage", () => {
  const source = readFileSync(assistantPagePath, "utf8");

  assert.match(source, /data-testid="assistant-retrieval-strategy-section"/);
  assert.match(source, /data-testid="assistant-strategy-override-toggle"/);
  assert.match(source, /data-testid="assistant-strategy-mode"/);
});
