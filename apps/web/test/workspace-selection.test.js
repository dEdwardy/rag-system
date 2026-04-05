import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const helperModuleUrl = pathToFileURL(
  resolve(__dirname, "../src/features/api/workspace-selection.ts")
).href;

async function loadWorkspaceSelectionHelpers() {
  return import(helperModuleUrl);
}

test("workspace selection picks the first knowledge base as the primary workspace", async () => {
  const { getPrimaryKnowledgeBase } = await loadWorkspaceSelectionHelpers();

  const knowledgeBase = getPrimaryKnowledgeBase([
    { id: "kb-1", name: "Primary KB" },
    { id: "kb-2", name: "Secondary KB" }
  ]);

  assert.equal(knowledgeBase?.id, "kb-1");
});

test("workspace selection aligns the active assistant to the primary knowledge base", async () => {
  const { getPrimaryAssistantForKnowledgeBase } = await loadWorkspaceSelectionHelpers();

  const assistant = getPrimaryAssistantForKnowledgeBase(
    [
      { id: "assistant-1", kbId: "kb-2", name: "Other KB assistant" },
      { id: "assistant-2", kbId: "kb-1", name: "Primary KB assistant" }
    ],
    "kb-1"
  );

  assert.equal(assistant?.id, "assistant-2");
});

test("workspace selection does not silently fall back to an assistant from another knowledge base", async () => {
  const { getPrimaryAssistantForKnowledgeBase } = await loadWorkspaceSelectionHelpers();

  const assistant = getPrimaryAssistantForKnowledgeBase([{ id: "assistant-1", kbId: "kb-2", name: "Other KB assistant" }], "kb-1");

  assert.equal(assistant, null);
});
