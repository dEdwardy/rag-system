const assert = require("node:assert/strict");
const { AskAssistantService } = require("../src/modules/assistants/ask-assistant.service.ts");
const {
  createAskAssistantService,
  createAssistantRecord
} = require("./support/ask-assistant-test-helpers.js");

test("AskAssistantService marks trace as failed when answer generation throws", async () => {
  const traceUpdates = [];
  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      retrievalProfile: {
        topK: 3
      }
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            chunkIndex: 0,
            content: "retrieved content",
            score: 0.9,
            isPrimary: true,
            pageNo: null,
            sectionTitle: null
          }
        ],
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => {
        throw new Error("synthetic answer failure");
      }
    },
    traces: {
      createTrace: async () => ({
        id: "trace-1"
      }),
      updateTrace: async (id, input) => {
        traceUpdates.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async ({ question }) => ({
        rewrittenQuery: question,
        modelName: "fallback-rewrite-local",
        usedFallback: true
      })
    }
  });

  await assert.rejects(
    service.askAssistant({
      assistantId: "assistant-1",
      question: "why did this fail?"
    }),
    error => {
      assert.equal(typeof error?.getStatus, "function");
      assert.equal(error.getStatus(), 502);

      const response = error.getResponse();
      assert.equal(response.statusCode, 502);
      assert.equal(response.error, "Bad Gateway");
      assert.equal(response.message, "Ask pipeline failed.");
      assert.equal(response.code, "ASK_PIPELINE_FAILED");
      assert.equal(response.traceId, "trace-1");
      assert.deepEqual(response.details, {
        stage: "answering",
        cause: "synthetic answer failure"
      });
      return true;
    }
  );

  assert.equal(traceUpdates.length, 1);
  assert.equal(traceUpdates[0].id, "trace-1");
  assert.equal(traceUpdates[0].input.status, "failed");
  assert.equal(traceUpdates[0].input.errorMessage, "synthetic answer failure");
  assert.deepEqual(traceUpdates[0].input.retrievalMetadataJson.failure, {
    stage: "answering",
    message: "synthetic answer failure"
  });
});

test("AskAssistantService creates a failed trace when retrieval throws before trace creation", async () => {
  const createdTraces = [];
  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      retrievalProfile: {
        topK: 3
      }
    }),
    retrieval: {
      retrieve: async () => {
        throw new Error("synthetic retrieval failure");
      }
    },
    traces: {
      createTrace: async input => {
        createdTraces.push(input);
        return { id: "trace-retrieval-1", ...input };
      },
      updateTrace: async () => {
        throw new Error("updateTrace should not be used when retrieval fails before trace creation");
      }
    },
    llm: {
      rewriteQuery: async ({ question }) => ({
        rewrittenQuery: question,
        modelName: "fallback-rewrite-local",
        usedFallback: true,
        promptId: "rewrite.v1"
      })
    }
  });

  await assert.rejects(
    service.askAssistant({
      assistantId: "assistant-1",
      question: "why did retrieval fail?"
    }),
    error => {
      assert.equal(error.getStatus(), 502);
      const response = error.getResponse();
      assert.equal(response.code, "ASK_PIPELINE_FAILED");
      assert.equal(response.traceId, "trace-retrieval-1");
      assert.deepEqual(response.details, {
        stage: "retrieval",
        cause: "synthetic retrieval failure"
      });
      return true;
    }
  );

  assert.equal(createdTraces.length, 1);
  assert.equal(createdTraces[0].status, "failed");
  assert.equal(createdTraces[0].errorMessage, "synthetic retrieval failure");
  assert.deepEqual(createdTraces[0].retrievalMetadataJson.failure, {
    stage: "retrieval",
    message: "synthetic retrieval failure"
  });
});
