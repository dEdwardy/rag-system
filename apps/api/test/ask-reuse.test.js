const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');

const {
  createAskAssistantService
} = require('./support/ask-assistant-test-helpers.js');

test('AskAssistantService reuses an existing answer for the same question in the same conversation', async () => {
  const createdMessages = [];
  const events = [];

  const service = createAskAssistantService({
    conversations: {
      getConversation: async () => ({ id: 'conversation-1' })
    },
    messages: {
      listConversationMessagesForReuse: async () => [
        {
          id: 'assistant-message-1',
          conversationId: 'conversation-1',
          role: 'assistant',
          content: 'The marker is in Document 1.',
          traceId: 'trace-1',
          createdAt: '2026-04-24T00:00:01.000Z'
        },
        {
          id: 'user-message-1',
          conversationId: 'conversation-1',
          role: 'user',
          content: 'Where is the marker?',
          traceId: null,
          createdAt: '2026-04-24T00:00:00.000Z'
        }
      ],
      createMessage: async (inputValue) => {
        createdMessages.push(inputValue);
        return {
          id:
            inputValue.role === 'user'
              ? 'user-message-new'
              : 'assistant-message-new',
          ...inputValue
        };
      }
    },
    traces: {
      getTrace: async () => ({
        id: 'trace-1',
        assistantId: 'assistant-1',
        citationsJson: [],
        modelName: 'cached-model',
        retrievalMetadataJson: null,
        answeringMetadataJson: null,
        qualityEvaluationJson: null,
        traceSummary: {
          routeType: 'knowledge_base',
          routeReason: 'default_kb_ask',
          strategySummary: null,
          timingSummary: null,
          answerStatus: 'grounded',
          qualityOverall: 'strong',
          primaryIssue: 'none',
          retrievalMode: null,
          retrievalQuerySource: null,
          strategyReadabilityLabel: 'cached',
          retrievalModeProvenanceSentence: 'cached',
          rewriteReadabilityLabel: 'cached',
          routeDecisionSummary: {
            routeType: 'knowledge_base',
            routeReason: 'default_kb_ask'
          },
          timingReadabilitySentence: 'cached',
          generationMode: null,
          contextMode: null,
          rewriteApplied: false,
          rewriteSkippedReason: null,
          fallbackReason: null,
          promptId: null,
          answerTextSource: 'model',
          answerStatusSource: 'model',
          answerAttributionSummary: null,
          answerAttributionReadabilitySentence: null,
          answerAttribution: null,
          answerAttributionSource: null,
          answerEvidenceSource: null,
          answerEvidenceSourceReadabilityLabel: null,
          answerEvidenceSourceReadabilitySentence: null,
          answerTextSourceReadabilityLabel: null,
          answerTextSourceReadabilitySentence: null,
          answerStatusSourceReadabilityLabel: null,
          answerStatusSourceReadabilitySentence: null,
          answerProvenanceSentence: null,
          answerProvenanceReadabilitySentence: null,
          missingInformationSource: null,
          missingInformationProvenanceSentence: null,
          missingInformationSourceReadabilityLabel: null,
          failedStage: null,
          failedStageReadabilityLabel: null,
          failureMessage: null,
          failureReadabilitySentence: null,
          answerStatusReadabilityLabel: null,
          answerStatusReadabilitySentence: null,
          answerStatusReadability: null,
          citationCount: 0,
          citationCountBeforeLimit: 0,
          citationLimitHit: false,
          citationCountReadabilityLabel: null,
          citationCountReadabilitySentence: null,
          candidateLimit: null,
          vectorCandidateCount: null,
          lexicalCandidateCount: null,
          mergedCandidateCount: null,
          rankedCandidateCount: null,
          candidateCountReadabilityLabel: null,
          candidateCountReadabilitySentence: null,
          contextGroupCount: null,
          inputChunkCount: null,
          promptContextCount: null,
          promptContextChars: null,
          promptContextApproxTokens: null,
          contextGroupAvgLength: null,
          primaryChunkScoreAvg: null,
          primaryChunkScoreMin: null,
          retrievedChunkCount: null,
          contextReadabilitySentence: null,
          missingInformationCount: null,
          missingInformationCountReadabilityLabel: null,
          missingInformationCountReadabilitySentence: null,
          resolvedLanguage: 'en'
        }
      })
    },
    llm: {
      rewriteQuery: async () => {
        throw new Error('reuse path should not rewrite');
      },
      generateAnswerStream: async () => {
        throw new Error('reuse path should not stream a new answer');
      }
    }
  });

  const finalResult = await service.askAssistantStream({
    assistantId: 'assistant-1',
    question: 'Where is the marker?',
    conversationId: 'conversation-1',
    onEvent: (event) => {
      events.push(event);
    }
  });

  assert.equal(createdMessages.length, 0);
  assert.equal(finalResult.traceId, 'trace-1');
  assert.equal(finalResult.answer, 'The marker is in Document 1.');
  assert.deepEqual(finalResult.retrievalMetadata.conversationReuse, {
    reused: true,
    source: 'conversation_answer',
    sourceTraceId: 'trace-1',
    originalTimingPreserved: true
  });
  assert.equal(
    finalResult.timingReadabilitySentence,
    'conversation reuse hit; original generation timing preserved. cached'
  );
  assert.deepEqual(events.at(-1)?.data.retrievalMetadata.conversationReuse, {
    reused: true,
    source: 'conversation_answer',
    sourceTraceId: 'trace-1',
    originalTimingPreserved: true
  });
  assert.equal(events.at(-1)?.type, 'final');
});

test('AskAssistantService treats a missing reuse trace as a cache miss', async () => {
  const createdMessages = [];

  const service = createAskAssistantService({
    conversations: {
      getConversation: async () => ({ id: 'conversation-1' })
    },
    messages: {
      listConversationMessagesForReuse: async () => [
        {
          id: 'assistant-message-stale',
          conversationId: 'conversation-1',
          role: 'assistant',
          content: 'stale answer',
          traceId: 'trace-missing',
          createdAt: '2026-04-24T00:00:01.000Z'
        },
        {
          id: 'user-message-stale',
          conversationId: 'conversation-1',
          role: 'user',
          content: 'Where is the marker?',
          traceId: null,
          createdAt: '2026-04-24T00:00:00.000Z'
        }
      ],
      createMessage: async (inputValue) => {
        createdMessages.push(inputValue);
        return {
          id:
            inputValue.role === 'user'
              ? 'user-message-new'
              : 'assistant-message-new',
          ...inputValue
        };
      }
    },
    traces: {
      getTrace: async () => {
        throw new NotFoundException('Trace trace-missing not found.');
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: 'Where is the marker?',
        modelName: 'rewrite-model',
        usedFallback: true,
        promptId: null
      }),
      generateAnswer: async () => ({
        answer: 'fresh answer',
        citations: [],
        retrievedChunks: [],
        contextGroups: [],
        answeringMetadata: {
          promptId: 'answer.v2',
          usedFallback: false,
          answerPolicy: null,
          resolvedLanguage: 'en',
          generationMode: 'generated',
          contextMode: 'chunks',
          inputChunkCount: 0,
          promptContextCount: 0,
          contextGroupCount: 0,
          citationCountBeforeLimit: 0,
          citationCount: 0,
          citationLimitHit: false,
          citationAttribution: 'none',
          citationSelectionSource: 'none',
          missingInformationCount: 0,
          missingInformationSource: 'none',
          answerTextSource: 'model',
          insufficientContextReason: null,
          answerStatusSource: 'model',
          answerStatus: 'grounded'
        },
        modelName: 'fresh-model',
        answerStatus: 'grounded',
        missingInformation: [],
        qualityEvaluation: {
          overall: 'strong',
          grounding: 'grounded',
          completeness: 'complete',
          primaryIssue: 'none',
          flags: [],
          summary: 'fresh answer generated'
        }
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: 'assistant-1',
    question: 'Where is the marker?',
    conversationId: 'conversation-1'
  });

  assert.equal(
    result.answer,
    'deterministic fallback for: Where is the marker?'
  );
  assert.notEqual(result.traceId, 'trace-missing');
  assert.equal(createdMessages.length, 2);
});
