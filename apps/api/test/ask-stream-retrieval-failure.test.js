const assert = require("node:assert/strict");

const { AskAssistantService } = require("../src/modules/assistants/ask-assistant.service.ts");
const {
  createAskAssistantService,
  createAssistantRecord
} = require("./support/ask-assistant-test-helpers.js");

test("AskAssistantService stream creates a failed trace when retrieval throws before trace creation", async () => {
  const events = [];
  const createdTraces = [];

  const service = createAskAssistantService({
    assistant: createAssistantRecord(),
    retrieval: {
      retrieve: async () => {
        throw new Error("synthetic retrieval failure");
      }
    },
    traces: {
      createTrace: async input => {
        createdTraces.push(input);
        return { id: "trace-stream-retrieval-1", ...input };
      },
      updateTrace: async () => {
        throw new Error("updateTrace should not be used when retrieval fails before trace creation");
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  await assert.rejects(
    service.askAssistantStream({
      assistantId: "assistant-1",
      question: "why did stream retrieval fail?",
      onEvent: event => {
        events.push(event);
      }
    }),
    error => {
      assert.equal(error.getStatus(), 502);
      const response = error.getResponse();
      assert.equal(response.code, "ASK_PIPELINE_FAILED");
      assert.equal(response.traceId, "trace-stream-retrieval-1");
      assert.deepEqual(response.details, {
        stage: "retrieval",
        cause: "synthetic retrieval failure"
      });
      return true;
    }
  );

  assert.deepEqual(
    events.map(event => (event.type === "status" ? `${event.type}:${event.phase}` : event.type)),
    ["status:started", "status:retrieving"]
  );
  assert.equal(createdTraces.length, 1);
  assert.equal(createdTraces[0].status, "failed");
  assert.equal(createdTraces[0].errorMessage, "synthetic retrieval failure");
  assert.deepEqual(createdTraces[0].retrievalMetadataJson.failure, {
    stage: "retrieval",
    message: "synthetic retrieval failure"
  });
});
