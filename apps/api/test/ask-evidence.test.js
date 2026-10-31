import { test } from 'vitest';
import assert from 'node:assert/strict';

import { buildRetrievalEvidence } from '../src/modules/assistants/retrieval-evidence.ts';
import {
  createAskAssistantService,
  createAssistantRecord
} from './support/ask-assistant-test-helpers.js';

function buildChunk(chunkId) {
  return {
    chunkId,
    documentId: `doc-${chunkId}`,
    documentTitle: `Doc ${chunkId}`,
    chunkIndex: 0,
    content: `content ${chunkId}`,
    score: 0.91,
    isPrimary: true,
    pageNo: 1,
    sectionTitle: 'Facts'
  };
}

function buildEvidence() {
  return buildRetrievalEvidence({
    primary: {
      query: {
        original: 'What is the marker?',
        retrieval: 'marker',
        rewritten: null
      },
      chunks: [buildChunk('chunk-1'), buildChunk('chunk-2')],
      contextGroups: [
        {
          documentId: 'doc-chunk-1',
          documentTitle: 'Doc chunk-1',
          startChunkIndex: 0,
          endChunkIndex: 0,
          chunkIds: ['chunk-1'],
          primaryChunkIds: ['chunk-1'],
          mergedContent: 'content chunk-1',
          pageNumbers: [1],
          sectionTitles: ['Facts']
        }
      ],
      diagnostics: {
        execution: {
          actualMode: 'vector',
          usedFallback: false,
          fallbackReason: null
        },
        embedding: null
      }
    }
  });
}

test('askAssistant uses precomputed agent evidence instead of retrieving again', async () => {
  let retrieveCalled = false;
  const service = createAskAssistantService({
    assistant: createAssistantRecord(),
    retrieval: {
      retrieve: async () => {
        retrieveCalled = true;
        throw new Error(
          'retrieval should be skipped when evidence is provided'
        );
      }
    },
    traces: {
      createTrace: async () => ({ id: 'trace-evidence' }),
      updateTrace: async () => ({})
    }
  });

  const result = await service.askAssistant({
    assistantId: 'assistant-1',
    conversationId: 'conversation-1',
    question: 'What is the marker?',
    retrievalEvidence: buildEvidence()
  });

  assert.equal(retrieveCalled, false);
  assert.equal(result.retrievedChunks.length, 2);
  assert.equal(result.retrievedChunks[0].chunkId, 'chunk-1');
  assert.equal(result.traceId, 'trace-evidence');
  assert.equal(result.routeType, 'knowledge_base');
});
