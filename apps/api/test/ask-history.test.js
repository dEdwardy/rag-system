import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  createAskAssistantService,
  createAssistantRecord
} from './support/ask-assistant-test-helpers.js';

test('askAssistant uses recent history for a short follow-up rewrite', async () => {
  const rewriteCalls = [];
  const retrievalQueries = [];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      retrievalProfile: {
        topK: 4,
        scoreThreshold: 0,
        chunkWindow: 0,
        enableHybrid: false,
        enableRerank: false,
        filtersJson: null,
        strategyJson: {
          queryRewrite: {
            enabled: false,
            mode: 'off',
            maxAddedLatencyMs: 0
          }
        }
      }
    }),
    messages: {
      listRecentConversationMessages: async () => [
        {
          id: 'message-1',
          role: 'assistant',
          content: 'The marker is in section B.',
          traceId: null
        }
      ]
    },
    retrieval: {
      retrieve: async (input) => {
        retrievalQueries.push(input.query);
        return {
          retrievedChunks: [
            {
              chunkId: 'chunk-1',
              documentId: 'doc-1',
              documentTitle: 'Doc',
              chunkIndex: 0,
              content: 'Marker content',
              score: 0.9,
              isPrimary: true,
              pageNo: 1,
              sectionTitle: 'B'
            }
          ],
          contextGroups: [],
          execution: {
            actualMode: 'vector',
            usedFallback: false,
            fallbackReason: null
          }
        };
      }
    },
    llm: {
      rewriteQuery: async (input) => {
        rewriteCalls.push(input);
        return {
          rewrittenQuery: 'where is the marker in section B',
          modelName: 'test-model',
          usedFallback: false,
          promptId: 'rewrite-query.v1'
        };
      }
    },
    traces: {
      createTrace: async () => ({ id: 'trace-history' }),
      updateTrace: async () => ({})
    }
  });

  const result = await service.askAssistant({
    assistantId: 'assistant-1',
    conversationId: 'conversation-1',
    question: '它呢？'
  });

  assert.equal(rewriteCalls.length, 1);
  assert.deepEqual(rewriteCalls[0].history, [
    {
      role: 'assistant',
      content: 'The marker is in section B.'
    }
  ]);
  assert.deepEqual(retrievalQueries, ['where is the marker in section B']);
  assert.equal(result.traceId, 'trace-history');
});

test('searchAssistant uses recent history for a short follow-up rewrite', async () => {
  const rewriteCalls = [];
  const retrievalQueries = [];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      retrievalProfile: {
        topK: 4,
        scoreThreshold: 0,
        chunkWindow: 0,
        enableHybrid: false,
        enableRerank: false,
        filtersJson: null,
        strategyJson: {
          queryRewrite: {
            enabled: false,
            mode: 'off',
            maxAddedLatencyMs: 0
          }
        }
      }
    }),
    messages: {
      listRecentConversationMessages: async () => [
        {
          id: 'message-1',
          role: 'assistant',
          content: 'The marker is in section B.',
          traceId: null
        }
      ]
    },
    retrieval: {
      retrieve: async (input) => {
        retrievalQueries.push(input.query);
        return {
          retrievedChunks: [],
          contextGroups: [],
          execution: {
            actualMode: 'vector',
            usedFallback: false,
            fallbackReason: null
          }
        };
      }
    },
    llm: {
      rewriteQuery: async (input) => {
        rewriteCalls.push(input);
        return {
          rewrittenQuery: 'where is the marker in section B',
          modelName: 'test-model',
          usedFallback: false,
          promptId: 'rewrite-query.v1'
        };
      }
    }
  });

  await service.searchAssistant({
    assistantId: 'assistant-1',
    question: '它呢？',
    conversationId: 'conversation-1'
  });

  assert.equal(rewriteCalls.length, 1);
  assert.deepEqual(rewriteCalls[0].history, [
    {
      role: 'assistant',
      content: 'The marker is in section B.'
    }
  ]);
  assert.deepEqual(retrievalQueries, ['where is the marker in section B']);
});
