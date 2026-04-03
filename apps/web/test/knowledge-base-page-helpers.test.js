import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

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

test("knowledge base next action points to documents when empty", async () => {
  const { buildKnowledgeBaseWorkspaceNextAction } = await loadKnowledgeBaseHelpers();

  const nextAction = buildKnowledgeBaseWorkspaceNextAction({
    documents: [],
    assistantCount: 0
  });

  assert.deepEqual(nextAction, {
    action: "add_documents",
    labelKey: "knowledgeBase.nextAction.addDocuments",
    actionHref: "/documents"
  });
});

test("knowledge base next action prioritizes failed documents", async () => {
  const { buildKnowledgeBaseWorkspaceNextAction } = await loadKnowledgeBaseHelpers();

  const nextAction = buildKnowledgeBaseWorkspaceNextAction({
    documents: [
      { status: "ready", chunkCount: 4 },
      { status: "failed", chunkCount: 0 }
    ],
    assistantCount: 1
  });

  assert.equal(nextAction.action, "review_failed_documents");
  assert.equal(nextAction.actionHref, "/documents");
});

test("knowledge base next action points to assistant when corpus is ready but no assistant is bound", async () => {
  const { buildKnowledgeBaseWorkspaceNextAction } = await loadKnowledgeBaseHelpers();

  const nextAction = buildKnowledgeBaseWorkspaceNextAction({
    documents: [{ status: "ready", chunkCount: 6 }],
    assistantCount: 0
  });

  assert.deepEqual(nextAction, {
    action: "bind_assistant",
    labelKey: "knowledgeBase.nextAction.bindAssistant",
    actionHref: "/assistant"
  });
});
