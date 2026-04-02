const test = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

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
    label: "Open failed document",
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
