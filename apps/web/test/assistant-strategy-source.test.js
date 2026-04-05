import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const assistantPagePath = resolve(__dirname, "../src/pages/assistant/AssistantPage.tsx");

test("assistant page keeps stable strategy override section markers for future UI coverage", () => {
  const source = readFileSync(assistantPagePath, "utf8");

  assert.match(source, /data-testid="assistant-retrieval-strategy-section"/);
  assert.match(source, /data-testid="assistant-strategy-override-toggle"/);
  assert.match(source, /data-testid="assistant-strategy-mode"/);
});
