import assert from 'node:assert/strict';
import { test } from 'vitest';

import { AgentToolsController } from '../src/modules/agent-tools/agent-tools.controller.ts';
import { LangGraphAnswerService } from '../src/modules/agent-tools/langgraph-answer.service.ts';

function createToolRequest(
  identity = { tenantId: 'tenant-auth', userId: 'user-auth' }
) {
  const currentIdentity = {
    ...identity,
    role: 'owner',
    sessionId: null,
    authSource: 'session'
  };
  return {
    authContext: {
      identity: currentIdentity,
      currentIdentity
    }
  };
}

function createSearchResult(question, chunkId, documentId) {
  return {
    query: {
      original: question,
      retrieval: question,
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
        chunkId,
        documentId,
        documentTitle: `Document ${documentId}`,
        chunkIndex: 0,
        content: `Evidence for ${question}`,
        score: 0.91,
        isPrimary: true,
        pageNo: 1,
        sectionTitle: 'Overview'
      }
    ],
    contextGroups: [
      {
        documentId,
        documentTitle: `Document ${documentId}`,
        startChunkIndex: 0,
        endChunkIndex: 0,
        chunkIds: [chunkId],
        primaryChunkIds: [chunkId],
        mergedContent: `Evidence for ${question}`,
        pageNumbers: [1],
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
}

test('AgentToolsController runs langgraph_answer as an isolated multi-step side path', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';
  const searchCalls = [];
  const askCalls = [];
  const askAssistantService = {
    searchAssistant: async (input) => {
      searchCalls.push(input);
      return input.question === 'compare alpha and beta'
        ? createSearchResult(input.question, 'chunk-1', 'doc-1')
        : createSearchResult(input.question, 'chunk-2', 'doc-2');
    },
    askAssistant: async (input) => {
      askCalls.push(input);
      return {
        answer: 'langgraph answer',
        citations: [{ chunkId: 'chunk-1', documentId: 'doc-1' }],
        confidence: 'medium',
        missingInformation: [],
        traceId: 'trace-1',
        conversationId: input.conversationId ?? null,
        userMessageId: 'user-message-1',
        assistantMessageId: 'assistant-message-1',
        routeType: 'knowledge_base',
        routeReason: 'default_kb_ask',
        answerStatus: 'grounded'
      };
    }
  };
  const langGraphAnswerService = new LangGraphAnswerService(
    askAssistantService
  );
  const controller = new AgentToolsController(
    askAssistantService,
    {
      getTrace: async () => ({ id: 'trace-1' })
    },
    {
      getDocument: async () => ({ id: 'doc-1', status: 'ready' }),
      listDocumentChunks: async () => []
    },
    langGraphAnswerService
  );

  const result = await controller.langGraphAnswer(
    {
      secret: 'expected-secret',
      assistantId: 'assistant-1',
      conversationId: 'conversation-1',
      question: 'compare alpha and beta',
      boundedMultiStep: {
        enabled: true,
        rewrittenQuery: 'beta details',
        requestSecondPass: true
      }
    },
    createToolRequest({ tenantId: 'tenant-auth', userId: 'user-auth' })
  );

  assert.deepEqual(
    searchCalls.map((call) => call.question),
    ['compare alpha and beta', 'beta details']
  );
  assert.equal(searchCalls[0].authContext.identity.tenantId, 'tenant-auth');
  assert.equal(askCalls.length, 1);
  assert.equal(askCalls[0].conversationId, 'conversation-1');
  assert.equal(result.answer, 'langgraph answer');
  assert.equal(result.traceId, 'trace-1');
  assert.equal(result.langGraph.routeDecision.routeType, 'knowledge_base');
  assert.deepEqual(
    result.langGraph.steps.map((step) => step.name),
    [
      'route_question',
      'run_primary_retrieval',
      'judge_missing_information',
      'run_second_pass',
      'finalize_answer'
    ]
  );
  assert.equal(result.langGraph.steps[1].toolName, 'rag_search');
  assert.equal(result.langGraph.steps[3].status, 'completed');
  assert.equal(result.langGraph.secondPassQuery, 'beta details');
  assert.equal(result.langGraph.steps[1].diagnostics.pass, 'first_pass');
  assert.equal(
    result.langGraph.steps[1].diagnostics.query.retrieval,
    'compare alpha and beta'
  );
  assert.equal(
    result.langGraph.steps[3].diagnostics.query.retrieval,
    'beta details'
  );
  assert.deepEqual(result.langGraph.retrieval.firstPass.chunkIds, ['chunk-1']);
  assert.deepEqual(result.langGraph.retrieval.secondPass.chunkIds, ['chunk-2']);
  assert.deepEqual(result.langGraph.retrieval.merged.chunkIds, [
    'chunk-1',
    'chunk-2'
  ]);
  assert.deepEqual(result.langGraph.retrieval.merged.documentIds, [
    'doc-1',
    'doc-2'
  ]);
  assert.equal(result.diagnostics.langGraph.retrieval.firstPass.chunkCount, 1);
  assert.equal(result.diagnostics.langGraph.retrieval.secondPass.chunkCount, 1);
  assert.equal(result.diagnostics.langGraph.retrieval.merged.chunkCount, 2);
  assert.equal(result.boundedMultiStep.secondPassUsed, true);
  assert.equal(result.diagnostics.langGraph.secondPassUsed, true);
});

test('AgentToolsController keeps langgraph_answer on the default answer path for policy routes', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';
  let searchCalled = false;
  const askAssistantService = {
    searchAssistant: async () => {
      searchCalled = true;
      throw new Error('should not search policy route');
    },
    askAssistant: async () => ({
      answer: 'policy answer',
      citations: [],
      answerStatus: 'grounded',
      routeType: 'policy_reply',
      routeReason: 'policy_question'
    })
  };
  const controller = new AgentToolsController(
    askAssistantService,
    {
      getTrace: async () => ({ id: 'trace-1' })
    },
    {
      getDocument: async () => ({ id: 'doc-1', status: 'ready' }),
      listDocumentChunks: async () => []
    },
    new LangGraphAnswerService(askAssistantService)
  );

  const result = await controller.langGraphAnswer({
    secret: 'expected-secret',
    assistantId: 'assistant-1',
    question: 'What is your citation policy?'
  });

  assert.equal(searchCalled, false);
  assert.equal(result.answer, 'policy answer');
  assert.equal(result.langGraph.routeDecision.routeType, 'policy_reply');
  assert.equal(result.langGraph.steps[1].status, 'skipped');
  assert.equal(result.langGraph.steps[3].status, 'skipped');
  assert.equal(result.langGraph.retrieval.firstPass, null);
  assert.equal(result.langGraph.retrieval.secondPass, null);
  assert.equal(result.langGraph.retrieval.merged, null);
  assert.equal(result.boundedMultiStep.mode, 'disabled');
});

test('AgentToolsController keeps langgraph_answer on the default answer path for explicit external-source routes', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';
  let searchCalled = false;
  let askCalls = 0;
  const askAssistantService = {
    searchAssistant: async () => {
      searchCalled = true;
      throw new Error('should not search external-source route');
    },
    askAssistant: async () => {
      askCalls += 1;
      return {
        answer: 'external answer',
        citations: [],
        answerStatus: 'grounded',
        routeType: 'external_source',
        routeReason: 'explicit_source_url'
      };
    }
  };
  const controller = new AgentToolsController(
    askAssistantService,
    {
      getTrace: async () => ({ id: 'trace-1' })
    },
    {
      getDocument: async () => ({ id: 'doc-1', status: 'ready' }),
      listDocumentChunks: async () => []
    },
    new LangGraphAnswerService(askAssistantService)
  );

  const result = await controller.langGraphAnswer({
    secret: 'expected-secret',
    assistantId: 'assistant-1',
    question: 'Summarize https://example.com/article for me'
  });

  assert.equal(searchCalled, false);
  assert.equal(askCalls, 1);
  assert.equal(result.answer, 'external answer');
  assert.equal(result.langGraph.routeDecision.routeType, 'external_source');
  assert.equal(
    result.langGraph.routeDecision.routeReason,
    'explicit_source_url'
  );
  assert.equal(result.langGraph.steps[1].status, 'skipped');
  assert.equal(result.langGraph.steps[3].status, 'skipped');
  assert.equal(result.diagnostics.langGraph.retrieval.firstPass, null);
  assert.equal(result.diagnostics.langGraph.retrieval.secondPass, null);
  assert.equal(result.diagnostics.langGraph.retrieval.merged, null);
  assert.equal(result.diagnostics.langGraph.secondPassUsed, false);
});
