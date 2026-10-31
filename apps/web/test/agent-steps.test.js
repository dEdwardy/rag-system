import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  applyChatStreamEvent,
  createPendingChatTurn
} from '../src/pages/chat/chat-stream-state.ts';

test('chat stream state upserts agent steps and keeps final steps', () => {
  const pending = createPendingChatTurn({ question: 'Where is the marker?' });

  const running = applyChatStreamEvent(pending.assistantMessage, {
    type: 'step',
    step: {
      name: 'run_primary_retrieval',
      toolName: 'rag_search',
      status: 'running',
      summary: 'retrieving'
    }
  });
  const completed = applyChatStreamEvent(running, {
    type: 'step',
    step: {
      name: 'run_primary_retrieval',
      toolName: 'rag_search',
      status: 'completed',
      summary: 'retrieved 2 chunks'
    }
  });

  assert.equal(completed.steps.length, 1);
  assert.equal(completed.steps[0].status, 'completed');
  assert.equal(completed.steps[0].summary, 'retrieved 2 chunks');

  const final = applyChatStreamEvent(completed, {
    type: 'final',
    data: {
      conversationId: 'conversation-1',
      assistantMessageId: 'assistant-message-1',
      traceId: 'trace-1',
      answer: 'answer',
      citations: [],
      agent: {
        steps: [
          {
            name: 'route_question',
            toolName: null,
            status: 'completed',
            summary: 'selected knowledge_base'
          }
        ]
      }
    }
  });

  assert.deepEqual(final.steps, [
    {
      name: 'route_question',
      toolName: null,
      status: 'completed',
      summary: 'selected knowledge_base'
    }
  ]);
});
