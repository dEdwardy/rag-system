const assert = require('node:assert/strict');

const {
  AskAssistantService
} = require('../src/modules/assistants/ask-assistant.service.ts');
const {
  VectorStoreCompatibilityError
} = require('../src/infra/vector-store/vector-store.types.ts');
const {
  createAskAssistantService,
  createAssistantRecord
} = require('./support/ask-assistant-test-helpers.js');

test('AskAssistantService stream creates a failed trace when retrieval throws before trace creation', async () => {
  const events = [];
  const createdTraces = [];

  const service = createAskAssistantService({
    assistant: createAssistantRecord(),
    retrieval: {
      retrieve: async () => {
        throw new Error('synthetic retrieval failure');
      }
    },
    traces: {
      createTrace: async (input) => {
        createdTraces.push(input);
        return { id: 'trace-stream-retrieval-1', ...input };
      },
      updateTrace: async () => {
        throw new Error(
          'updateTrace should not be used when retrieval fails before trace creation'
        );
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
      assistantId: 'assistant-1',
      question: 'why did stream retrieval fail?',
      onEvent: (event) => {
        events.push(event);
      }
    }),
    (error) => {
      assert.equal(error.getStatus(), 502);
      const response = error.getResponse();
      assert.equal(response.code, 'ASK_PIPELINE_FAILED');
      assert.equal(response.traceId, 'trace-stream-retrieval-1');
      assert.deepEqual(response.details, {
        stage: 'retrieval',
        cause: 'synthetic retrieval failure'
      });
      return true;
    }
  );

  assert.deepEqual(
    events.map((event) =>
      event.type === 'status' ? `${event.type}:${event.phase}` : event.type
    ),
    ['status:started', 'status:retrieving']
  );
  assert.equal(createdTraces.length, 1);
  assert.equal(createdTraces[0].status, 'failed');
  assert.equal(createdTraces[0].errorMessage, 'synthetic retrieval failure');
  assert.deepEqual(createdTraces[0].retrievalMetadataJson.failure, {
    stage: 'retrieval',
    message: 'synthetic retrieval failure'
  });
});

test('AskAssistantService stream persists embedding diagnostics when retrieval fails on index compatibility', async () => {
  const events = [];
  const createdTraces = [];
  const embeddingDiagnostics = {
    active: {
      provider: 'fallback',
      model: 'hash-v1',
      modelName: 'fallback:hash-v1',
      dimensions: 256,
      modelSource: 'builtin:fallback',
      dimensionsSource: 'builtin:fallback',
      fallbackState: 'local_deterministic'
    },
    indexed: {
      provider: 'openai',
      model: 'text-embedding-3-small',
      modelName: 'openai:text-embedding-3-small',
      dimensions: 1536,
      fallbackState: 'none',
      recordCount: 42,
      documentCount: 3
    }
  };

  const service = createAskAssistantService({
    assistant: createAssistantRecord(),
    retrieval: {
      retrieve: async () => {
        throw new VectorStoreCompatibilityError(
          'Embedding index compatibility error for knowledge base "kb-1": Active retrieval embedding config fallback:hash-v1 (256d) (fallback=local_deterministic) is incompatible with indexed vectors openai:text-embedding-3-small (1536d) across 3 document(s). Reindex this knowledge base with one embedding config before continuing.',
          embeddingDiagnostics
        );
      }
    },
    traces: {
      createTrace: async (input) => {
        createdTraces.push(input);
        return { id: 'trace-stream-retrieval-compat-1', ...input };
      },
      updateTrace: async () => {
        throw new Error(
          'updateTrace should not be used when retrieval fails before trace creation'
        );
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
      assistantId: 'assistant-1',
      question: 'why did stream retrieval fail on compatibility?',
      onEvent: (event) => {
        events.push(event);
      }
    }),
    (error) => {
      assert.equal(error.getStatus(), 502);
      const response = error.getResponse();
      assert.equal(response.code, 'ASK_PIPELINE_FAILED');
      assert.equal(response.traceId, 'trace-stream-retrieval-compat-1');
      assert.deepEqual(response.details, {
        stage: 'retrieval',
        cause:
          'Embedding index compatibility error for knowledge base "kb-1": Active retrieval embedding config fallback:hash-v1 (256d) (fallback=local_deterministic) is incompatible with indexed vectors openai:text-embedding-3-small (1536d) across 3 document(s). Reindex this knowledge base with one embedding config before continuing.'
      });
      return true;
    }
  );

  assert.deepEqual(
    events.map((event) =>
      event.type === 'status' ? `${event.type}:${event.phase}` : event.type
    ),
    ['status:started', 'status:retrieving']
  );
  assert.equal(createdTraces.length, 1);
  assert.deepEqual(
    createdTraces[0].retrievalMetadataJson.embedding,
    embeddingDiagnostics
  );
  assert.deepEqual(createdTraces[0].retrievalMetadataJson.failure, {
    stage: 'retrieval',
    message:
      'Embedding index compatibility error for knowledge base "kb-1": Active retrieval embedding config fallback:hash-v1 (256d) (fallback=local_deterministic) is incompatible with indexed vectors openai:text-embedding-3-small (1536d) across 3 document(s). Reindex this knowledge base with one embedding config before continuing.'
  });
});
