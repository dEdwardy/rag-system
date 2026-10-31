import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  AGENT_LOOP_MAX_EVIDENCE_CHUNKS,
  AGENT_LOOP_MAX_ITERATIONS,
  LangGraphAgentLoopService
} from '../src/modules/agent-tools/langgraph-agent-loop.service.ts';
import { LlmToolCallingUnavailableError } from '../src/infra/llm/tool-calling.ts';

const authContext = {
  identity: {
    userId: 'user-auth',
    tenantId: 'tenant-auth',
    role: 'owner',
    sessionId: null,
    authSource: 'session'
  },
  currentIdentity: {
    userId: 'user-auth',
    tenantId: 'tenant-auth',
    role: 'owner',
    sessionId: null,
    authSource: 'session'
  }
};

function searchResult(query, chunkCount) {
  return {
    query: {
      original: query,
      retrieval: query,
      rewritten: null,
      rewrite: {
        modelName: null,
        usedFallback: null,
        promptId: null,
        skippedReason: 'disabled_by_default'
      }
    },
    chunks: Array.from({ length: chunkCount }, (_unused, index) => ({
      chunkId: `chunk-${index}`,
      documentId: `doc-${index}`,
      documentTitle: `Document ${index}`,
      chunkIndex: index,
      content: `Evidence about ${query} number ${index}`,
      score: 0.9 - index * 0.01,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: 'Overview'
    })),
    contextGroups: Array.from({ length: chunkCount }, (_unused, index) => ({
      documentId: `doc-${index}`,
      documentTitle: `Document ${index}`,
      startChunkIndex: index,
      endChunkIndex: index,
      chunkIds: [`chunk-${index}`],
      primaryChunkIds: [`chunk-${index}`],
      mergedContent: `Evidence about ${query} number ${index}`,
      pageNumbers: [1],
      sectionTitles: ['Overview']
    }))
  };
}

function buildService(options) {
  const searches = [];
  const answers = [];
  let modelTurn = 0;

  const askAssistantService = {
    searchAssistant: async (input) => {
      searches.push(input.question);
      const chunkCount = options.chunksPerSearch ?? 2;
      return searchResult(input.question, chunkCount);
    },
    askAssistant: async (input) => {
      answers.push(input.question);
      return {
        answer: 'final grounded answer',
        citations: [{ chunkId: 'chunk-0' }],
        answerStatus: 'grounded',
        routeType: 'knowledge_base',
        routeReason: 'default_kb_ask',
        traceId: 'trace-1'
      };
    }
  };

  const llmService = {
    generateWithTools: async (input) => {
      modelTurn += 1;
      assert.ok(Array.isArray(input.tools));
      assert.equal(input.tools.length, 1);
      assert.equal(input.tools[0].name, 'rag_search');
      return options.turns[Math.min(modelTurn - 1, options.turns.length - 1)];
    }
  };

  const service = new LangGraphAgentLoopService(
    askAssistantService,
    llmService
  );

  return { service, searches, answers, getModelTurns: () => modelTurn };
}

function searchCall(id, query) {
  return {
    id,
    name: 'rag_search',
    argumentsJson: JSON.stringify({ query })
  };
}

test('agent loop searches once, then finalizes through the answer path', async () => {
  const { service, searches, answers } = buildService({
    turns: [
      { content: null, toolCalls: [searchCall('call-1', 'retention policy')], modelName: 'fake' },
      { content: 'found the retention section', toolCalls: [], modelName: 'fake' }
    ]
  });

  const result = await service.answer({
    assistantId: 'assistant-1',
    question: 'What is the retention policy?',
    authContext
  });

  assert.deepEqual(searches, ['retention policy']);
  assert.deepEqual(answers, ['What is the retention policy?']);
  assert.equal(result.answerResult.answer, 'final grounded answer');
  assert.equal(result.iterations, 2);
  assert.equal(result.retrievedChunkCount, 2);
  assert.deepEqual(result.searchedQueries, ['retention policy']);
  assert.equal(result.planUnavailableReason, null);
  assert.deepEqual(
    result.steps.map((step) => step.name),
    ['plan', 'act', 'plan', 'finalize']
  );
  assert.equal(result.steps[1].status, 'completed');
  assert.equal(result.steps[1].toolName, 'rag_search');
});

test('agent loop finalizes without searching when the model asks for no tools', async () => {
  const { service, searches } = buildService({
    turns: [{ content: 'no search needed', toolCalls: [], modelName: 'fake' }]
  });

  const result = await service.answer({
    assistantId: 'assistant-1',
    question: 'Hello there',
    authContext
  });

  assert.deepEqual(searches, []);
  assert.equal(result.iterations, 1);
  assert.equal(result.steps.at(-1).name, 'finalize');
});

test('agent loop refuses tools outside the whitelist', async () => {
  const { service, searches } = buildService({
    turns: [
      {
        content: null,
        toolCalls: [
          { id: 'call-1', name: 'delete_everything', argumentsJson: '{}' }
        ],
        modelName: 'fake'
      },
      { content: 'done', toolCalls: [], modelName: 'fake' }
    ]
  });

  const result = await service.answer({
    assistantId: 'assistant-1',
    question: 'What is the retention policy?',
    authContext
  });

  assert.deepEqual(searches, []);
  const actStep = result.steps.find((step) => step.name === 'act');
  assert.equal(actStep.status, 'skipped');
  assert.equal(actStep.diagnostics.reason, 'tool_not_allowed');
});

test('agent loop refuses a repeated query', async () => {
  const { service, searches } = buildService({
    turns: [
      { content: null, toolCalls: [searchCall('call-1', 'retention policy')], modelName: 'fake' },
      { content: null, toolCalls: [searchCall('call-2', 'retention policy')], modelName: 'fake' },
      { content: 'done', toolCalls: [], modelName: 'fake' }
    ]
  });

  const result = await service.answer({
    assistantId: 'assistant-1',
    question: 'What is the retention policy?',
    authContext
  });

  assert.deepEqual(searches, ['retention policy']);
  const skipped = result.steps.filter(
    (step) => step.name === 'act' && step.status === 'skipped'
  );
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].diagnostics.reason, 'duplicate_query');
});

test('agent loop stops searching once enough evidence is in hand', async () => {
  const { service, searches } = buildService({
    chunksPerSearch: AGENT_LOOP_MAX_EVIDENCE_CHUNKS,
    turns: [
      { content: null, toolCalls: [searchCall('call-1', 'retention policy')], modelName: 'fake' },
      { content: null, toolCalls: [searchCall('call-2', 'retention policy details')], modelName: 'fake' },
      { content: 'done', toolCalls: [], modelName: 'fake' }
    ]
  });

  const result = await service.answer({
    assistantId: 'assistant-1',
    question: 'What is the retention policy?',
    authContext
  });

  assert.deepEqual(searches, ['retention policy']);
  const skipped = result.steps.filter(
    (step) => step.name === 'act' && step.status === 'skipped'
  );
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].diagnostics.reason, 'evidence_sufficient');
});

test('agent loop is bounded by the iteration limit', async () => {
  const { service, searches, getModelTurns } = buildService({
    turns: [{ content: null, toolCalls: [searchCall('call-1', 'a')], modelName: 'fake' }]
  });

  // Every turn asks for a fresh query so no other guard can stop the loop.
  let turn = 0;
  const service2 = new LangGraphAgentLoopService(
    {
      searchAssistant: async (input) => {
        searches.push(input.question);
        return searchResult(input.question, 1);
      },
      askAssistant: async () => ({
        answer: 'final grounded answer',
        citations: [],
        answerStatus: 'grounded'
      })
    },
    {
      generateWithTools: async () => {
        turn += 1;
        return {
          content: null,
          toolCalls: [searchCall(`call-${turn}`, `query-${turn}`)],
          modelName: 'fake'
        };
      }
    }
  );

  const result = await service2.answer({
    assistantId: 'assistant-1',
    question: 'Anything',
    authContext
  });

  assert.equal(result.iterations, AGENT_LOOP_MAX_ITERATIONS);
  assert.equal(result.steps.at(-1).name, 'finalize');
  assert.ok(searches.length < AGENT_LOOP_MAX_ITERATIONS + 1);
  void service;
  void getModelTurns;
});

test('agent loop still answers when tool calling is unavailable', async () => {
  const answers = [];
  const service = new LangGraphAgentLoopService(
    {
      searchAssistant: async () => {
        throw new Error('should not search');
      },
      askAssistant: async (input) => {
        answers.push(input.question);
        return {
          answer: 'deterministic answer',
          citations: [],
          answerStatus: 'grounded'
        };
      }
    },
    {
      generateWithTools: async () => {
        throw new LlmToolCallingUnavailableError();
      }
    }
  );

  const result = await service.answer({
    assistantId: 'assistant-1',
    question: 'What is the retention policy?',
    authContext
  });

  assert.deepEqual(answers, ['What is the retention policy?']);
  assert.equal(result.planUnavailableReason, 'tool_calling_unavailable');
  assert.equal(result.answerResult.answer, 'deterministic answer');
  const planStep = result.steps.find((step) => step.name === 'plan');
  assert.equal(planStep.status, 'skipped');
});
