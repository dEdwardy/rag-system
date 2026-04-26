const {
  AskAssistantService
} = require('../../src/modules/assistants/ask-assistant.service.ts');
const {
  PromptManagerService
} = require('../../src/infra/llm/prompt-manager.service.ts');

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, overrides) {
  if (!isPlainObject(base) || !isPlainObject(overrides)) {
    return overrides === undefined ? base : overrides;
  }

  const result = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      continue;
    }

    result[key] = mergeDeep(base[key], value);
  }

  return result;
}

function createAnswerPolicy(overrides = {}) {
  return mergeDeep(
    {
      responseStyle: 'concise',
      tone: 'neutral',
      outputFormat: 'paragraph',
      language: 'auto',
      citationMode: 'required',
      maxCitations: 3,
      noAnswerBehavior: 'say_insufficient_context',
      includeMissingInformation: true
    },
    overrides
  );
}

function createAssistantRecord(overrides = {}) {
  return mergeDeep(
    {
      id: 'assistant-1',
      tenantId: 'tenant-1',
      kbId: 'kb-1',
      systemPrompt: 'system prompt',
      answerPolicyJson: null,
      retrievalProfile: {
        topK: 4,
        scoreThreshold: 0,
        chunkWindow: 0,
        enableHybrid: false,
        enableRerank: false,
        filtersJson: null,
        strategyJson: null
      }
    },
    overrides
  );
}

function createAskAssistantService(input = {}) {
  const assistantRecord = createAssistantRecord(input.assistant);

  return new AskAssistantService(
    {
      getAssistant: async (assistantId) => ({
        ...assistantRecord,
        id: assistantId
      }),
      ...input.assistants
    },
    {
      createConversation: async () => ({ id: 'conversation-1' }),
      getConversation: async () => ({ id: 'conversation-1' }),
      touchConversation: async () => {},
      ...input.conversations
    },
    {
      listConversationMessages: async () => [],
      listConversationMessagesForReuse: async () => [],
      createMessage: async (inputValue) => ({
        id:
          inputValue.role === 'user' ? 'user-message-1' : 'assistant-message-1',
        ...inputValue
      }),
      attachTrace: async () => {},
      ...input.messages
    },
    {
      retrieve: async () => ({
        retrievedChunks: [],
        contextGroups: [],
        execution: {
          actualMode: 'vector',
          usedFallback: false
        }
      }),
      ...input.retrieval
    },
    {
      buildStreamAnswerContext: ({ chunks }) => chunks,
      buildDeterministicInsufficientContextResult: ({
        question,
        answerPolicy
      }) => ({
        answer: `deterministic fallback for: ${question}`,
        modelName: 'fallback-local',
        citations: [],
        retrievedChunks: [],
        contextGroups: [],
        answeringMetadata: {
          promptId: 'answer.v2',
          usedFallback: true,
          answerPolicy,
          resolvedLanguage: 'en',
          generationMode: 'deterministic_bypass',
          contextMode: 'chunks',
          inputChunkCount: 0,
          promptContextCount: 0,
          contextGroupCount: 0,
          citationCountBeforeLimit: 0,
          citationCount: 0,
          citationLimitHit: false,
          citationAttribution: 'none',
          citationSelectionSource: 'none',
          missingInformationCount: 1,
          missingInformationSource: 'deterministic_policy',
          answerTextSource: 'deterministic_policy',
          insufficientContextReason: 'no_retrieval_hits',
          answerStatusSource: 'deterministic_policy',
          answerStatus: 'insufficient_context'
        },
        answerStatus: 'insufficient_context',
        missingInformation: ['No relevant supporting sources were retrieved.'],
        qualityEvaluation: {
          overall: 'weak',
          grounding: 'ungrounded',
          completeness: 'insufficient',
          primaryIssue: 'no_retrieval_hits',
          flags: [
            'no_retrieval_hits',
            'insufficient_context',
            'missing_information'
          ],
          summary:
            'Answer quality is weak because supporting context was insufficient.'
        }
      }),
      generateAnswer: async ({ chunks, contextGroups, answerPolicy }) => ({
        answer:
          chunks.length > 0 ? 'answer' : 'deterministic fallback for: answer',
        citations: [],
        retrievedChunks: chunks,
        contextGroups,
        answeringMetadata: {
          promptId: 'answer.v2',
          usedFallback: false,
          answerPolicy,
          resolvedLanguage: 'en',
          generationMode: 'generated',
          contextMode: contextGroups.length > 0 ? 'context_groups' : 'chunks',
          inputChunkCount: chunks.length,
          promptContextCount: chunks.length,
          contextGroupCount: contextGroups.length,
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
          answerStatus: chunks.length > 0 ? 'grounded' : 'insufficient_context'
        },
        modelName: 'test-model',
        answerStatus: chunks.length > 0 ? 'grounded' : 'insufficient_context',
        missingInformation: [],
        qualityEvaluation: {
          overall: chunks.length > 0 ? 'strong' : 'weak',
          grounding: chunks.length > 0 ? 'grounded' : 'ungrounded',
          completeness: chunks.length > 0 ? 'complete' : 'insufficient',
          primaryIssue: chunks.length > 0 ? 'none' : 'no_retrieval_hits',
          flags:
            chunks.length > 0
              ? []
              : [
                  'no_retrieval_hits',
                  'insufficient_context',
                  'missing_information'
                ],
          summary:
            chunks.length > 0
              ? 'Answer is grounded in cited sources with no reported gaps.'
              : 'Answer quality is weak because supporting context was insufficient.'
        }
      }),
      finalizeStreamedAnswer: async (inputValue) => ({
        answer: inputValue.rawAnswer,
        modelName: inputValue.modelName,
        citations: [],
        retrievedChunks: inputValue.chunks,
        contextGroups: inputValue.contextGroups,
        answeringMetadata: {
          promptId: inputValue.promptId,
          usedFallback: inputValue.usedFallback,
          answerPolicy: inputValue.answerPolicy,
          resolvedLanguage: 'en',
          generationMode: 'generated',
          contextMode:
            inputValue.contextGroups.length > 0 ? 'context_groups' : 'chunks',
          inputChunkCount: inputValue.chunks.length,
          promptContextCount: inputValue.chunks.length,
          contextGroupCount: inputValue.contextGroups.length,
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
        answerStatus: 'grounded',
        missingInformation: [],
        qualityEvaluation: {
          overall: 'strong',
          grounding: 'grounded',
          completeness: 'complete',
          primaryIssue: 'none',
          flags: [],
          summary: 'Answer is grounded in cited sources with no reported gaps.'
        }
      }),
      ...input.answering
    },
    {
      createTrace: async (inputValue) => ({ id: 'trace-1', ...inputValue }),
      updateTrace: async (id, inputValue) => ({ id, ...inputValue }),
      ...input.traces
    },
    {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      }),
      generateAnswerStream: async () => ({
        rawAnswer: '',
        modelName: 'test-model',
        promptId: 'answer.v2',
        usedFallback: false
      }),
      ...input.llm
    },
    input.promptManager ?? new PromptManagerService(),
    {
      fetchWebPage: async (url) => ({
        title: 'External web page',
        content: `Fetched web page content from ${url}`,
        diagnostics: null
      }),
      ...input.webPage
    },
    {
      fetchFeed: async ({ url }) => ({
        title: 'External feed',
        content: `Fetched feed content from ${url}`,
        diagnostics: null
      }),
      ...input.feedSource
    },
    {
      fetchSitemap: async ({ url }) => ({
        content: `Fetched sitemap content from ${url}`,
        diagnostics: null
      }),
      ...input.sitemapSource
    }
  );
}

module.exports = {
  createAnswerPolicy,
  createAskAssistantService,
  createAssistantRecord
};
