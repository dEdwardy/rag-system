const assert = require('node:assert/strict');

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
  assert.equal(events.at(-1)?.type, 'final');
});
