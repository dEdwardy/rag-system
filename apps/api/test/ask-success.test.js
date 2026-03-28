const assert = require("node:assert/strict");
const { AskAssistantService } = require("../src/modules/assistants/ask-assistant.service.ts");
const {
  createAnswerPolicy,
  createAskAssistantService,
  createAssistantRecord
} = require("./support/ask-assistant-test-helpers.js");

test("AskAssistantService completes the happy path with retrieval, messages, and successful trace update", async () => {
  const createConversationCalls = [];
  const retrievalCalls = [];
  const createTraceCalls = [];
  const updateTraceCalls = [];
  const createdMessages = [];
  const attachedTraces = [];
  const touchedConversations = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "retrieved content marker",
      score: 0.9,
      vectorScore: 0.9,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];
  const contextGroups = [
    {
      documentId: "document-1",
      documentTitle: "Document 1",
      startChunkIndex: 0,
      endChunkIndex: 0,
      chunkIds: ["chunk-1"],
      primaryChunkIds: ["chunk-1"],
      mergedContent: "retrieved content marker",
      pageNumbers: [1],
      sectionTitles: ["Facts"]
    }
  ];
  const citations = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      snippet: "retrieved content marker"
    }
  ];
  const embeddingDiagnostics = {
    active: {
      provider: "openai",
      model: "text-embedding-3-small",
      modelName: "openai:text-embedding-3-small",
      dimensions: 1536,
      modelSource: "env:OPENAI_EMBEDDING_MODEL",
      dimensionsSource: "provider_response",
      fallbackState: "none"
    },
    indexed: {
      provider: "openai",
      model: "text-embedding-3-small",
      modelName: "openai:text-embedding-3-small",
      dimensions: 1536,
      fallbackState: "none",
      recordCount: 6,
      documentCount: 1
    }
  };

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        tone: "friendly",
        outputFormat: "bullets",
        language: "same_as_question",
        citationMode: "required",
        maxCitations: 2,
        noAnswerBehavior: "say_insufficient_context",
        includeMissingInformation: false
      }),
      retrievalProfile: {
        scoreThreshold: 0.2,
        chunkWindow: 1,
        enableHybrid: true,
        enableRerank: true,
        filtersJson: {
          documentIds: {
            include: ["document-1"],
            exclude: ["document-2"]
          },
          sectionTitles: {
            contains: ["fact"]
          }
        }
      }
    }),
    conversations: {
      createConversation: async input => {
        createConversationCalls.push(input);
        return { id: "conversation-1" };
      },
      getConversation: async () => {
        throw new Error("should not load an existing conversation in this test");
      },
      touchConversation: async conversationId => {
        touchedConversations.push(conversationId);
      }
    },
    messages: {
      createMessage: async input => {
        const message = {
          id: input.role === "user" ? "user-message-1" : "assistant-message-1",
          ...input
        };
        createdMessages.push(message);
        return message;
      },
      attachTrace: async (messageId, traceId) => {
        attachedTraces.push({ messageId, traceId });
      }
    },
    retrieval: {
      retrieve: async input => {
        retrievalCalls.push(input);
        return {
          retrievedChunks,
          contextGroups,
          embedding: embeddingDiagnostics,
          execution: {
            actualMode: "hybrid",
            usedFallback: false,
            fallbackReason: null,
            rerankApplied: true,
            chunkWindowApplied: true,
            vectorSearchAttempted: true,
            lexicalSearchAttempted: true,
            vectorCandidateLimitHit: false,
            lexicalCandidateLimitHit: false,
            rankingTopKHit: false,
            candidateLimit: 12,
            vectorCandidateCount: 3,
            lexicalCandidateCount: 2,
            mergedCandidateCount: 4,
            rankedCandidateCount: 1
          }
        };
      }
    },
    answering: {
      generateAnswer: async input => {
        assert.equal(input.question, "where is the marker?");
        assert.equal(input.systemPrompt, "system prompt");
        assert.deepEqual(input.answerPolicy, {
          responseStyle: "balanced",
          tone: "friendly",
          outputFormat: "bullets",
          language: "same_as_question",
          citationMode: "required",
          maxCitations: 2,
          noAnswerBehavior: "say_insufficient_context",
          includeMissingInformation: false
        });
        assert.deepEqual(input.chunks, retrievedChunks);
        assert.deepEqual(input.contextGroups, contextGroups);
        return {
          answer: "The marker is in Document 1.",
          citations,
          retrievedChunks,
          contextGroups,
          answeringMetadata: {
            promptId: "answer.v2",
            usedFallback: true,
            answerPolicy: {
              responseStyle: "balanced",
              tone: "friendly",
              outputFormat: "bullets",
              language: "same_as_question",
              citationMode: "required",
              maxCitations: 2,
              noAnswerBehavior: "say_insufficient_context",
              includeMissingInformation: false
            },
            resolvedLanguage: "en",
            generationMode: "generated",
            contextMode: "context_groups",
            inputChunkCount: 1,
            promptContextCount: 1,
            contextGroupCount: 1,
            citationCountBeforeLimit: 1,
            citationCount: 1,
            citationLimitHit: false,
            citationAttribution: "explicit",
            citationSelectionSource: "structured",
            missingInformationCount: 0,
            missingInformationSource: "none",
            answerTextSource: "model",
            insufficientContextReason: null,
            answerStatusSource: "model",
            answerStatus: "grounded"
          },
          modelName: "fallback-local",
          answerStatus: "grounded",
          missingInformation: [],
          qualityEvaluation: {
            overall: "strong",
            grounding: "grounded",
            completeness: "complete",
            primaryIssue: "none",
            flags: [],
            summary: "Answer is grounded in cited sources with no reported gaps."
          }
        };
      }
    },
    traces: {
      createTrace: async input => {
        createTraceCalls.push(input);
        return { id: "trace-1" };
      },
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async ({ question }) => ({
        rewrittenQuery: `${question} rewritten`,
        modelName: "rewrite-model",
        usedFallback: true,
        promptId: "rewrite-query.v1"
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "where is the marker?"
  });

  assert.deepEqual(createConversationCalls, [
    {
      tenantId: "tenant-1",
      userId: "default-user",
      assistantId: "assistant-1",
      title: "where is the marker?"
    }
  ]);
  assert.equal(createdMessages.length, 2);
  assert.deepEqual(
    createdMessages.map(message => ({
      id: message.id,
      role: message.role,
      traceId: message.traceId ?? null
    })),
    [
      {
        id: "user-message-1",
        role: "user",
        traceId: null
      },
      {
        id: "assistant-message-1",
        role: "assistant",
        traceId: "trace-1"
      }
    ]
  );
  assert.deepEqual(retrievalCalls, [
    {
      kbId: "kb-1",
      query: "where is the marker? rewritten",
      topK: 4,
      scoreThreshold: 0.2,
      chunkWindow: 1,
      enableHybrid: true,
      enableRerank: true,
      filters: {
        documentIds: {
          include: ["document-1"],
          exclude: ["document-2"]
        },
        sectionTitles: {
          contains: ["fact"]
        }
      },
      strategy: {
        queryRewrite: {
          enabled: true
        },
        candidateSelection: {
          mode: "hybrid",
          candidateMultiplier: 3,
          minCandidates: 4
        },
        hybrid: {
          vectorWeight: 0.7,
          lexicalWeight: 0.3
        },
        rerank: {
          enabled: true
        }
      }
    }
  ]);
  assert.equal(createTraceCalls.length, 1);
  assert.equal(createTraceCalls[0].status, "success");
  assert.equal(createTraceCalls[0].rewrittenQuery, "where is the marker? rewritten");
  assert.deepEqual(createTraceCalls[0].retrievalMetadataJson, {
    strategy: {
      queryRewrite: {
        enabled: true
      },
      candidateSelection: {
        mode: "hybrid",
        candidateMultiplier: 3,
        minCandidates: 4
      },
      hybrid: {
        vectorWeight: 0.7,
        lexicalWeight: 0.3
      },
      rerank: {
        enabled: true
      }
    },
    filters: {
      documentIds: {
        include: ["document-1"],
        exclude: ["document-2"]
      },
      sectionTitles: {
        contains: ["fact"]
      }
    },
    queryRewrite: {
      enabled: true,
      applied: true,
      finalQuerySource: "rewritten",
      usedFallback: true,
      modelName: "rewrite-model",
      promptId: "rewrite-query.v1"
    },
    strategySummary: {
      retrievalMode: "hybrid",
      strategyMode: "hybrid",
      retrievalQuerySource: "rewritten",
      rewriteEnabled: true,
      rewriteApplied: true,
      rewriteUsedFallback: true,
      rewritePromptId: "rewrite-query.v1",
      rewriteModelName: "rewrite-model",
      fallbackReason: null,
      usedFallback: false
    },
    embedding: embeddingDiagnostics,
    execution: {
      retrievalQuery: "where is the marker? rewritten",
      topK: 4,
      scoreThreshold: 0.2,
      chunkWindow: 1,
      actualMode: "hybrid",
      usedFallback: false,
      fallbackReason: null,
      rerankApplied: true,
      chunkWindowApplied: true,
      vectorSearchAttempted: true,
      lexicalSearchAttempted: true,
      vectorCandidateLimitHit: false,
      lexicalCandidateLimitHit: false,
      rankingTopKHit: false,
      candidateLimit: 12,
      vectorCandidateCount: 3,
      lexicalCandidateCount: 2,
      mergedCandidateCount: 4,
      rankedCandidateCount: 1,
      retrievedChunkCount: 1,
      contextGroupCount: 1,
      primaryChunkCount: 1,
      neighborChunkCount: 0
    }
  });
  assert.equal(createTraceCalls[0].retrievalMetadataJson.execution.neighborChunkCount, 0);
  assert.deepEqual(attachedTraces, [
    {
      messageId: "user-message-1",
      traceId: "trace-1"
    }
  ]);
  assert.deepEqual(touchedConversations, ["conversation-1"]);
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(updateTraceCalls[0].id, "trace-1");
  assert.equal(updateTraceCalls[0].input.status, "success");
  assert.equal(updateTraceCalls[0].input.assistantMessageId, "assistant-message-1");
  assert.deepEqual(updateTraceCalls[0].input.citationsJson, citations);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "strong",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "none",
    flags: [],
    summary: "Answer is grounded in cited sources with no reported gaps."
  });
  assert.deepEqual(updateTraceCalls[0].input.retrievalMetadataJson, createTraceCalls[0].retrievalMetadataJson);
  assert.deepEqual(updateTraceCalls[0].input.answeringMetadataJson, {
    promptId: "answer.v2",
    usedFallback: true,
    answerPolicy: {
      responseStyle: "balanced",
      tone: "friendly",
      outputFormat: "bullets",
      language: "same_as_question",
      citationMode: "required",
      maxCitations: 2,
      noAnswerBehavior: "say_insufficient_context",
      includeMissingInformation: false
    },
    resolvedLanguage: "en",
    generationMode: "generated",
    contextMode: "context_groups",
    inputChunkCount: 1,
    promptContextCount: 1,
    contextGroupCount: 1,
    citationCountBeforeLimit: 1,
    citationCount: 1,
    citationLimitHit: false,
    citationAttribution: "explicit",
    citationSelectionSource: "structured",
    missingInformationCount: 0,
    missingInformationSource: "none",
    answerTextSource: "model",
    insufficientContextReason: null,
    answerStatusSource: "model",
    answerStatus: "grounded"
  });
  assert.equal(result.conversationId, "conversation-1");
  assert.equal(result.traceId, "trace-1");
  assert.equal(result.answer, "The marker is in Document 1.");
  assert.deepEqual(result.citations, citations);
  assert.deepEqual(result.retrievedChunks, retrievedChunks);
  assert.deepEqual(result.contextGroups, contextGroups);
  assert.deepEqual(result.strategySummary, createTraceCalls[0].retrievalMetadataJson.strategySummary);
  assert.deepEqual(result.retrievalMetadata, createTraceCalls[0].retrievalMetadataJson);
  assert.deepEqual(result.answerAttributionSummary, {
    attribution: "explicit",
    source: "structured",
    readability: "explicit:structured",
    attributionLabel: "explicit attribution",
    sourceLabel: "structured evidence source",
    readabilityLabel: "explicit attribution via structured evidence source",
    readabilityHint: "explicit attribution via structured evidence source",
    readabilityResolvedLabel: "explicit attribution via structured evidence source",
    readabilitySentence: "Answer attribution is explicit; source evidence is structured."
  });
  assert.equal(result.answerAttribution, "explicit");
  assert.equal(result.answerAttributionSource, "structured");
  assert.deepEqual(result.answeringMetadata, {
    promptId: "answer.v2",
    usedFallback: true,
    answerPolicy: {
      responseStyle: "balanced",
      tone: "friendly",
      outputFormat: "bullets",
      language: "same_as_question",
      citationMode: "required",
      maxCitations: 2,
      noAnswerBehavior: "say_insufficient_context",
      includeMissingInformation: false
    },
    resolvedLanguage: "en",
    generationMode: "generated",
    contextMode: "context_groups",
    inputChunkCount: 1,
    promptContextCount: 1,
    contextGroupCount: 1,
    citationCountBeforeLimit: 1,
    citationCount: 1,
    citationLimitHit: false,
    citationAttribution: "explicit",
    citationSelectionSource: "structured",
    missingInformationCount: 0,
    missingInformationSource: "none",
    answerTextSource: "model",
    insufficientContextReason: null,
    answerStatusSource: "model",
    answerStatus: "grounded"
  });
  assert.equal(result.modelName, "fallback-local");
  assert.equal(result.answerStatus, "grounded");
  assert.deepEqual(result.missingInformation, []);
  assert.equal(result.retrievalMetadata.strategySummary?.strategyMode, "hybrid");
  assert.deepEqual(result.qualityEvaluation, {
    overall: "strong",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "none",
    flags: [],
    summary: "Answer is grounded in cited sources with no reported gaps."
  });
});

test("AskAssistantService can disable query rewrite and forwards resolved retrieval strategy", async () => {
  const retrievalCalls = [];
  let rewriteCalls = 0;

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: null,
      retrievalProfile: {
        enableHybrid: true,
        strategyJson: {
          queryRewrite: {
            enabled: false
          },
          candidateSelection: {
            mode: "lexical",
            candidateMultiplier: 5,
            minCandidates: 9
          },
          hybrid: {
            vectorWeight: 0.2,
            lexicalWeight: 0.8
          },
          rerank: {
            enabled: true
          }
        }
      }
    }),
    conversations: {
      getConversation: async () => {
        throw new Error("should not load an existing conversation in this test");
      }
    },
    retrieval: {
      retrieve: async input => {
        retrievalCalls.push(input);
        return {
          retrievedChunks: [],
          contextGroups: [],
          execution: {
            actualMode: "lexical",
            usedFallback: false,
            fallbackReason: null,
            rerankApplied: true,
            chunkWindowApplied: false,
            vectorSearchAttempted: false,
            lexicalSearchAttempted: true,
            vectorCandidateLimitHit: false,
            lexicalCandidateLimitHit: false,
            rankingTopKHit: false,
            candidateLimit: 20,
            vectorCandidateCount: 0,
            lexicalCandidateCount: 0,
            mergedCandidateCount: 0,
            rankedCandidateCount: 0
          }
        };
      }
    },
    answering: {
      buildDeterministicInsufficientContextResult: () => ({
        answer: "answer",
        citations: [],
        retrievedChunks: [],
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: true,
          answerPolicy: {
            responseStyle: "concise",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "auto",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "say_insufficient_context",
            includeMissingInformation: true
          },
          resolvedLanguage: "en",
          generationMode: "deterministic_bypass",
          contextMode: "chunks",
          inputChunkCount: 0,
          promptContextCount: 0,
          contextGroupCount: 0,
          citationCountBeforeLimit: 0,
          citationCount: 0,
          citationLimitHit: false,
          citationAttribution: "none",
          citationSelectionSource: "none",
          missingInformationCount: 0,
          missingInformationSource: "none",
          answerTextSource: "deterministic_policy",
          insufficientContextReason: "no_retrieval_hits",
          answerStatusSource: "deterministic_policy",
          answerStatus: "insufficient_context"
        },
        modelName: "fallback-local",
        answerStatus: "insufficient_context",
        missingInformation: [],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "no_retrieval_hits",
          flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
          summary: "Answer quality is weak because supporting context was insufficient."
        }
      }),
      generateAnswer: async () => ({
        answer: "answer",
        citations: [],
        retrievedChunks: [],
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: true,
          answerPolicy: {
            responseStyle: "concise",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "auto",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "say_insufficient_context",
            includeMissingInformation: true
          },
          resolvedLanguage: "en",
          generationMode: "deterministic_bypass",
          contextMode: "chunks",
          inputChunkCount: 0,
          promptContextCount: 0,
          contextGroupCount: 0,
          citationCountBeforeLimit: 0,
          citationCount: 0,
          citationLimitHit: false,
          citationAttribution: "none",
          missingInformationCount: 0,
          missingInformationSource: "none",
          answerStatus: "insufficient_context"
        },
        modelName: "fallback-local",
        answerStatus: "insufficient_context",
        missingInformation: [],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "no_retrieval_hits",
          flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
          summary: "Answer quality is weak because supporting context was insufficient."
        }
      })
    },
    traces: {
      createTrace: async input => ({ id: "trace-1", ...input }),
      updateTrace: async (id, input) => ({ id, ...input })
    },
    llm: {
      rewriteQuery: async () => {
        rewriteCalls += 1;
        return {
          rewrittenQuery: "rewritten question",
          modelName: "rewrite-model",
          usedFallback: false,
          promptId: "rewrite-query.v1"
        };
      }
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "original question"
  });

  assert.equal(rewriteCalls, 0);
  assert.deepEqual(retrievalCalls, [
    {
      kbId: "kb-1",
      query: "original question",
      topK: 4,
      scoreThreshold: 0,
      chunkWindow: 0,
      enableHybrid: true,
      enableRerank: false,
      filters: undefined,
      strategy: {
        queryRewrite: {
          enabled: false
        },
        candidateSelection: {
          mode: "lexical",
          candidateMultiplier: 5,
          minCandidates: 9
        },
        hybrid: {
          vectorWeight: 0.2,
          lexicalWeight: 0.8
        },
        rerank: {
          enabled: true
        }
      }
    }
  ]);
  assert.deepEqual(result.retrievalMetadata, {
    strategy: {
      queryRewrite: {
        enabled: false
      },
      candidateSelection: {
        mode: "lexical",
        candidateMultiplier: 5,
        minCandidates: 9
      },
      hybrid: {
        vectorWeight: 0.2,
        lexicalWeight: 0.8
      },
      rerank: {
        enabled: true
      }
    },
    filters: null,
    queryRewrite: {
      enabled: false,
      applied: false,
      finalQuerySource: "original_disabled",
      usedFallback: null,
      modelName: null,
      promptId: null
    },
    strategySummary: {
      retrievalMode: "lexical",
      strategyMode: "lexical",
      retrievalQuerySource: "original_disabled",
      rewriteEnabled: false,
      rewriteApplied: false,
      rewriteUsedFallback: null,
      rewritePromptId: null,
      rewriteModelName: null,
      fallbackReason: null,
      usedFallback: false
    },
    embedding: null,
    execution: {
      retrievalQuery: "original question",
      topK: 4,
      scoreThreshold: 0,
      chunkWindow: 0,
      actualMode: "lexical",
      usedFallback: false,
      fallbackReason: null,
      rerankApplied: true,
      chunkWindowApplied: false,
      vectorSearchAttempted: false,
      lexicalSearchAttempted: true,
      vectorCandidateLimitHit: false,
      lexicalCandidateLimitHit: false,
      rankingTopKHit: false,
      candidateLimit: 20,
      vectorCandidateCount: 0,
      lexicalCandidateCount: 0,
      mergedCandidateCount: 0,
      rankedCandidateCount: 0,
      retrievedChunkCount: 0,
      contextGroupCount: 0,
      primaryChunkCount: 0,
      neighborChunkCount: 0
    }
  });
  assert.equal(result.retrievalMetadata.execution.neighborChunkCount, 0);
  assert.deepEqual(result.answerAttributionSummary, {
    attribution: "none",
    source: "none",
    readability: "none:none",
    attributionLabel: "no attribution",
    sourceLabel: "no evidence source",
    readabilityLabel: "no attribution via no evidence source",
    readabilityHint: "no attribution via no evidence source",
    readabilityResolvedLabel: "no attribution via no evidence source",
    readabilitySentence: "Answer attribution is none; source evidence is none."
  });
  assert.equal(result.answerAttribution, "none");
  assert.equal(result.answerAttributionSource, "none");
  assert.deepEqual(result.answeringMetadata, {
    promptId: "answer.v2",
    usedFallback: true,
    answerPolicy: {
      responseStyle: "concise",
      tone: "neutral",
      outputFormat: "paragraph",
      language: "auto",
      citationMode: "required",
      maxCitations: 3,
      noAnswerBehavior: "say_insufficient_context",
      includeMissingInformation: true
    },
    resolvedLanguage: "en",
    generationMode: "deterministic_bypass",
    contextMode: "chunks",
    inputChunkCount: 0,
    promptContextCount: 0,
    contextGroupCount: 0,
    citationCountBeforeLimit: 0,
    citationCount: 0,
    citationLimitHit: false,
    citationAttribution: "none",
    citationSelectionSource: "none",
    missingInformationCount: 0,
    missingInformationSource: "none",
    answerTextSource: "deterministic_policy",
    insufficientContextReason: "no_retrieval_hits",
    answerStatusSource: "deterministic_policy",
    answerStatus: "insufficient_context"
  });
  assert.equal(result.traceId, "trace-1");
  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "no_retrieval_hits",
    flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
    summary: "Answer quality is weak because supporting context was insufficient."
  });
});

test("AskAssistantService bypasses one-shot generation for no-hit say_insufficient_context answers", async () => {
  let generateAnswerCalls = 0;

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        language: "en"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks: [],
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      buildDeterministicInsufficientContextResult: ({ question }) => ({
        answer: `deterministic fallback for: ${question}`,
        citations: [],
        retrievedChunks: [],
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: true,
          answerPolicy: {
            responseStyle: "concise",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "auto",
            citationMode: "required",
      maxCitations: 3,
      noAnswerBehavior: "say_insufficient_context",
      includeMissingInformation: true
    },
    resolvedLanguage: "en",
    contextMode: "chunks",
          inputChunkCount: 0,
          contextGroupCount: 0,
          citationCount: 0,
          answerStatus: "insufficient_context"
        },
        modelName: "fallback-local",
        answerStatus: "insufficient_context",
        missingInformation: ["No relevant supporting sources were retrieved."],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "no_retrieval_hits",
          flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
          summary: "Answer quality is weak because supporting context was insufficient."
        }
      }),
      generateAnswer: async () => {
        generateAnswerCalls += 1;
        throw new Error("generateAnswer should be bypassed");
      },
      finalizeStreamedAnswer: async () => {
        throw new Error("finalizeStreamedAnswer should not be used by one-shot ask");
      }
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async () => ({})
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      }),
      generateAnswerStream: async () => {
        throw new Error("stream generation should not be used by one-shot ask");
      }
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "What detail is missing?"
  });

  assert.equal(generateAnswerCalls, 0);
  assert.equal(result.answer, "deterministic fallback for: What detail is missing?");
  assert.equal(result.modelName, "fallback-local");
  assert.equal(result.answeringMetadata.usedFallback, true);
  assert.equal(result.answerStatus, "insufficient_context");
  assert.deepEqual(result.missingInformation, ["No relevant supporting sources were retrieved."]);
  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "no_retrieval_hits",
    flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
    summary: "Answer quality is weak because supporting context was insufficient."
  });
});

test("AskAssistantService also bypasses one-shot generation when noAnswerBehavior comes from backend defaults", async () => {
  let generateAnswerCalls = 0;

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: null
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks: [],
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      buildDeterministicInsufficientContextResult: ({ question }) => ({
        answer: `deterministic fallback for: ${question}`,
        citations: [],
        retrievedChunks: [],
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: true,
          answerPolicy: {
            responseStyle: "concise",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "auto",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "say_insufficient_context",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 0,
          contextGroupCount: 0,
          citationCount: 0,
          answerStatus: "insufficient_context"
        },
        modelName: "fallback-local",
        answerStatus: "insufficient_context",
        missingInformation: ["No relevant supporting sources were retrieved."],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "no_retrieval_hits",
          flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
          summary: "Answer quality is weak because supporting context was insufficient."
        }
      }),
      generateAnswer: async () => {
        generateAnswerCalls += 1;
        throw new Error("generateAnswer should be bypassed when defaults say insufficient context");
      }
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async () => ({})
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "What detail is missing?"
  });

  assert.equal(generateAnswerCalls, 0);
  assert.equal(result.answer, "deterministic fallback for: What detail is missing?");
  assert.equal(result.answeringMetadata.answerPolicy.noAnswerBehavior, "say_insufficient_context");
  assert.equal(result.answerStatus, "insufficient_context");
});

test("AskAssistantService preserves best_effort one-shot no-hit answers instead of using deterministic bypass", async () => {
  let generateAnswerCalls = 0;

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        tone: "direct",
        language: "en",
        citationMode: "optional",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks: [],
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async input => {
        generateAnswerCalls += 1;
        assert.equal(input.answerPolicy.noAnswerBehavior, "best_effort");
          return {
            answer: "Best effort answer with uncertainty.",
            citations: [],
            retrievedChunks: [],
            contextGroups: [],
           answeringMetadata: {
             promptId: "answer.v2",
             usedFallback: false,
             answerPolicy: input.answerPolicy,
             contextMode: "chunks",
               inputChunkCount: 0,
               contextGroupCount: 0,
               citationCount: 0,
               missingInformationSource: "model",
               answerTextSource: "model",
               insufficientContextReason: "no_retrieval_hits",
               answerStatusSource: "model",
               answerStatus: "insufficient_context"
             },
          modelName: "test-model",
          answerStatus: "insufficient_context",
          missingInformation: ["No relevant supporting sources were retrieved."],
          qualityEvaluation: {
            overall: "weak",
            grounding: "ungrounded",
            completeness: "insufficient",
            primaryIssue: "no_retrieval_hits",
            flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
            summary: "Answer quality is weak because supporting context was insufficient."
          }
        };
      }
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async () => ({})
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "What detail is missing?"
  });

  assert.equal(generateAnswerCalls, 1);
  assert.equal(result.answer, "Best effort answer with uncertainty.");
  assert.equal(result.answeringMetadata.answerPolicy.noAnswerBehavior, "best_effort");
  assert.equal(result.answerStatus, "insufficient_context");
  assert.equal(result.answeringMetadata.answerTextSource, "model");
  assert.equal(result.answeringMetadata.insufficientContextReason, "no_retrieval_hits");
  assert.equal(result.answeringMetadata.answerStatusSource, "model");
  assert.equal(result.answeringMetadata.missingInformationSource, "model");
});

test("AskAssistantService localizes one-shot deterministic no-hit answers for Chinese questions", async () => {
  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        language: "same_as_question"
      })
    }),
    answering: {
      buildDeterministicInsufficientContextResult: () => ({
        answer:
          "\u6839\u636e\u5f53\u524d\u68c0\u7d22\u5230\u7684\u8d44\u6599\uff0c\u6211\u8fd8\u6ca1\u6709\u8db3\u591f\u4fe1\u606f\u6765\u53ef\u9760\u56de\u7b54\u8fd9\u4e2a\u95ee\u9898\u3002",
        citations: [],
        retrievedChunks: [],
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: true,
          answerPolicy: {
            responseStyle: "concise",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "same_as_question",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "say_insufficient_context",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 0,
          contextGroupCount: 0,
          citationCount: 0,
          answerStatus: "insufficient_context"
        },
        modelName: "fallback-local",
        answerStatus: "insufficient_context",
        missingInformation: [
          "\u6ca1\u6709\u68c0\u7d22\u5230\u53ef\u7528\u4e8e\u652f\u6301\u56de\u7b54\u7684\u76f8\u5173\u6765\u6e90\u3002"
        ],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "no_retrieval_hits",
          flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
          summary:
            "\u56de\u7b54\u8d28\u91cf\u8f83\u5f31\uff0c\u56e0\u4e3a\u6ca1\u6709\u8db3\u591f\u7684\u652f\u6301\u4e0a\u4e0b\u6587\u3002"
        }
      }),
      generateAnswer: async () => {
        throw new Error("generateAnswer should be bypassed");
      }
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "\u8fd9\u4e2a\u95ee\u9898\u7f3a\u5c11\u4ec0\u4e48\u4fe1\u606f\uff1f"
  });

  assert.equal(
    result.answer,
    "\u6839\u636e\u5f53\u524d\u68c0\u7d22\u5230\u7684\u8d44\u6599\uff0c\u6211\u8fd8\u6ca1\u6709\u8db3\u591f\u4fe1\u606f\u6765\u53ef\u9760\u56de\u7b54\u8fd9\u4e2a\u95ee\u9898\u3002"
  );
  assert.deepEqual(result.missingInformation, [
    "\u6ca1\u6709\u68c0\u7d22\u5230\u53ef\u7528\u4e8e\u652f\u6301\u56de\u7b54\u7684\u76f8\u5173\u6765\u6e90\u3002"
  ]);
  assert.deepEqual(result.qualityEvaluation, {
    overall: "weak",
    grounding: "ungrounded",
    completeness: "insufficient",
    primaryIssue: "no_retrieval_hits",
    flags: ["no_retrieval_hits", "insufficient_context", "missing_information"],
    summary: "\u56de\u7b54\u8d28\u91cf\u8f83\u5f31\uff0c\u56e0\u4e3a\u6ca1\u6709\u8db3\u591f\u7684\u652f\u6301\u4e0a\u4e0b\u6587\u3002"
  });
});

test("AskAssistantService preserves fallback_generation as the primary quality issue when persisting grounded fallback answers", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "marker content",
      score: 0.4,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "Fallback grounded answer [1]",
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "marker content"
          }
        ],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: true,
          answerPolicy: {
            responseStyle: "concise",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "auto",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "say_insufficient_context",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 1,
          answerStatus: "grounded"
        },
        modelName: "fallback-local",
        answerStatus: "grounded",
        missingInformation: [],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "fallback_generation",
          flags: ["low_retrieval_score", "fallback_generation"],
          summary:
            "Answer is grounded, but retrieval confidence was low for the supporting context, and it was produced through local fallback behavior."
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "Where is the marker?"
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "fallback_generation",
    flags: ["low_retrieval_score", "fallback_generation"],
    summary:
      "Answer is grounded, but retrieval confidence was low for the supporting context, and it was produced through local fallback behavior."
  });
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "fallback_generation",
    flags: ["low_retrieval_score", "fallback_generation"],
    summary:
      "Answer is grounded, but retrieval confidence was low for the supporting context, and it was produced through local fallback behavior."
  });
});

test("AskAssistantService preserves fallback_generation as the primary quality issue when fallback answers also miss information", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "marker content",
      score: 0.9,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "Fallback partial answer [1]",
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "marker content"
          }
        ],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: true,
          answerPolicy: {
            responseStyle: "concise",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "auto",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "say_insufficient_context",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 1,
          answerStatus: "grounded"
        },
        modelName: "fallback-local",
        answerStatus: "grounded",
        missingInformation: ["Need pricing details."],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "partial",
          primaryIssue: "fallback_generation",
          flags: ["missing_information", "fallback_generation"],
          summary:
            "Answer is grounded but incomplete because some information is missing, and it was produced through local fallback behavior."
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "Where is the marker?"
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "partial",
    primaryIssue: "fallback_generation",
    flags: ["missing_information", "fallback_generation"],
    summary:
      "Answer is grounded but incomplete because some information is missing, and it was produced through local fallback behavior."
  });
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "partial",
    grounding: "grounded",
    completeness: "partial",
    primaryIssue: "fallback_generation",
    flags: ["missing_information", "fallback_generation"],
    summary:
      "Answer is grounded but incomplete because some information is missing, and it was produced through local fallback behavior."
  });
});

test("AskAssistantService persists heuristic-citation strong summaries without upgrading them to explicit cited-source wording", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "marker content",
      score: 0.9,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "Answer text without explicit source markers.",
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "marker content"
          }
        ],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: false,
          answerPolicy: {
            responseStyle: "concise",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "auto",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "say_insufficient_context",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 1,
          answerStatus: "grounded"
        },
        modelName: "test-model",
        answerStatus: "grounded",
        missingInformation: [],
        qualityEvaluation: {
          overall: "strong",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "none",
          flags: [],
          summary: "Answer is grounded in retrieved sources with backend-inferred citations and no reported gaps."
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "Where is the marker?"
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "strong",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "none",
    flags: [],
    summary: "Answer is grounded in retrieved sources with backend-inferred citations and no reported gaps."
  });
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "strong",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "none",
    flags: [],
    summary: "Answer is grounded in retrieved sources with backend-inferred citations and no reported gaps."
  });
});

test("AskAssistantService preserves localized heuristic-citation strong summaries in Chinese", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
      score: 0.9,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "same_as_question",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "没有显式来源标记的回答。",
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "中文内容"
          }
        ],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: false,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "same_as_question",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 1,
          answerStatus: "grounded"
        },
        modelName: "test-model",
        answerStatus: "grounded",
        missingInformation: [],
        qualityEvaluation: {
          overall: "strong",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "none",
          flags: [],
          summary: "回答已基于检索到的来源，引用由后端推断补齐，且没有发现已知缺口。"
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "标记在哪里？"
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "none");
  assert.deepEqual(result.qualityEvaluation.flags, []);
  assert.equal(
    result.qualityEvaluation.summary,
    "回答已基于检索到的来源，引用由后端推断补齐，且没有发现已知缺口。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于检索到的来源，引用由后端推断补齐，且没有发现已知缺口。"
  );
});

test("AskAssistantService preserves localized cited-source strong summaries in Chinese", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
      score: 0.9,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "same_as_question",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "回答 [1]",
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "中文内容"
          }
        ],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: false,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "same_as_question",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 1,
          answerStatus: "grounded"
        },
        modelName: "test-model",
        answerStatus: "grounded",
        missingInformation: [],
        qualityEvaluation: {
          overall: "strong",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "none",
          flags: [],
          summary: "回答已基于引用的来源，且没有发现已知缺口。"
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "标记在哪里？"
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "none");
  assert.deepEqual(result.qualityEvaluation.flags, []);
  assert.equal(result.qualityEvaluation.summary, "回答已基于引用的来源，且没有发现已知缺口。");
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于引用的来源，且没有发现已知缺口。"
  );
});

test("AskAssistantService preserves generic strong summaries without citations", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "Citation-free grounded answer support",
      score: 0.9,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "same_as_question",
        citationMode: "optional",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "Here is a grounded answer without explicit citations.",
        citations: [],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: false,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "same_as_question",
            citationMode: "optional",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 0,
          answerStatus: "grounded"
        },
        modelName: "test-model",
        answerStatus: "grounded",
        missingInformation: [],
        qualityEvaluation: {
          overall: "strong",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "none",
          flags: [],
          summary: "Answer is grounded in retrieved sources with no reported gaps."
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "What happened?"
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "strong",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "none",
    flags: [],
    summary: "Answer is grounded in retrieved sources with no reported gaps."
  });
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "strong",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "none",
    flags: [],
    summary: "Answer is grounded in retrieved sources with no reported gaps."
  });
});

test("AskAssistantService preserves localized generic strong summaries without citations in Chinese", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "涓枃鍐呭",
      score: 0.9,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "same_as_question",
        citationMode: "optional",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "杩欐槸涓€涓病鏈夋樉寮忓紩鐢ㄧ殑鍥炵瓟銆?",
        citations: [],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: false,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "same_as_question",
            citationMode: "optional",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 0,
          answerStatus: "grounded"
        },
        modelName: "test-model",
        answerStatus: "grounded",
        missingInformation: [],
        qualityEvaluation: {
          overall: "strong",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "none",
          flags: [],
          summary: "鍥炵瓟宸插熀浜庢绱㈠埌鐨勬潵婧愶紝涓旀病鏈夊彂鐜板凡鐭ョ己鍙ｃ€?"
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "鍙戠敓浜嗕粈涔堬紵"
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "none");
  assert.deepEqual(result.qualityEvaluation.flags, []);
  assert.equal(result.qualityEvaluation.summary, "鍥炵瓟宸插熀浜庢绱㈠埌鐨勬潵婧愶紝涓旀病鏈夊彂鐜板凡鐭ョ己鍙ｃ€?");
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "鍥炵瓟宸插熀浜庢绱㈠埌鐨勬潵婧愶紝涓旀病鏈夊彂鐜板凡鐭ョ己鍙ｃ€?"
  );
});

test("AskAssistantService preserves localized fallback partial summaries in Chinese", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
      score: 0.9,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "same_as_question",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "本地 fallback 部分回答 [1]",
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "中文内容"
          }
        ],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: true,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "same_as_question",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 1,
          answerStatus: "grounded"
        },
        modelName: "fallback-local",
        answerStatus: "grounded",
        missingInformation: ["缺少价格信息。"],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "partial",
          primaryIssue: "fallback_generation",
          flags: ["missing_information", "fallback_generation"],
          summary: "回答已基于检索到的内容，但仍不完整：部分信息缺失，且它是通过本地 fallback 生成的。"
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "标记在哪里？"
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "fallback_generation");
  assert.deepEqual(result.qualityEvaluation.flags, ["missing_information", "fallback_generation"]);
  assert.equal(
    result.qualityEvaluation.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失，且它是通过本地 fallback 生成的。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失，且它是通过本地 fallback 生成的。"
  );
});

test("AskAssistantService preserves localized triple-cause fallback summaries in Chinese", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
      score: 0.4,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "same_as_question",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "本地 fallback 部分回答 [1]",
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "中文内容"
          }
        ],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: true,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "same_as_question",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 1,
          answerStatus: "grounded"
        },
        modelName: "fallback-local",
        answerStatus: "grounded",
        missingInformation: ["缺少价格信息。"],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "partial",
          primaryIssue: "fallback_generation",
          flags: ["missing_information", "low_retrieval_score", "fallback_generation"],
          summary:
            "回答已基于检索到的内容，但仍不完整：部分信息缺失，检索置信度偏低，且它是通过本地 fallback 生成的。"
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "标记在哪里？"
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "fallback_generation");
  assert.deepEqual(result.qualityEvaluation.flags, [
    "missing_information",
    "low_retrieval_score",
    "fallback_generation"
  ]);
  assert.equal(
    result.qualityEvaluation.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失，检索置信度偏低，且它是通过本地 fallback 生成的。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失，检索置信度偏低，且它是通过本地 fallback 生成的。"
  );
});

test("AskAssistantService preserves localized low-confidence weak insufficient-context summaries in Chinese", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
      score: 0.4,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "same_as_question",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "不知道。",
        citations: [],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: false,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "same_as_question",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 0,
          answerStatus: "insufficient_context"
        },
        modelName: "test-model",
        answerStatus: "insufficient_context",
        missingInformation: ["缺少价格信息。"],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "insufficient_context",
          flags: ["insufficient_context", "missing_information", "low_retrieval_score"],
          summary:
            "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答，且检索置信度偏低。"
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "标记在哪里？"
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "insufficient_context");
  assert.deepEqual(result.qualityEvaluation.flags, [
    "insufficient_context",
    "missing_information",
    "low_retrieval_score"
  ]);
  assert.equal(
    result.qualityEvaluation.summary,
    "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答，且检索置信度偏低。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答，且检索置信度偏低。"
  );
});

test("AskAssistantService preserves low-confidence weak insufficient-context summaries", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "marker content",
      score: 0.4,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "en",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "I don't know.",
        citations: [],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: false,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "en",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 0,
          answerStatus: "insufficient_context"
        },
        modelName: "test-model",
        answerStatus: "insufficient_context",
        missingInformation: ["Need pricing details."],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "insufficient_context",
          flags: ["insufficient_context", "missing_information", "low_retrieval_score"],
          summary:
            "Answer quality is weak because retrieved context was still insufficient, and retrieval confidence was low."
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "Where is the marker?"
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "insufficient_context");
  assert.deepEqual(result.qualityEvaluation.flags, [
    "insufficient_context",
    "missing_information",
    "low_retrieval_score"
  ]);
  assert.equal(
    result.qualityEvaluation.summary,
    "Answer quality is weak because retrieved context was still insufficient, and retrieval confidence was low."
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "Answer quality is weak because retrieved context was still insufficient, and retrieval confidence was low."
  );
});

test("AskAssistantService preserves hit-aware weak insufficient-context summaries", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "marker content",
      score: 0.8,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "en",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "I don't know.",
        citations: [],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: false,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "en",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 0,
          answerStatus: "insufficient_context"
        },
        modelName: "test-model",
        answerStatus: "insufficient_context",
        missingInformation: ["Need pricing details."],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "insufficient_context",
          flags: ["insufficient_context", "missing_information"],
          summary: "Answer quality is weak because retrieved context was still insufficient."
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "Where is the marker?"
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "insufficient_context");
  assert.deepEqual(result.qualityEvaluation.flags, [
    "insufficient_context",
    "missing_information"
  ]);
  assert.equal(
    result.qualityEvaluation.summary,
    "Answer quality is weak because retrieved context was still insufficient."
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "Answer quality is weak because retrieved context was still insufficient."
  );
});

test("AskAssistantService preserves localized hit-aware weak insufficient-context summaries in Chinese", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
      score: 0.8,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "same_as_question",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "不知道。",
        citations: [],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: false,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "same_as_question",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 0,
          answerStatus: "insufficient_context"
        },
        modelName: "test-model",
        answerStatus: "insufficient_context",
        missingInformation: ["缺少价格信息。"],
        qualityEvaluation: {
          overall: "weak",
          grounding: "ungrounded",
          completeness: "insufficient",
          primaryIssue: "insufficient_context",
          flags: ["insufficient_context", "missing_information"],
          summary: "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答。"
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "标记在哪里？"
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "insufficient_context");
  assert.deepEqual(result.qualityEvaluation.flags, [
    "insufficient_context",
    "missing_information"
  ]);
  assert.equal(
    result.qualityEvaluation.summary,
    "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答质量较弱，因为即使已检索到上下文，仍不足以支持可靠回答。"
  );
});

test("AskAssistantService preserves grounded partial summaries when information is missing", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "marker content",
      score: 0.8,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "en",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "Partial grounded answer [1]",
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "marker content"
          }
        ],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: false,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "en",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 1,
          answerStatus: "grounded"
        },
        modelName: "test-model",
        answerStatus: "grounded",
        missingInformation: ["Need pricing details."],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "partial",
          primaryIssue: "missing_information",
          flags: ["missing_information"],
          summary: "Answer is grounded but incomplete because some information is missing."
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "Where is the marker?"
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "partial",
    primaryIssue: "missing_information",
    flags: ["missing_information"],
    summary: "Answer is grounded but incomplete because some information is missing."
  });
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "partial",
    grounding: "grounded",
    completeness: "partial",
    primaryIssue: "missing_information",
    flags: ["missing_information"],
    summary: "Answer is grounded but incomplete because some information is missing."
  });
});

test("AskAssistantService preserves localized grounded partial summaries when information is missing", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
      score: 0.8,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "same_as_question",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "部分回答 [1]",
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "中文内容"
          }
        ],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: false,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "same_as_question",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 1,
          answerStatus: "grounded"
        },
        modelName: "test-model",
        answerStatus: "grounded",
        missingInformation: ["缺少价格信息。"],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "partial",
          primaryIssue: "missing_information",
          flags: ["missing_information"],
          summary: "回答已基于检索到的内容，但仍不完整：部分信息缺失。"
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "标记在哪里？"
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "missing_information");
  assert.deepEqual(result.qualityEvaluation.flags, ["missing_information"]);
  assert.equal(
    result.qualityEvaluation.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于检索到的内容，但仍不完整：部分信息缺失。"
  );
});

test("AskAssistantService preserves low-retrieval grounded summaries", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "marker content",
      score: 0.4,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "en",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "Grounded answer [1]",
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "marker content"
          }
        ],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: false,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "en",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 1,
          answerStatus: "grounded"
        },
        modelName: "test-model",
        answerStatus: "grounded",
        missingInformation: [],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "low_retrieval_score",
          flags: ["low_retrieval_score"],
          summary: "Answer is grounded, but retrieval confidence was low for the supporting context."
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "Where is the marker?"
  });

  assert.deepEqual(result.qualityEvaluation, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "low_retrieval_score",
    flags: ["low_retrieval_score"],
    summary: "Answer is grounded, but retrieval confidence was low for the supporting context."
  });
  assert.equal(updateTraceCalls.length, 1);
  assert.deepEqual(updateTraceCalls[0].input.qualityEvaluationJson, {
    overall: "partial",
    grounding: "grounded",
    completeness: "complete",
    primaryIssue: "low_retrieval_score",
    flags: ["low_retrieval_score"],
    summary: "Answer is grounded, but retrieval confidence was low for the supporting context."
  });
});

test("AskAssistantService preserves localized low-retrieval grounded summaries", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
      score: 0.4,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "same_as_question",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "回答 [1]",
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "中文内容"
          }
        ],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: false,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "same_as_question",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 1,
          answerStatus: "grounded"
        },
        modelName: "test-model",
        answerStatus: "grounded",
        missingInformation: [],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "low_retrieval_score",
          flags: ["low_retrieval_score"],
          summary: "回答已基于检索到的内容，但支持上下文的检索置信度偏低。"
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "标记在哪里？"
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "low_retrieval_score");
  assert.deepEqual(result.qualityEvaluation.flags, ["low_retrieval_score"]);
  assert.equal(
    result.qualityEvaluation.summary,
    "回答已基于检索到的内容，但支持上下文的检索置信度偏低。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于检索到的内容，但支持上下文的检索置信度偏低。"
  );
});

test("AskAssistantService preserves fallback-only grounded summaries", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "marker content",
      score: 0.9,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "en",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "Grounded fallback answer [1]",
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "marker content"
          }
        ],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: true,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "en",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 1,
          answerStatus: "grounded"
        },
        modelName: "fallback-local",
        answerStatus: "grounded",
        missingInformation: [],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "fallback_generation",
          flags: ["fallback_generation"],
          summary: "Answer is grounded, but it was produced through local fallback behavior."
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "Where is the marker?"
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "fallback_generation");
  assert.deepEqual(result.qualityEvaluation.flags, ["fallback_generation"]);
  assert.equal(
    result.qualityEvaluation.summary,
    "Answer is grounded, but it was produced through local fallback behavior."
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "Answer is grounded, but it was produced through local fallback behavior."
  );
});

test("AskAssistantService preserves localized fallback-only grounded summaries", async () => {
  const updateTraceCalls = [];

  const retrievedChunks = [
    {
      chunkId: "chunk-1",
      documentId: "document-1",
      documentTitle: "Document 1",
      chunkIndex: 0,
      content: "中文内容",
      score: 0.9,
      isPrimary: true,
      pageNo: 1,
      sectionTitle: "Facts"
    }
  ];

  const service = createAskAssistantService({
    assistant: createAssistantRecord({
      answerPolicyJson: createAnswerPolicy({
        responseStyle: "balanced",
        language: "same_as_question",
        noAnswerBehavior: "best_effort"
      })
    }),
    retrieval: {
      retrieve: async () => ({
        retrievedChunks,
        contextGroups: [],
        execution: {
          actualMode: "vector",
          usedFallback: false
        }
      })
    },
    answering: {
      generateAnswer: async () => ({
        answer: "回答 [1]",
        citations: [
          {
            chunkId: "chunk-1",
            documentId: "document-1",
            documentTitle: "Document 1",
            snippet: "中文内容"
          }
        ],
        retrievedChunks,
        contextGroups: [],
        answeringMetadata: {
          promptId: "answer.v2",
          usedFallback: true,
          answerPolicy: {
            responseStyle: "balanced",
            tone: "neutral",
            outputFormat: "paragraph",
            language: "same_as_question",
            citationMode: "required",
            maxCitations: 3,
            noAnswerBehavior: "best_effort",
            includeMissingInformation: true
          },
          contextMode: "chunks",
          inputChunkCount: 1,
          contextGroupCount: 0,
          citationCount: 1,
          answerStatus: "grounded"
        },
        modelName: "fallback-local",
        answerStatus: "grounded",
        missingInformation: [],
        qualityEvaluation: {
          overall: "partial",
          grounding: "grounded",
          completeness: "complete",
          primaryIssue: "fallback_generation",
          flags: ["fallback_generation"],
          summary: "回答已基于检索到的内容，但它是通过本地 fallback 生成的。"
        }
      })
    },
    traces: {
      createTrace: async () => ({ id: "trace-1" }),
      updateTrace: async (id, input) => {
        updateTraceCalls.push({ id, input });
        return { id, ...input };
      }
    },
    llm: {
      rewriteQuery: async () => ({
        rewrittenQuery: null,
        modelName: null,
        usedFallback: null,
        promptId: null
      })
    }
  });

  const result = await service.askAssistant({
    assistantId: "assistant-1",
    question: "标记在哪里？"
  });

  assert.equal(result.qualityEvaluation.primaryIssue, "fallback_generation");
  assert.deepEqual(result.qualityEvaluation.flags, ["fallback_generation"]);
  assert.equal(
    result.qualityEvaluation.summary,
    "回答已基于检索到的内容，但它是通过本地 fallback 生成的。"
  );
  assert.equal(updateTraceCalls.length, 1);
  assert.equal(
    updateTraceCalls[0].input.qualityEvaluationJson.summary,
    "回答已基于检索到的内容，但它是通过本地 fallback 生成的。"
  );
});
