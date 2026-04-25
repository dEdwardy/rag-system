import assert from 'node:assert/strict';
import { test } from 'vitest';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

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

test('AgentToolsController rejects trace lookup requests with an invalid tool secret', async () => {
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
    controller.traceLookup({
      secret: 'wrong-secret',
      traceId: 'trace-1'
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

test('AgentToolsController normalizes rag_answer payload for agent consumers', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';

  const askCalls = [];
  const controller = new AgentToolsController(
    {
      searchAssistant: async () => {
        throw new Error('should not call searchAssistant');
      },
      askAssistant: async (input) => {
        askCalls.push(input);
        return {
          answer: 'tool answer',
          citations: [{ chunkId: 'chunk-1', documentId: 'doc-1' }],
          confidence: 'high',
          missingInformation: ['missing detail'],
          traceId: 'trace-1',
          conversationId: 'conversation-1',
          userMessageId: 'user-message-1',
          assistantMessageId: 'assistant-message-1',
          routeType: 'knowledge_base',
          routeReason: 'default_knowledge_base',
          strategySummary: { retrievalMode: 'vector' },
          retrievalMetadata: { retrievedChunkCount: 1 },
          answeringMetadata: { answerTextSource: 'model' },
          qualityEvaluation: { overall: 'strong' },
          modelName: 'gpt-test',
          answerStatus: 'grounded'
        };
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

  const result = await controller.ragAnswer({
    secret: 'expected-secret',
    assistantId: 'assistant-1',
    conversationId: 'conversation-1',
    question: 'what is the answer?',
    tenantId: 'tenant-1',
    userId: 'user-1'
  });

  assert.equal(askCalls.length, 1);
  assert.equal(askCalls[0].conversationId, 'conversation-1');
  assert.equal(askCalls[0].authContext.identity.tenantId, 'tenant-1');
  assert.equal(result.answer, 'tool answer');
  assert.deepEqual(result.citations, [
    { chunkId: 'chunk-1', documentId: 'doc-1' }
  ]);
  assert.equal(result.confidence, 'high');
  assert.deepEqual(result.missingInformation, ['missing detail']);
  assert.equal(result.traceId, 'trace-1');
  assert.deepEqual(result.trace, {
    traceId: 'trace-1',
    conversationId: 'conversation-1',
    userMessageId: 'user-message-1',
    assistantMessageId: 'assistant-message-1'
  });
  assert.deepEqual(result.diagnostics, {
    routeType: 'knowledge_base',
    routeReason: 'default_knowledge_base',
    strategySummary: { retrievalMode: 'vector' },
    retrievalMetadata: { retrievedChunkCount: 1 },
    answeringMetadata: { answerTextSource: 'model' },
    qualityEvaluation: { overall: 'strong' },
    modelName: 'gpt-test',
    answerStatus: 'grounded',
    boundedMultiStep: {
      enabled: false,
      requested: false,
      rewrittenQuery: null,
      secondPassRequested: false,
      secondPassUsed: false,
      mode: 'disabled',
      reason: 'not_requested'
    }
  });
});

test('AgentToolsController keeps rag_answer optional fields stable when missing', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';

  const controller = new AgentToolsController(
    {
      searchAssistant: async () => {
        throw new Error('should not call searchAssistant');
      },
      askAssistant: async () => ({
        answer: 'minimal answer'
      })
    },
    {
      getTrace: async () => ({ id: 'trace-1' })
    },
    {
      getDocument: async () => ({ id: 'doc-1', status: 'ready' }),
      listDocumentChunks: async () => []
    }
  );

  const result = await controller.ragAnswer({
    secret: 'expected-secret',
    assistantId: 'assistant-1',
    question: 'what is the answer?'
  });

  assert.equal(result.answer, 'minimal answer');
  assert.deepEqual(result.citations, []);
  assert.equal(result.confidence, null);
  assert.deepEqual(result.missingInformation, []);
  assert.deepEqual(result.trace, {
    traceId: null,
    conversationId: null,
    userMessageId: null,
    assistantMessageId: null
  });
  assert.equal(result.traceId, null);
  assert.equal(result.conversationId, null);
  assert.deepEqual(result.diagnostics, {
    routeType: null,
    routeReason: null,
    strategySummary: null,
    retrievalMetadata: null,
    answeringMetadata: null,
    qualityEvaluation: null,
    modelName: null,
    answerStatus: null,
    boundedMultiStep: {
      enabled: false,
      requested: false,
      rewrittenQuery: null,
      secondPassRequested: false,
      secondPassUsed: false,
      mode: 'disabled',
      reason: 'not_requested'
    }
  });
});

test('AgentToolsController exposes bounded multi-step no-op diagnostics for rag_answer', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';

  const controller = new AgentToolsController(
    {
      searchAssistant: async () => {
        throw new Error('should not call searchAssistant');
      },
      askAssistant: async () => ({
        answer: 'bounded answer',
        citations: [],
        answerStatus: 'grounded'
      })
    },
    {
      getTrace: async () => ({ id: 'trace-1' })
    },
    {
      getDocument: async () => ({ id: 'doc-1', status: 'ready' }),
      listDocumentChunks: async () => []
    }
  );

  const result = await controller.ragAnswer({
    secret: 'expected-secret',
    assistantId: 'assistant-1',
    question: 'what is the answer?',
    boundedMultiStep: {
      enabled: true,
      rewrittenQuery: 'rewritten question',
      requestSecondPass: true
    }
  });

  assert.deepEqual(result.boundedMultiStep, {
    enabled: true,
    requested: true,
    rewrittenQuery: 'rewritten question',
    secondPassRequested: true,
    secondPassUsed: false,
    mode: 'deterministic_noop',
    reason: 'agent_tool_contract_only'
  });
  assert.deepEqual(
    result.diagnostics.boundedMultiStep,
    result.boundedMultiStep
  );
});

test('AgentToolsController exposes bounded multi-step no-op diagnostics for rag_search', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';

  const controller = new AgentToolsController(
    {
      searchAssistant: async (input) => ({
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
        chunks: [],
        contextGroups: [],
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
      }),
      askAssistant: async () => {
        throw new Error('should not call askAssistant');
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
    boundedMultiStep: {
      enabled: true,
      rewrittenQuery: 'rewritten question'
    }
  });

  assert.deepEqual(result.boundedMultiStep, {
    enabled: true,
    requested: true,
    rewrittenQuery: 'rewritten question',
    secondPassRequested: false,
    secondPassUsed: false,
    mode: 'deterministic_noop',
    reason: 'agent_tool_contract_only'
  });
  assert.deepEqual(
    result.diagnostics.boundedMultiStep,
    result.boundedMultiStep
  );
});

test('AgentToolsController resolves trace lookup scope from headers and returns stable diagnostics', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';

  const traceCalls = [];
  const tracePayload = {
    id: 'trace-1',
    status: 'completed',
    traceSummary: {
      routeType: 'knowledge_base'
    }
  };

  const controller = new AgentToolsController(
    {
      searchAssistant: async () => {
        throw new Error('should not call searchAssistant');
      },
      askAssistant: async () => {
        throw new Error('should not call askAssistant');
      }
    },
    {
      getTrace: async (traceId, scope) => {
        traceCalls.push({ traceId, scope });
        return tracePayload;
      }
    },
    {
      getDocument: async () => ({ id: 'doc-1', status: 'ready' }),
      listDocumentChunks: async () => []
    }
  );

  const result = await controller.traceLookup(
    {
      secret: 'expected-secret',
      traceId: 'trace-1'
    },
    {
      headers: {
        'x-agent-tenant-id': 'tenant-header',
        'x-agent-user-id': 'user-header'
      }
    }
  );

  assert.deepEqual(traceCalls, [
    {
      traceId: 'trace-1',
      scope: {
        tenantId: 'tenant-header',
        userId: 'user-header'
      }
    }
  ]);
  assert.equal(result.traceId, 'trace-1');
  assert.equal(result.found, true);
  assert.equal(result.trace, tracePayload);
  assert.deepEqual(result.diagnostics, {
    found: true,
    status: 'completed',
    hasSummary: true
  });
});

test('AgentToolsController returns safe not-found trace lookup payload', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';

  const controller = new AgentToolsController(
    {
      searchAssistant: async () => {
        throw new Error('should not call searchAssistant');
      },
      askAssistant: async () => {
        throw new Error('should not call askAssistant');
      }
    },
    {
      getTrace: async () => {
        throw new NotFoundException('Trace trace-missing not found.');
      }
    },
    {
      getDocument: async () => ({ id: 'doc-1', status: 'ready' }),
      listDocumentChunks: async () => []
    }
  );

  const result = await controller.traceLookup({
    secret: 'expected-secret',
    traceId: 'trace-missing',
    tenantId: 'tenant-1',
    userId: 'user-1'
  });

  assert.deepEqual(result, {
    traceId: 'trace-missing',
    found: false,
    trace: null,
    diagnostics: {
      found: false,
      status: 'not_found',
      hasSummary: false
    }
  });
});

test('AgentToolsController resolves document lookup scope from input and returns stable diagnostics', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';

  const documentCalls = [];
  const chunkCalls = [];
  const controller = new AgentToolsController(
    {
      searchAssistant: async () => {
        throw new Error('should not call searchAssistant');
      },
      askAssistant: async () => {
        throw new Error('should not call askAssistant');
      }
    },
    {
      getTrace: async () => ({ id: 'trace-1' })
    },
    {
      getDocument: async (documentId, scope) => {
        documentCalls.push({ documentId, scope });
        return {
          id: documentId,
          status: 'ready',
          title: 'Demo document'
        };
      },
      listDocumentChunks: async (documentId, scope) => {
        chunkCalls.push({ documentId, scope });
        return [{ id: 'chunk-1', documentId, chunkIndex: 0, content: 'demo' }];
      }
    }
  );

  const result = await controller.documentLookup({
    secret: 'expected-secret',
    documentId: 'doc-1',
    tenantId: 'tenant-input',
    userId: 'user-input'
  });

  assert.deepEqual(documentCalls, [
    {
      documentId: 'doc-1',
      scope: {
        tenantId: 'tenant-input',
        userId: 'user-input'
      }
    }
  ]);
  assert.deepEqual(chunkCalls, [
    {
      documentId: 'doc-1',
      scope: {
        tenantId: 'tenant-input',
        userId: 'user-input'
      }
    }
  ]);
  assert.equal(result.documentId, 'doc-1');
  assert.equal(result.found, true);
  assert.equal(result.document.title, 'Demo document');
  assert.equal(result.chunks.length, 1);
  assert.deepEqual(result.diagnostics, {
    found: true,
    status: 'ready',
    chunkCount: 1
  });
});

test('AgentToolsController returns safe not-found document lookup payload', async () => {
  process.env.AGENT_TOOL_GATEWAY_SECRET = 'expected-secret';

  const controller = new AgentToolsController(
    {
      searchAssistant: async () => {
        throw new Error('should not call searchAssistant');
      },
      askAssistant: async () => {
        throw new Error('should not call askAssistant');
      }
    },
    {
      getTrace: async () => ({ id: 'trace-1' })
    },
    {
      getDocument: async () => {
        throw new NotFoundException('Document doc-missing not found.');
      },
      listDocumentChunks: async () => {
        throw new Error('should not call listDocumentChunks');
      }
    }
  );

  const result = await controller.documentLookup({
    secret: 'expected-secret',
    documentId: 'doc-missing'
  });

  assert.deepEqual(result, {
    documentId: 'doc-missing',
    found: false,
    document: null,
    chunks: [],
    diagnostics: {
      found: false,
      status: 'not_found',
      chunkCount: 0
    }
  });
});
