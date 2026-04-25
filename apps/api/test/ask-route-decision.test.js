const assert = require('node:assert/strict');

const {
  resolveAskRouteDecision,
  resolveExplicitExternalSourceRoute,
  resolveExplicitExternalSourceRoutes,
  isPolicyQuestion
} = require('../src/modules/assistants/ask-route-decision.ts');
const {
  createAskAssistantService,
  createAssistantRecord
} = require('./support/ask-assistant-test-helpers.js');

test('route helper keeps normal questions on the knowledge-base path', () => {
  assert.deepEqual(
    resolveAskRouteDecision(
      'What does the onboarding document say about retries?'
    ),
    {
      routeType: 'knowledge_base',
      routeReason: 'default_kb_ask'
    }
  );
});

test('route helper classifies policy questions as deterministic policy replies', () => {
  assert.equal(
    isPolicyQuestion(
      'What is the assistant citation policy when sources are missing?'
    ),
    true
  );
  assert.deepEqual(
    resolveAskRouteDecision(
      'What is the assistant citation policy when sources are missing?'
    ),
    {
      routeType: 'policy_reply',
      routeReason: 'policy_question'
    }
  );
});

test('route helper classifies explicit source urls before policy-like wording', () => {
  assert.deepEqual(
    resolveAskRouteDecision(
      'Check this source and tell me the citation policy: https://example.com/guide'
    ),
    {
      routeType: 'external_source',
      routeReason: 'explicit_source_url'
    }
  );
});

test('route helper resolves source kinds across web, feed, and sitemap boundaries', () => {
  const webSource = resolveExplicitExternalSourceRoute(
    'Read https://example.com/posts/launch-announcement'
  );
  assert.equal(webSource?.url, 'https://example.com/posts/launch-announcement');
  assert.equal(webSource?.sourceKind, 'web');

  const feedSource = resolveExplicitExternalSourceRoute(
    'Summarize the RSS feed https://example.com/rss.xml'
  );
  assert.equal(feedSource?.url, 'https://example.com/rss.xml');
  assert.equal(feedSource?.sourceKind, 'feed');

  const sitemapSource = resolveExplicitExternalSourceRoute(
    'Inspect sitemap https://example.com/sitemap.xml'
  );
  assert.equal(sitemapSource?.url, 'https://example.com/sitemap.xml');
  assert.equal(sitemapSource?.sourceKind, 'sitemap');
});

test('route helper detects markdown links and bare urls conservatively across feed and sitemap boundaries', () => {
  const markdownFeed = resolveExplicitExternalSourceRoute(
    'Summarize [product updates feed](https://example.com/updates.xml)'
  );
  assert.equal(markdownFeed?.url, 'https://example.com/updates.xml');
  assert.equal(markdownFeed?.sourceKind, 'feed');

  const bareSitemap = resolveExplicitExternalSourceRoute(
    'Please inspect this sitemap https://example.com/updates.xml for crawl coverage'
  );
  assert.equal(bareSitemap?.url, 'https://example.com/updates.xml');
  assert.equal(bareSitemap?.sourceKind, 'sitemap');

  const plainXml = resolveExplicitExternalSourceRoute(
    'Read https://example.com/updates.xml and summarize the page'
  );
  assert.equal(plainXml?.url, 'https://example.com/updates.xml');
  assert.equal(plainXml?.sourceKind, 'web');
});

test('route helper deduplicates urls and marks plural explicit source routing', () => {
  const sources = resolveExplicitExternalSourceRoutes(
    'Compare [home](https://example.com) with https://example.com and https://example.com/feed.xml'
  );

  assert.equal(sources.length, 2);
  assert.deepEqual(
    sources.map((source) => ({
      url: source.url,
      sourceKind: source.sourceKind
    })),
    [
      { url: 'https://example.com', sourceKind: 'web' },
      { url: 'https://example.com/feed.xml', sourceKind: 'feed' }
    ]
  );
  assert.deepEqual(
    resolveAskRouteDecision(
      'Compare [home](https://example.com) with https://example.com and https://example.com/feed.xml'
    ),
    {
      routeType: 'external_source',
      routeReason: 'explicit_source_urls'
    }
  );
});

test('default knowledge-base asks emit route choice, execution mode, and tool names in trace metadata', async () => {
  const createTraceCalls = [];
  const updateTraceCalls = [];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      retrievalProfile: {
        topK: 3,
        scoreThreshold: 0,
        chunkWindow: 0,
        enableHybrid: false,
        enableRerank: false,
        filtersJson: null,
        strategyJson: null
      }
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks: [
          {
            chunkId: 'chunk-1',
            documentId: 'document-1',
            documentTitle: 'Doc 1',
            chunkIndex: 0,
            content: 'retrieved kb content',
            score: 0.87,
            isPrimary: true
          }
        ],
        contextGroups: [],
        execution: {
          actualMode: 'vector',
          usedFallback: false,
          fallbackReason: null,
          rerankApplied: false,
          chunkWindowApplied: false,
          vectorSearchAttempted: true,
          lexicalSearchAttempted: false,
          vectorCandidateLimitHit: false,
          lexicalCandidateLimitHit: false,
          rankingTopKHit: false,
          candidateLimit: 3,
          vectorCandidateCount: 1,
          lexicalCandidateCount: 0,
          mergedCandidateCount: 1,
          rankedCandidateCount: 1
        }
      })
    },
    answering: {
      generateAnswer: async ({ chunks, contextGroups, answerPolicy }) => ({
        answer: 'Grounded answer',
        citations: [],
        retrievedChunks: chunks,
        contextGroups,
        answeringMetadata: {
          promptId: 'answer.v2',
          usedFallback: false,
          answerPolicy,
          resolvedLanguage: 'en',
          generationMode: 'generated',
          contextMode: 'chunks',
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
          answerStatus: 'grounded'
        },
        modelName: 'test-model',
        answerStatus: 'grounded',
        missingInformation: [],
        qualityEvaluation: {
          overall: 'strong',
          grounding: 'grounded',
          completeness: 'complete',
          primaryIssue: 'none',
          flags: [],
          summary: 'Grounded answer from KB retrieval.'
        }
      })
    },
    traces: {
      createTrace: async (input) => {
        createTraceCalls.push(input);
        return { id: 'trace-1' };
      },
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    }
  });

  const result = await service.askAssistant({
    assistantId: 'assistant-1',
    question: 'What does the onboarding document say about retries?'
  });

  assert.equal(result.routeType, 'knowledge_base');
  assert.equal(createTraceCalls.length, 1);
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(createTraceCalls[0].retrievalMetadataJson.routeDecision, {
    routeType: 'knowledge_base',
    routeReason: 'default_kb_ask'
  });
  assert.equal(
    createTraceCalls[0].retrievalMetadataJson.executionMode,
    'manual'
  );
  assert.deepEqual(
    createTraceCalls[0].retrievalMetadataJson.executionToolNames,
    ['knowledge_base_search']
  );
  assert.deepEqual(
    createTraceCalls[0].retrievalMetadataJson.executionPlan.steps.map(
      (step) => ({ kind: step.kind, toolName: step.toolName })
    ),
    [
      { kind: 'route_decision', toolName: null },
      { kind: 'retrieval', toolName: 'knowledge_base_search' },
      { kind: 'answer_generation', toolName: null }
    ]
  );
  assert.deepEqual(
    updateTraceCalls[0].input.retrievalMetadataJson.routeDecision,
    createTraceCalls[0].retrievalMetadataJson.routeDecision
  );
});

test('default knowledge-base asks keep rewrite on a single retrieval pass', async () => {
  const retrievalCalls = [];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      retrievalProfile: {
        topK: 3,
        scoreThreshold: 0,
        chunkWindow: 0,
        enableHybrid: false,
        enableRerank: false,
        filtersJson: null,
        strategyJson: {
          queryRewrite: {
            enabled: true
          }
        }
      }
    }),
    retrieval: {
      retrieve: async (input) => {
        retrievalCalls.push(input);
        return {
          retrievedChunks: [
            {
              chunkId: 'chunk-1',
              documentId: 'document-1',
              documentTitle: 'Doc 1',
              chunkIndex: 0,
              content: 'low-score rewritten evidence',
              score: 0.42,
              isPrimary: true
            }
          ],
          contextGroups: [],
          embedding: null,
          execution: {
            actualMode: 'vector',
            usedFallback: false,
            fallbackReason: null,
            rerankApplied: false,
            chunkWindowApplied: false,
            vectorSearchAttempted: true,
            lexicalSearchAttempted: false,
            vectorCandidateLimitHit: false,
            lexicalCandidateLimitHit: false,
            rankingTopKHit: false,
            candidateLimit: 3,
            vectorCandidateCount: 1,
            lexicalCandidateCount: 0,
            mergedCandidateCount: 1,
            rankedCandidateCount: 1
          }
        };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: 'rewritten onboarding retry policy',
        modelName: 'rewrite-model',
        usedFallback: false,
        promptId: 'rewrite-query.v1'
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: 'assistant-1',
    question: 'What does the onboarding document say about retries?'
  });

  assert.equal(result.routeType, 'knowledge_base');
  assert.equal(retrievalCalls.length, 1);
  assert.equal(retrievalCalls[0].query, 'rewritten onboarding retry policy');
  assert.equal(result.retrievalMetadata.knowledgeBaseMultiStep, null);
});

test('explicit external source asks fetch web content into answering and trace metadata', async () => {
  const answeringCalls = [];
  const createTraceCalls = [];

  const service = createAskAssistantService({
    answering: {
      generateAnswer: async (input) => {
        answeringCalls.push(input);
        return {
          answer: 'Web answer',
          citations: [],
          retrievedChunks: input.chunks,
          contextGroups: input.contextGroups,
          answeringMetadata: {
            promptId: 'answer.v2',
            usedFallback: false,
            answerPolicy: input.answerPolicy,
            resolvedLanguage: 'en',
            generationMode: 'generated',
            contextMode: 'chunks',
            inputChunkCount: input.chunks.length,
            promptContextCount: input.chunks.length,
            contextGroupCount: input.contextGroups.length,
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
          modelName: 'test-model',
          answerStatus: 'grounded',
          missingInformation: [],
          qualityEvaluation: {
            overall: 'strong',
            grounding: 'grounded',
            completeness: 'complete',
            primaryIssue: 'none',
            flags: [],
            summary: 'Grounded answer from external source.'
          }
        };
      }
    },
    traces: {
      createTrace: async (input) => {
        createTraceCalls.push(input);
        return { id: 'trace-1' };
      }
    },
    webPage: {
      fetchWebPage: async (url) => ({
        title: 'Launch page',
        content: `Fetched web page content from ${url}`,
        diagnostics: { fetchMethod: 'web_page', statusCode: 200 }
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: 'assistant-1',
    question:
      'Read https://example.com/posts/launch-announcement and summarize it'
  });

  assert.equal(result.routeType, 'external_source');
  assert.equal(result.routeReason, 'explicit_source_url');
  assert.equal(answeringCalls.length, 1);
  assert.match(
    answeringCalls[0].chunks[0].content,
    /Fetched web page content from https:\/\/example.com\/posts\/launch-announcement/
  );
  assert.equal(createTraceCalls.length, 1);
  assert.deepEqual(createTraceCalls[0].retrievalMetadataJson.routeDecision, {
    routeType: 'external_source',
    routeReason: 'explicit_source_url'
  });
  assert.deepEqual(
    createTraceCalls[0].retrievalMetadataJson.executionToolNames,
    ['external_source_fetch']
  );
  assert.equal(
    createTraceCalls[0].retrievalMetadataJson.externalSource.url,
    'https://example.com/posts/launch-announcement'
  );
  assert.equal(
    createTraceCalls[0].retrievalMetadataJson.externalSource.kind,
    'web'
  );
  assert.deepEqual(
    createTraceCalls[0].retrievalMetadataJson.externalSource.diagnostics,
    {
      fetchMethod: 'web_page',
      statusCode: 200
    }
  );
});

test('explicit external source asks fetch feed content into answering and trace metadata', async () => {
  const answeringCalls = [];
  const createTraceCalls = [];

  const service = createAskAssistantService({
    answering: {
      generateAnswer: async (input) => {
        answeringCalls.push(input);
        return {
          answer: 'Feed answer',
          citations: [],
          retrievedChunks: input.chunks,
          contextGroups: input.contextGroups,
          answeringMetadata: {
            promptId: 'answer.v2',
            usedFallback: false,
            answerPolicy: input.answerPolicy,
            resolvedLanguage: 'en',
            generationMode: 'generated',
            contextMode: 'chunks',
            inputChunkCount: input.chunks.length,
            promptContextCount: input.chunks.length,
            contextGroupCount: input.contextGroups.length,
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
          modelName: 'test-model',
          answerStatus: 'grounded',
          missingInformation: [],
          qualityEvaluation: {
            overall: 'strong',
            grounding: 'grounded',
            completeness: 'complete',
            primaryIssue: 'none',
            flags: [],
            summary: 'Grounded answer from external source.'
          }
        };
      }
    },
    traces: {
      createTrace: async (input) => {
        createTraceCalls.push(input);
        return { id: 'trace-1' };
      }
    },
    feedSource: {
      fetchFeed: async ({ url }) => ({
        title: 'Product updates feed',
        content: `Fetched feed content from ${url}`,
        diagnostics: { fetchMethod: 'feed', itemCount: 3 }
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: 'assistant-1',
    question: 'Summarize the RSS feed https://example.com/rss.xml'
  });

  assert.equal(result.routeType, 'external_source');
  assert.equal(result.routeReason, 'explicit_source_url');
  assert.equal(answeringCalls.length, 1);
  assert.match(
    answeringCalls[0].chunks[0].content,
    /Fetched feed content from https:\/\/example.com\/rss.xml/
  );
  assert.equal(createTraceCalls.length, 1);
  assert.deepEqual(createTraceCalls[0].retrievalMetadataJson.routeDecision, {
    routeType: 'external_source',
    routeReason: 'explicit_source_url'
  });
  assert.deepEqual(
    createTraceCalls[0].retrievalMetadataJson.executionToolNames,
    ['external_source_fetch']
  );
  assert.equal(
    createTraceCalls[0].retrievalMetadataJson.externalSource.url,
    'https://example.com/rss.xml'
  );
  assert.equal(
    createTraceCalls[0].retrievalMetadataJson.externalSource.kind,
    'feed'
  );
  assert.deepEqual(
    createTraceCalls[0].retrievalMetadataJson.externalSource.diagnostics,
    {
      fetchMethod: 'feed',
      itemCount: 3
    }
  );
});

test('explicit external source asks fetch sitemap content into answering and trace metadata', async () => {
  const answeringCalls = [];
  const createTraceCalls = [];

  const service = createAskAssistantService({
    answering: {
      generateAnswer: async (input) => {
        answeringCalls.push(input);
        return {
          answer: 'Sitemap answer',
          citations: [],
          retrievedChunks: input.chunks,
          contextGroups: input.contextGroups,
          answeringMetadata: {
            promptId: 'answer.v2',
            usedFallback: false,
            answerPolicy: input.answerPolicy,
            resolvedLanguage: 'en',
            generationMode: 'generated',
            contextMode: 'chunks',
            inputChunkCount: input.chunks.length,
            promptContextCount: input.chunks.length,
            contextGroupCount: input.contextGroups.length,
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
          modelName: 'test-model',
          answerStatus: 'grounded',
          missingInformation: [],
          qualityEvaluation: {
            overall: 'strong',
            grounding: 'grounded',
            completeness: 'complete',
            primaryIssue: 'none',
            flags: [],
            summary: 'Grounded answer from external source.'
          }
        };
      }
    },
    traces: {
      createTrace: async (input) => {
        createTraceCalls.push(input);
        return { id: 'trace-1' };
      }
    },
    sitemapSource: {
      fetchSitemap: async ({ url }) => ({
        content: `Fetched sitemap content from ${url}`,
        diagnostics: { fetchMethod: 'sitemap', pageCount: 3 }
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: 'assistant-1',
    question: 'Inspect sitemap https://example.com/sitemap.xml'
  });

  assert.equal(result.routeType, 'external_source');
  assert.equal(result.routeReason, 'explicit_source_url');
  assert.equal(answeringCalls.length, 1);
  assert.match(
    answeringCalls[0].chunks[0].content,
    /Fetched sitemap content from https:\/\/example.com\/sitemap.xml/
  );
  assert.equal(createTraceCalls.length, 1);
  assert.deepEqual(createTraceCalls[0].retrievalMetadataJson.routeDecision, {
    routeType: 'external_source',
    routeReason: 'explicit_source_url'
  });
  assert.deepEqual(
    createTraceCalls[0].retrievalMetadataJson.executionToolNames,
    ['external_source_fetch']
  );
  assert.equal(
    createTraceCalls[0].retrievalMetadataJson.externalSource.url,
    'https://example.com/sitemap.xml'
  );
  assert.equal(
    createTraceCalls[0].retrievalMetadataJson.externalSource.kind,
    'sitemap'
  );
  assert.deepEqual(
    createTraceCalls[0].retrievalMetadataJson.externalSource.diagnostics,
    {
      fetchMethod: 'sitemap',
      pageCount: 3
    }
  );
});
