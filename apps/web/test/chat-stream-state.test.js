const test = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

const helperModuleUrl = pathToFileURL(
  resolve(__dirname, "../src/pages/chat/chat-stream-state.ts")
).href;

async function loadChatStreamHelpers() {
  return import(helperModuleUrl);
}

test("chat stream state creates optimistic user and pending assistant messages", async () => {
  const { createPendingChatTurn } = await loadChatStreamHelpers();

  const result = createPendingChatTurn({
    question: "What changed?"
  });

  assert.equal(result.userMessage.role, "user");
  assert.equal(result.userMessage.content, "What changed?");
  assert.equal(result.assistantMessage.role, "assistant");
  assert.equal(result.assistantMessage.status, "streaming");
  assert.equal(result.assistantMessage.content, "");
});

test("chat stream state applies answer deltas and final payload", async () => {
  const { createPendingChatTurn, applyChatStreamEvent } = await loadChatStreamHelpers();

  const pending = createPendingChatTurn({
    question: "Explain the marker."
  });

  const withDelta = applyChatStreamEvent(pending.assistantMessage, {
    type: "answer_delta",
    delta: "Marker "
  });
  const finalized = applyChatStreamEvent(withDelta, {
    type: "final",
    data: {
      conversationId: "conversation-1",
      traceId: "trace-1",
      assistantMessageId: "assistant-message-1",
      answer: "Marker alpha",
      citations: [
        {
          chunkId: "chunk-1",
          documentId: "document-1",
          documentTitle: "Doc",
          pageNo: null,
          sectionTitle: null,
          snippet: "Marker alpha"
        }
      ]
    }
  });

  assert.equal(withDelta.content, "Marker ");
  assert.equal(finalized.content, "Marker alpha");
  assert.equal(finalized.status, "done");
  assert.equal(finalized.traceId, "trace-1");
  assert.equal(finalized.citations.length, 1);
});
