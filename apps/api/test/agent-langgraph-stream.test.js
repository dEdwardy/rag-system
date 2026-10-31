import { test } from 'vitest';
import assert from 'node:assert/strict';

import { LangGraphAnswerService } from '../src/modules/agent-tools/langgraph-answer.service.ts';

const authContext = {
  identity: {
    tenantId: 'tenant-1',
    userId: 'user-1',
    role: 'owner',
    sessionId: null,
    authSource: 'local'
  },
  currentIdentity: {
    tenantId: 'tenant-1',
    userId: 'user-1',
    role: 'owner',
    sessionId: null,
    authSource: 'local'
  }
};

const execution = {
  actualMode: 'vector',
  usedFallback: false,
  fallbackReason: null
};

function buildSearchResult(question, chunkId, score = 0.9) {
  return {
    query: {
      original: question,
      retrieval: question,
      rewritten: question === 'second query' ? 'second query' : null,
      rewrite: {
        modelName: null,
        usedFallback: null,
        promptId: null,
        skippedReason: 'disabled_by_default'
      }
    },
    chunks: [
      {
        chunkId,
        documentId: `doc-${chunkId}`,
        documentTitle: `Doc ${chunkId}`,
        chunkIndex: 0,
        content: `content ${chunkId}`,
        score,
        isPrimary: true,
        pageNo: 1,
        sectionTitle: 'Facts'
      }
    ],
    contextGroups: [
      {
        documentId: `doc-${chunkId}`,
        documentTitle: `Doc ${chunkId}`,
        startChunkIndex: 0,
        endChunkIndex: 0,
        chunkIds: [chunkId],
        primaryChunkIds: [chunkId],
        mergedContent: `content ${chunkId}`,
        pageNumbers: [1],
        sectionTitles: ['Facts']
      }
    ],
    diagnostics: {
      execution,
      embedding: null
    }
  };
}

test('LangGraph answer stream emits steps and answers from merged evidence', async () => {
  const events = [];
  const searchQuestions = [];
  let streamInput = null;

  const service = new LangGraphAnswerService({
    searchAssistant: async ({ question }) => {
      searchQuestions.push(question);
      return question === 'What is the marker?'
        ? buildSearchResult(question, 'chunk-1')
        : buildSearchResult(question, 'chunk-2');
    },
    askAssistant: async () => {
      throw new Error('non-stream answer should not be used in agent stream');
    },
    suggestAgentSecondPassQuery: async () => null,
    askAssistantStream: async (input) => {
      streamInput = input;
      await input.onEvent({ type: 'answer_delta', delta: 'answer' });
      await input.onEvent({
        type: 'final',
        data: {
          conversationId: 'conversation-1',
          assistantMessageId: 'assistant-message-1',
          traceId: 'trace-1',
          answer: 'answer',
          citations: [],
          modelName: 'test-model'
        }
      });
      return { answer: 'answer', traceId: 'trace-1' };
    }
  });

  const result = await service.answerStream({
    assistantId: 'assistant-1',
    question: 'What is the marker?',
    conversationId: 'conversation-1',
    authContext,
    boundedMultiStep: {
      enabled: true,
      rewrittenQuery: 'second query',
      requestSecondPass: true
    },
    onEvent: (event) => {
      events.push(event);
    }
  });

  assert.deepEqual(searchQuestions, ['What is the marker?', 'second query']);
  assert.equal(streamInput.retrievalEvidence.retrievedChunks.length, 2);
  assert.equal(
    streamInput.retrievalEvidence.retrievedChunks[0].chunkId,
    'chunk-1'
  );
  assert.equal(
    streamInput.retrievalEvidence.retrievedChunks[1].chunkId,
    'chunk-2'
  );
  assert.equal(streamInput.routeDecision.routeType, 'knowledge_base');
  assert.deepEqual(
    streamInput.agentExecution.steps.map((step) => step.name),
    [
      'route_question',
      'run_primary_retrieval',
      'judge_missing_information',
      'run_second_pass',
      'finalize_answer'
    ]
  );
  assert.ok(
    events.some(
      (event) => event.type === 'step' && event.step.name === 'run_second_pass'
    )
  );
  assert.ok(
    events.some(
      (event) =>
        event.type === 'step' &&
        event.step.name === 'route_question' &&
        event.step.status === 'running'
    )
  );
  assert.equal(result.answerResult.answer, 'answer');
});

test('LangGraph answer stream can suggest a second pass without caller input', async () => {
  const searchQuestions = [];
  let streamInput = null;

  const service = new LangGraphAnswerService({
    searchAssistant: async ({ question }) => {
      searchQuestions.push(question);
      return question === 'What is the marker?'
        ? buildSearchResult(question, 'chunk-1', 0.1)
        : buildSearchResult(question, 'chunk-2');
    },
    suggestAgentSecondPassQuery: async () => 'second query',
    askAssistant: async () => {
      throw new Error('non-stream answer should not be used in agent stream');
    },
    askAssistantStream: async (input) => {
      streamInput = input;
      return { answer: 'answer', traceId: 'trace-1' };
    }
  });

  const result = await service.answerStream({
    assistantId: 'assistant-1',
    question: 'What is the marker?',
    conversationId: 'conversation-1',
    authContext,
    onEvent: () => undefined
  });

  assert.deepEqual(searchQuestions, ['What is the marker?', 'second query']);
  assert.equal(streamInput.retrievalEvidence.retrievedChunks.length, 2);
  assert.equal(result.secondPassQuery, 'second query');
  assert.equal(
    result.steps.find((step) => step.name === 'judge_missing_information')
      ?.diagnostics.suggestedQuery,
    'second query'
  );
});
