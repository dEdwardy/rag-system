const test = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

const helperModuleUrl = pathToFileURL(
  resolve(__dirname, "../src/pages/knowledge-base/knowledge-base-page-helpers.ts")
).href;

async function loadKnowledgeBaseHelpers() {
  return import(helperModuleUrl);
}

test("knowledge base workspace summary aggregates counts and ready tone", async () => {
  const { buildKnowledgeBaseWorkspaceSummary } = await loadKnowledgeBaseHelpers();

  const summary = buildKnowledgeBaseWorkspaceSummary({
    documents: [
      { status: "ready", chunkCount: 8 },
      { status: "ready", chunkCount: 5 },
      { status: "processing", chunkCount: 0 }
    ],
    assistantCount: 2
  });

  assert.deepEqual(summary, {
    chunkCount: 13,
    readyCount: 2,
    processingCount: 1,
    failedCount: 0,
    tone: "processing",
    toneColor: "yellow",
    toneLabelKey: "knowledgeBase.summary.processing"
  });
});

test("knowledge base workspace summary uses indigo for ready tone", async () => {
  const { buildKnowledgeBaseWorkspaceSummary } = await loadKnowledgeBaseHelpers();

  const summary = buildKnowledgeBaseWorkspaceSummary({
    documents: [
      { status: "ready", chunkCount: 8 },
      { status: "ready", chunkCount: 5 }
    ],
    assistantCount: 1
  });

  assert.equal(summary.tone, "ready");
  assert.equal(summary.toneColor, "indigo");
  assert.equal(summary.toneLabelKey, "knowledgeBase.summary.ready");
});

test("knowledge base workspace summary falls back to empty tone with no documents", async () => {
  const { buildKnowledgeBaseWorkspaceSummary } = await loadKnowledgeBaseHelpers();

  const summary = buildKnowledgeBaseWorkspaceSummary({
    documents: [],
    assistantCount: 0
  });

  assert.equal(summary.chunkCount, 0);
  assert.equal(summary.readyCount, 0);
  assert.equal(summary.processingCount, 0);
  assert.equal(summary.failedCount, 0);
  assert.equal(summary.tone, "empty");
  assert.equal(summary.toneColor, "gray");
  assert.equal(summary.toneLabelKey, "knowledgeBase.summary.empty");
});
