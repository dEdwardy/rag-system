import assert from 'node:assert/strict';
import { test } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

import { AgentToolsController } from '../src/modules/agent-tools/agent-tools.controller.ts';

test('AgentToolsController rejects requests with an invalid tool secret', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';

  const controller = new AgentToolsController(
    {
      searchAssistant: async () => {
        throw new Error('should not be called');
      },
      askAssistant: async () => {
        throw new Error('should not be called');
      }
    },
    {
      getTrace: async () => {
        throw new Error('should not be called');
      }
    },
    {
      getDocument: async () => {
        throw new Error('should not be called');
      },
      listDocumentChunks: async () => {
        throw new Error('should not be called');
      }
    }
  );

  await assert.rejects(
    controller.ragSearch({
      secret: 'wrong-secret',
      assistantId: 'assistant-1',
      question: 'what is the answer?'
    }),
    (error) => {
      assert.ok(error instanceof UnauthorizedException);
      return true;
    }
  );
});

test('AgentToolsController returns retrieval payload for rag_search without calling the answer path', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';

  const searchCalls = [];
  let askCalled = false;
  const controller = new AgentToolsController(
    {
      searchAssistant: async (input) => {
        searchCalls.push(input);
        return {
          query: {
            original: input.question,
            retrieval: input.question,
            rewritten: null,
            rewrite: {
              modelName: null,
              usedFallback: null,
              promptId: null,
              skippedReason: 'disabled_by_default'
            }
          },
          chunks: [
            {
              chunkId: 'chunk-1',
              documentId: 'doc-1',
              documentTitle: 'Demo document',
              chunkIndex: 2,
              content: 'retrieved evidence',
              score: 0.91,
              isPrimary: true,
              pageNo: 3,
              sectionTitle: 'Overview'
            }
          ],
          contextGroups: [
            {
              documentId: 'doc-1',
              documentTitle: 'Demo document',
              startChunkIndex: 2,
              endChunkIndex: 2,
              chunkIds: ['chunk-1'],
              primaryChunkIds: ['chunk-1'],
              mergedContent: 'retrieved evidence',
              pageNumbers: [3],
              sectionTitles: ['Overview']
            }
          ],
          diagnostics: {
            profile: {
              topK: 3,
              scoreThreshold: 0.2,
              chunkWindow: 0,
              enableHybrid: false,
              enableRerank: false
            },
            execution: {
              actualMode: 'vector',
              usedFallback: false,
              fallbackReason: null
            },
            embedding: null,
            filters: null,
            strategySummary: {
              retrievalMode: 'vector'
            }
          }
        };
      },
      askAssistant: async (input) => {
        askCalled = true;
        throw new Error(`should not call askAssistant: ${input.question}`);
      }
    },
    {
      getTrace: async () => ({ id: 'trace-1' })
    },
    {
      getDocument: async () => ({ id: 'doc-1', status: 'ready' }),
      listDocumentChunks: async () => []
    }
  );

  const result = await controller.ragSearch({
    secret: 'expected-secret',
    assistantId: 'assistant-1',
    question: 'what is the answer?',
    tenantId: 'tenant-1',
    userId: 'user-1'
  });

  assert.equal(askCalled, false);
  assert.equal(searchCalls.length, 1);
  assert.equal(searchCalls[0].assistantId, 'assistant-1');
  assert.equal(searchCalls[0].question, 'what is the answer?');
  assert.equal(searchCalls[0].authContext.identity.tenantId, 'tenant-1');
  assert.equal(searchCalls[0].authContext.identity.userId, 'user-1');
  assert.deepEqual(result.query, {
    original: 'what is the answer?',
    retrieval: 'what is the answer?',
    rewritten: null,
    rewrite: {
      modelName: null,
      usedFallback: null,
      promptId: null,
      skippedReason: 'disabled_by_default'
    }
  });
  assert.equal(result.chunks.length, 1);
  assert.equal(result.chunks[0].content, 'retrieved evidence');
  assert.deepEqual(result.citations[0], {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    documentTitle: 'Demo document',
    chunkIndex: 2,
    pageNo: 3,
    sectionTitle: 'Overview',
    score: 0.91
  });
  assert.deepEqual(result.sources[0], {
    documentId: 'doc-1',
    documentTitle: 'Demo document',
    chunkIds: ['chunk-1'],
    primaryChunkIds: ['chunk-1'],
    startChunkIndex: 2,
    endChunkIndex: 2,
    pageNumbers: [3],
    sectionTitles: ['Overview']
  });
  assert.equal(result.diagnostics.chunkCount, 1);
  assert.equal(result.diagnostics.sourceCount, 1);
});
