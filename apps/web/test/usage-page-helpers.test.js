import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const helperModuleUrl = pathToFileURL(
  resolve(__dirname, "../src/pages/usage/usage-page-helpers.ts")
).href;

async function loadUsageHelpers() {
  return import(helperModuleUrl);
}

test("usage helper deep-links to failed document when latest failure exists", async () => {
  const { buildRunSummaryActionTarget } = await loadUsageHelpers();

  const target = buildRunSummaryActionTarget({
    locale: "en",
    latestFailureDocumentId: "doc-123"
  });

  assert.deepEqual(target, {
    label: "Open item with issues",
    to: "/documents/doc-123"
  });
});

test("usage helper falls back to knowledge base run summary when no failure anchor exists", async () => {
  const { buildRunSummaryActionTarget } = await loadUsageHelpers();

  const target = buildRunSummaryActionTarget({
    locale: "zh",
    latestFailureDocumentId: null
  });

  assert.deepEqual(target, {
    label: "查看运行摘要",
    to: "/knowledge-base"
  });
});
