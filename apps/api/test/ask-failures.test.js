const assert = require("node:assert/strict");
const { AskAssistantService } = require("../src/modules/assistants/ask-assistant.service.ts");
const { VectorStoreCompatibilityError } = require("../src/infra/vector-store/vector-store.types.ts");
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

test("AskAssistantService persists embedding diagnostics when retrieval fails on index compatibility", async () => {
  const createdTraces = [];
  const embeddingDiagnostics = {
    active: {
      provider: "fallback",
      model: "hash-v1",
      modelName: "fallback:hash-v1",
      dimensions: 256,
      modelSource: "builtin:fallback",
      dimensionsSource: "builtin:fallback",
      fallbackState: "local_deterministic"
    },
    indexed: {
      provider: "openai",
      model: "text-embedding-3-small",
      modelName: "openai:text-embedding-3-small",
      dimensions: 1536,
      fallbackState: "none",
      recordCount: 42,
      documentCount: 3
    }
  };
  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      retrievalProfile: {
        topK: 3
      }
    }),
    retrieval: {
      retrieve: async () => {
        throw new VectorStoreCompatibilityError(
          "Embedding index compatibility error for knowledge base \"kb-1\": Active retrieval embedding config fallback:hash-v1 (256d) (fallback=local_deterministic) is incompatible with indexed vectors openai:text-embedding-3-small (1536d) across 3 document(s). Reindex this knowledge base with one embedding config before continuing.",
          embeddingDiagnostics
        );
      }
    },
    traces: {
      createTrace: async input => {
        createdTraces.push(input);
        return { id: "trace-retrieval-compat-1", ...input };
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
      question: "why did retrieval fail on compatibility?"
    }),
    error => {
      assert.equal(error.getStatus(), 502);
      const response = error.getResponse();
      assert.equal(response.code, "ASK_PIPELINE_FAILED");
      assert.equal(response.traceId, "trace-retrieval-compat-1");
      assert.deepEqual(response.details, {
        stage: "retrieval",
        cause:
          'Embedding index compatibility error for knowledge base "kb-1": Active retrieval embedding config fallback:hash-v1 (256d) (fallback=local_deterministic) is incompatible with indexed vectors openai:text-embedding-3-small (1536d) across 3 document(s). Reindex this knowledge base with one embedding config before continuing.'
      });
      return true;
    }
  );

  assert.equal(createdTraces.length, 1);
  assert.deepEqual(createdTraces[0].retrievalMetadataJson.embedding, embeddingDiagnostics);
  assert.deepEqual(createdTraces[0].retrievalMetadataJson.failure, {
    stage: "retrieval",
    message:
      'Embedding index compatibility error for knowledge base "kb-1": Active retrieval embedding config fallback:hash-v1 (256d) (fallback=local_deterministic) is incompatible with indexed vectors openai:text-embedding-3-small (1536d) across 3 document(s). Reindex this knowledge base with one embedding config before continuing.'
  });
});
