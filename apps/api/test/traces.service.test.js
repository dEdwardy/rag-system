const assert = require("node:assert/strict");

const { TracesService } = require("../src/modules/traces/traces.service.ts");

test("TracesService exposes failedStage and failureMessage in traceSummary for failed traces", async () => {
  const persistedTrace = {
    id: "trace-1",
    conversationId: "conversation-1",
    assistantId: "assistant-1",
    userMessageId: "user-message-1",
    assistantMessageId: null,
    userQuery: "why did this fail?",
    rewrittenQuery: null,
    retrievedChunkIdsJson: ["chunk-1"],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      execution: {
        actualMode: "vector",
        candidateLimit: 8,
        vectorCandidateCount: 1,
        lexicalCandidateCount: 0,
        mergedCandidateCount: 1,
        rankedCandidateCount: 1,
        vectorCandidateLimitHit: false,
        lexicalCandidateLimitHit: false,
        rankingTopKHit: true,
        retrievedChunkCount: 1
      },
      failure: {
        stage: "answering",
        message: "synthetic answer failure"
      }
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-rewrite-local",
    latencyMs: 42,
    status: "failed",
    errorMessage: "synthetic answer failure",
    createdAt: new Date("2026-03-24T00:00:00.000Z")
  };

  const queryArgs = [];
  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async args => {
        queryArgs.push(args);
        return [persistedTrace];
      }
    }
  };

  const service = new TracesService(prisma);

  const trace = await service.getTrace("trace-1");
  assert.deepEqual(trace.traceSummary, {
    promptId: null,
    answerStatus: null,
    qualityOverall: null,
    primaryIssue: null,
    retrievalMode: "vector",
    retrievalQuerySource: "original_disabled",
    strategyReadabilityLabel: "vector retrieval via original_disabled; fallback: none; fallback used: unknown.",
    retrievalModeProvenanceSentence: "Resolved retrieval mode is vector; fallback usage is unknown.",
    rewriteReadabilityLabel: "rewrite disabled; rewrite applied: no; rewrite fallback: unknown; rewrite prompt: unknown.",
    strategySummary: {
      retrievalMode: "vector",
      strategyMode: "vector",
      retrievalQuerySource: "original_disabled",
      rewriteEnabled: false,
      rewriteApplied: false,
      rewriteUsedFallback: null,
      rewritePromptId: null,
      rewriteModelName: null,
      fallbackReason: null,
      usedFallback: null
    },
    generationMode: null,
    contextMode: null,
    rewriteApplied: false,
    fallbackReason: null,
    resolvedLanguage: null,
    answerAttributionSummary: {
      attribution: null,
      source: null,
      readability: null,
      attributionLabel: null,
      sourceLabel: null,
      readabilityLabel: null,
      readabilityHint: null,
      readabilityResolvedLabel: "unknown attribution via unknown evidence source",
      readabilitySentence: "Answer attribution is unknown; source evidence is unknown."
    },
    answerAttributionReadabilitySentence: "Answer attribution is unknown; source evidence is unknown.",
    answerAttribution: null,
    answerAttributionSource: null,
    answerEvidenceSource: null,
    answerEvidenceSourceReadabilityLabel: "unknown evidence source",
    answerEvidenceSourceReadabilitySentence: "Answer evidence source is unknown evidence source.",
    citationAttribution: null,
    citationSelectionSource: null,
    missingInformationCount: 0,
    missingInformationCountReadabilityLabel: "no missing-information items",
    missingInformationSource: null,
    missingInformationSourceReadabilityLabel: "unknown missing-information source",
    insufficientContextReason: null,
    missingInformationProvenanceSentence: "Missing-information source is unknown; insufficient-context reason is none; missing-information count is 0.",
    answerTextSource: null,
    answerTextSourceReadabilityLabel: "unknown answer text source",
    answerTextSourceReadabilitySentence: "Answer text source is unknown answer text source.",
    answerStatusSource: null,
    answerStatusSourceReadabilityLabel: "unknown answer status source",
    answerStatusSourceReadabilitySentence: "Answer status source is unknown answer status source.",
    answerProvenanceReadabilitySentence: "Answer text source is unknown answer text source; answer status source is unknown answer status source; Answer attribution is unknown; source evidence is unknown.",
    answerProvenanceSentence: "Answer text source is unknown; status source is unknown; attribution summary is unknown attribution via unknown evidence source.",
    failedStage: "answering",
    failedStageReadabilityLabel: "answering stage failed",
    failureMessage: "synthetic answer failure",
    failureReadabilitySentence: "answering stage failed; message: synthetic answer failure.",
    candidateLimit: 8,
    vectorCandidateCount: 1,
    lexicalCandidateCount: 0,
    mergedCandidateCount: 1,
    rankedCandidateCount: 1,
    candidateCountReadabilityLabel: "vector 1, lexical 0, merged 1, ranked 1 (candidate limit 8)",
    candidateCountReadabilitySentence: "Candidate flow produced 1 ranked candidates from 1 merged candidates (1 vector, 0 lexical) with candidate limit 8.",
    vectorCandidateLimitHit: false,
    lexicalCandidateLimitHit: false,
    rankingTopKHit: true,
    primaryChunkCount: 1,
    neighborChunkCount: 0,
    retrievedChunkCount: 1,
    inputChunkCount: 1,
    promptContextCount: 1,
    contextGroupCount: 0,
    contextReadabilitySentence: "Prompt context used 1 items via unknown mode (1 input chunks, 0 context groups, 1 retrieved chunks).",
    citationCount: 0,
    citationCountReadabilityLabel: "no citations",
    citationCountReadabilitySentence: "Citation count summary: no citations.",
    citationCountBeforeLimit: 0,
    citationLimitHit: false,
    usedFallback: false
  });

  const listed = await service.listConversationTraces("conversation-1", { limit: 20 });
  assert.deepEqual(queryArgs, [
    {
      where: { conversationId: "conversation-1" },
      take: 20,
      select: {
        id: true,
        conversationId: true,
        assistantId: true,
        userMessageId: true,
        assistantMessageId: true,
        userQuery: true,
        rewrittenQuery: true,
        retrievedChunkIdsJson: true,
        retrievalMetadataJson: true,
        citationsJson: true,
        answeringMetadataJson: true,
        qualityEvaluationJson: true,
        modelName: true,
        latencyMs: true,
        status: true,
        errorMessage: true,
        createdAt: true
      },
      orderBy: {
        createdAt: "desc"
      }
    }
  ]);
  assert.equal(listed[0].traceSummary.failedStage, "answering");
  assert.equal(listed[0].traceSummary.failedStageReadabilityLabel, "answering stage failed");
  assert.equal(listed[0].traceSummary.failureMessage, "synthetic answer failure");
  assert.equal(
    listed[0].traceSummary.failureReadabilitySentence,
    "answering stage failed; message: synthetic answer failure."
  );
  assert.equal("retrievalMetadataJson" in listed[0], false);
  assert.equal("answeringMetadataJson" in listed[0], false);
  assert.equal("qualityEvaluationJson" in listed[0], false);
  assert.equal("retrievedChunkIdsJson" in listed[0], false);
  assert.deepEqual(listed[0].citationsJson, []);
});

test("TracesService drops invalid diagnostics failedStage values from traceSummary", async () => {
  const persistedTrace = {
    id: "trace-invalid-failed-stage",
    conversationId: "conversation-invalid-failed-stage",
    assistantId: "assistant-invalid-failed-stage",
    userMessageId: "user-message-invalid-failed-stage",
    assistantMessageId: null,
    userQuery: "why did this fail?",
    rewrittenQuery: null,
    retrievedChunkIdsJson: ["chunk-1"],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      execution: {
        actualMode: "vector",
        candidateLimit: 8,
        vectorCandidateCount: 1,
        lexicalCandidateCount: 0,
        mergedCandidateCount: 1,
        rankedCandidateCount: 1,
        vectorCandidateLimitHit: false,
        lexicalCandidateLimitHit: false,
        rankingTopKHit: true,
        retrievedChunkCount: 1
      },
      failure: {
        stage: "source_fetch",
        message: "synthetic failure"
      }
    },
    citationsJson: [],
    answeringMetadataJson: {
      answerTextSource: "provider_fallback",
      answerStatusSource: "legacy_inference"
    },
    qualityEvaluationJson: null,
    modelName: "fallback-rewrite-local",
    latencyMs: 42,
    status: "failed",
    errorMessage: "synthetic failure",
    createdAt: new Date("2026-03-27T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);

  const detail = await service.getTrace("trace-invalid-failed-stage");
  assert.equal(detail.traceSummary.failedStage, null);
  assert.equal(detail.traceSummary.failedStageReadabilityLabel, "unknown failed stage (source_fetch)");
  assert.equal(detail.traceSummary.answerTextSource, null);
  assert.equal(detail.traceSummary.answerStatusSource, null);
  assert.equal(detail.traceSummary.answerTextSourceReadabilityLabel, "unknown answer text source (provider_fallback)");
  assert.equal(
    detail.traceSummary.answerTextSourceReadabilitySentence,
    "Answer text source is unknown answer text source (provider_fallback)."
  );
  assert.equal(detail.traceSummary.answerStatusSourceReadabilityLabel, "unknown answer status source (legacy_inference)");
  assert.equal(detail.traceSummary.failureMessage, "synthetic failure");
  assert.equal(
    detail.traceSummary.failureReadabilitySentence,
    "unknown failed stage (source_fetch); message: synthetic failure."
  );

  const listed = await service.listConversationTraces("conversation-invalid-failed-stage", { limit: 1 });
  assert.equal(listed[0].traceSummary.failedStage, null);
  assert.equal(listed[0].traceSummary.failedStageReadabilityLabel, "unknown failed stage (source_fetch)");
  assert.equal(listed[0].traceSummary.answerTextSource, null);
  assert.equal(listed[0].traceSummary.answerStatusSource, null);
  assert.equal(listed[0].traceSummary.answerTextSourceReadabilityLabel, "unknown answer text source (provider_fallback)");
  assert.equal(
    listed[0].traceSummary.answerTextSourceReadabilitySentence,
    "Answer text source is unknown answer text source (provider_fallback)."
  );
  assert.equal(listed[0].traceSummary.answerStatusSourceReadabilityLabel, "unknown answer status source (legacy_inference)");
  assert.equal(listed[0].traceSummary.failureMessage, "synthetic failure");
  assert.equal(
    listed[0].traceSummary.failureReadabilitySentence,
    "unknown failed stage (source_fetch); message: synthetic failure."
  );
});

test("TracesService falls back promptContextCount from legacy context mode metadata", async () => {
  const persistedTrace = {
    id: "trace-legacy-context-groups",
    conversationId: "conversation-legacy-context-groups",
    assistantId: "assistant-legacy-context-groups",
    userMessageId: "user-message-legacy-context-groups",
    assistantMessageId: "assistant-message-legacy-context-groups",
    userQuery: "summarize grouped context",
    rewrittenQuery: null,
    retrievedChunkIdsJson: ["chunk-1", "chunk-2", "chunk-3"],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      execution: {
        actualMode: "hybrid",
        retrievedChunkCount: 3
      }
    },
    citationsJson: [],
    answeringMetadataJson: {
      contextMode: "context_groups",
      inputChunkCount: 3,
      contextGroupCount: 2
    },
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 8,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-26T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const trace = await service.getTrace("trace-legacy-context-groups");

  assert.equal(trace.traceSummary.inputChunkCount, 3);
  assert.equal(trace.traceSummary.contextGroupCount, 2);
  assert.equal(trace.traceSummary.promptContextCount, 2);
});

test("TracesService exposes additive execution provenance in traceSummary for successful traces", async () => {
  const persistedTrace = {
    id: "trace-2",
    conversationId: "conversation-2",
    assistantId: "assistant-2",
    userMessageId: "user-message-2",
    assistantMessageId: "assistant-message-2",
    userQuery: "summarize the source",
    rewrittenQuery: "summarize the source rewritten",
    retrievedChunkIdsJson: ["chunk-1", "chunk-2"],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      queryRewrite: {
        finalQuerySource: "rewritten"
      },
      execution: {
        actualMode: "hybrid",
        usedFallback: true,
        fallbackReason: "no_ranked_candidates",
        candidateLimit: 12,
        vectorCandidateCount: 4,
        lexicalCandidateCount: 2,
        mergedCandidateCount: 5,
        rankedCandidateCount: 0,
        vectorCandidateLimitHit: false,
        lexicalCandidateLimitHit: false,
        rankingTopKHit: false,
        primaryChunkCount: 1,
        neighborChunkCount: 1,
        retrievedChunkCount: 2
      }
    },
    citationsJson: [{ chunkId: "chunk-1" }],
    answeringMetadataJson: {
      promptId: "answer.v2",
      resolvedLanguage: "zh",
      generationMode: "generated",
      contextMode: "context_groups",
      citationAttribution: "heuristic",
      citationSelectionSource: "heuristic",
      missingInformationCount: 1,
      missingInformationSource: "model",
      insufficientContextReason: "retrieved_context_insufficient",
      answerTextSource: "deterministic_policy",
      answerStatusSource: "inferred_from_retrieval",
      answerStatus: "insufficient_context",
      inputChunkCount: 2,
      promptContextCount: 1,
      contextGroupCount: 1,
      citationCountBeforeLimit: 3,
      citationLimitHit: true,
      usedFallback: true
    },
    qualityEvaluationJson: {
      overall: "partial",
      primaryIssue: "fallback_generation"
    },
    modelName: "fallback-local",
    latencyMs: 17,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-25T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const trace = await service.getTrace("trace-2");

  assert.deepEqual(trace.traceSummary, {
    promptId: "answer.v2",
    answerStatus: "insufficient_context",
    qualityOverall: "partial",
    primaryIssue: "fallback_generation",
    retrievalMode: "hybrid",
    retrievalQuerySource: "rewritten",
    strategyReadabilityLabel: "hybrid retrieval via rewritten; fallback: no_ranked_candidates; fallback used: yes.",
    retrievalModeProvenanceSentence: "Resolved retrieval mode is hybrid; fallback was used due to no_ranked_candidates.",
    rewriteReadabilityLabel: "rewrite enabled; rewrite applied: yes; rewrite fallback: unknown; rewrite prompt: unknown.",
    strategySummary: {
      retrievalMode: "hybrid",
      strategyMode: "hybrid",
      retrievalQuerySource: "rewritten",
      rewriteEnabled: true,
      rewriteApplied: true,
      rewriteUsedFallback: null,
      rewritePromptId: null,
      rewriteModelName: null,
      fallbackReason: "no_ranked_candidates",
      usedFallback: true
    },
    generationMode: "generated",
    contextMode: "context_groups",
    rewriteApplied: true,
    fallbackReason: "no_ranked_candidates",
    resolvedLanguage: "zh",
    answerAttributionSummary: {
      attribution: "heuristic",
      source: "heuristic",
      readability: "heuristic:heuristic",
      attributionLabel: "heuristic attribution",
      sourceLabel: "heuristic evidence source",
      readabilityLabel: "heuristic attribution via heuristic evidence source",
      readabilityHint: "heuristic attribution via heuristic evidence source",
      readabilityResolvedLabel: "heuristic attribution via heuristic evidence source",
      readabilitySentence: "Answer attribution is heuristic; source evidence is heuristic."
    },
    answerAttributionReadabilitySentence: "Answer attribution is heuristic; source evidence is heuristic.",
    answerAttribution: "heuristic",
    answerAttributionSource: "heuristic",
    answerEvidenceSource: "heuristic",
    answerEvidenceSourceReadabilityLabel: "heuristic evidence source",
    answerEvidenceSourceReadabilitySentence: "Answer evidence source is heuristic evidence source.",
    citationAttribution: "heuristic",
    citationSelectionSource: "heuristic",
    missingInformationCount: 1,
    missingInformationCountReadabilityLabel: "1 missing-information item",
    missingInformationSource: "model",
    missingInformationSourceReadabilityLabel: "model-reported missing-information items",
    insufficientContextReason: "retrieved_context_insufficient",
    missingInformationProvenanceSentence: "Missing-information source is model; insufficient-context reason is retrieved_context_insufficient; missing-information count is 1.",
    answerTextSource: "deterministic_policy",
    answerTextSourceReadabilityLabel: "deterministic policy answer text",
    answerTextSourceReadabilitySentence: "Answer text source is deterministic policy answer text.",
    answerStatusSource: "inferred_from_retrieval",
    answerStatusSourceReadabilityLabel: "retrieval-inferred answer status",
    answerStatusSourceReadabilitySentence: "Answer status source is retrieval-inferred answer status.",
    answerProvenanceReadabilitySentence: "Answer text source is deterministic policy answer text; answer status source is retrieval-inferred answer status; Answer attribution is heuristic; source evidence is heuristic.",
    answerProvenanceSentence: "Answer text source is deterministic_policy; status source is inferred_from_retrieval; attribution summary is heuristic attribution via heuristic evidence source.",
    failedStage: null,
    failedStageReadabilityLabel: "unknown failed stage",
    failureMessage: null,
    failureReadabilitySentence: "unknown failed stage; message unavailable.",
    candidateLimit: 12,
    vectorCandidateCount: 4,
    lexicalCandidateCount: 2,
    mergedCandidateCount: 5,
    rankedCandidateCount: 0,
    candidateCountReadabilityLabel: "vector 4, lexical 2, merged 5, ranked 0 (candidate limit 12)",
    candidateCountReadabilitySentence: "Candidate flow produced 0 ranked candidates from 5 merged candidates (4 vector, 2 lexical) with candidate limit 12.",
    vectorCandidateLimitHit: false,
    lexicalCandidateLimitHit: false,
    rankingTopKHit: false,
    primaryChunkCount: 1,
    neighborChunkCount: 1,
    retrievedChunkCount: 2,
    inputChunkCount: 2,
    promptContextCount: 1,
    contextGroupCount: 1,
    contextReadabilitySentence: "Prompt context used 1 items via context_groups mode (2 input chunks, 1 context groups, 2 retrieved chunks).",
    citationCount: 1,
    citationCountReadabilityLabel: "1 citation shown (3 before limit)",
    citationCountReadabilitySentence: "Citation count summary: 1 citation shown (3 before limit).",
    citationCountBeforeLimit: 3,
    citationLimitHit: true,
    usedFallback: true
  });

  const listed = await service.listConversationTraces("conversation-2", { limit: 5 });
  assert.equal(listed.length, 1);
  assert.deepEqual(listed[0].traceSummary, trace.traceSummary);
  assert.equal("retrievalMetadataJson" in listed[0], false);
  assert.equal("answeringMetadataJson" in listed[0], false);
  assert.equal("qualityEvaluationJson" in listed[0], false);
  assert.equal("retrievedChunkIdsJson" in listed[0], false);
  assert.deepEqual(listed[0].citationsJson, [{ chunkId: "chunk-1" }]);
});

test("TracesService exposes attribution readability hint when source metadata is missing", async () => {
  const persistedTrace = {
    id: "trace-attribution-hint-fallback",
    conversationId: "conversation-attribution-hint-fallback",
    assistantId: "assistant-attribution-hint-fallback",
    userMessageId: "user-message-attribution-hint-fallback",
    assistantMessageId: "assistant-message-attribution-hint-fallback",
    userQuery: "summarize attribution",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      execution: {
        actualMode: "vector"
      }
    },
    citationsJson: [],
    answeringMetadataJson: {
      citationAttribution: "explicit"
    },
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-attribution-hint-fallback");

  assert.deepEqual(detail.traceSummary.answerAttributionSummary, {
    attribution: "explicit",
    source: null,
    readability: null,
    attributionLabel: "explicit attribution",
    sourceLabel: null,
    readabilityLabel: null,
    readabilityHint: "explicit attribution via unknown evidence source",
    readabilityResolvedLabel: "explicit attribution via unknown evidence source",
    readabilitySentence: "Answer attribution is explicit; source evidence is unknown."
  });
});

test("TracesService falls back strategy summary fields when execution/query-rewrite metadata is missing", async () => {
  const persistedTrace = {
    id: "trace-strategy-summary-fallback",
    conversationId: "conversation-strategy-summary-fallback",
    assistantId: "assistant-strategy-summary-fallback",
    userMessageId: "user-message-strategy-summary-fallback",
    assistantMessageId: null,
    userQuery: "summarize strategy",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      strategySummary: {
        retrievalMode: "lexical",
        strategyMode: "vector",
        retrievalQuerySource: "original_disabled",
        rewriteEnabled: true,
        rewriteApplied: true,
        rewriteUsedFallback: true,
        rewritePromptId: "rewrite-query.v1",
        rewriteModelName: "rewrite-model",
        fallbackReason: "vector_error",
        usedFallback: true
      },
      queryRewrite: {
        modelName: "rewrite-model",
        usedFallback: true
      },
      execution: {
        topK: 5
      }
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 6,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-strategy-summary-fallback");

  assert.equal(detail.traceSummary.retrievalMode, "lexical");
  assert.equal(detail.traceSummary.retrievalQuerySource, "original_disabled");
  assert.equal(detail.traceSummary.rewriteApplied, true);
  assert.equal(detail.traceSummary.fallbackReason, "vector_error");
  assert.equal(
    detail.traceSummary.rewriteReadabilityLabel,
    "rewrite enabled; rewrite applied: yes; rewrite fallback: yes; rewrite prompt: rewrite-query.v1."
  );

  assert.deepEqual(detail.traceSummary.strategySummary, {
    retrievalMode: "lexical",
    strategyMode: "vector",
    retrievalQuerySource: "original_disabled",
    rewriteEnabled: true,
    rewriteApplied: true,
    rewriteUsedFallback: true,
    rewritePromptId: "rewrite-query.v1",
    rewriteModelName: "rewrite-model",
    fallbackReason: "vector_error",
    usedFallback: true
  });
});

test("TracesService falls back rewriteApplied from queryRewrite metadata when rewrittenQuery is absent", async () => {
  const persistedTrace = {
    id: "trace-query-rewrite-applied-fallback",
    conversationId: "conversation-query-rewrite-applied-fallback",
    assistantId: "assistant-query-rewrite-applied-fallback",
    userMessageId: "user-message-query-rewrite-applied-fallback",
    assistantMessageId: null,
    userQuery: "summarize this",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      queryRewrite: {
        enabled: true,
        applied: true,
        finalQuerySource: "rewritten"
      },
      execution: {
        actualMode: "hybrid"
      }
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-query-rewrite-applied-fallback");

  assert.equal(detail.traceSummary.rewriteApplied, true);
  assert.equal(detail.traceSummary.strategySummary.rewriteApplied, true);
});

test("TracesService backfills rewriteApplied from queryRewrite.finalQuerySource when applied is missing", async () => {
  const persistedTrace = {
    id: "trace-rewrite-applied-from-query-source",
    conversationId: "conversation-rewrite-applied-from-query-source",
    assistantId: "assistant-rewrite-applied-from-query-source",
    userMessageId: "user-message-rewrite-applied-from-query-source",
    assistantMessageId: null,
    userQuery: "summarize this",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      queryRewrite: {
        enabled: true,
        finalQuerySource: "rewritten"
      },
      execution: {
        actualMode: "hybrid"
      }
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-rewrite-applied-from-query-source");

  assert.equal(detail.traceSummary.retrievalQuerySource, "rewritten");
  assert.equal(detail.traceSummary.rewriteApplied, true);
  assert.equal(detail.traceSummary.strategySummary.rewriteApplied, true);
});

test("TracesService backfills retrievalQuerySource from rewrittenQuery when legacy queryRewrite source is missing", async () => {
  const persistedTrace = {
    id: "trace-query-source-rewritten-backfill",
    conversationId: "conversation-query-source-rewritten-backfill",
    assistantId: "assistant-query-source-rewritten-backfill",
    userMessageId: "user-message-query-source-rewritten-backfill",
    assistantMessageId: null,
    userQuery: "summarize this",
    rewrittenQuery: "summarize this rewritten",
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      queryRewrite: {
        enabled: true,
        applied: true
      },
      execution: {
        actualMode: "hybrid"
      }
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-query-source-rewritten-backfill");

  assert.equal(detail.traceSummary.retrievalQuerySource, "rewritten");
  assert.equal(detail.traceSummary.strategySummary.retrievalQuerySource, "rewritten");
});

test("TracesService backfills rewriteEnabled when legacy queryRewrite only persisted applied=true", async () => {
  const persistedTrace = {
    id: "trace-rewrite-enabled-backfill",
    conversationId: "conversation-rewrite-enabled-backfill",
    assistantId: "assistant-rewrite-enabled-backfill",
    userMessageId: "user-message-rewrite-enabled-backfill",
    assistantMessageId: null,
    userQuery: "summarize this",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      queryRewrite: {
        applied: true
      },
      execution: {
        actualMode: "hybrid"
      }
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-rewrite-enabled-backfill");

  assert.equal(detail.traceSummary.rewriteApplied, true);
  assert.equal(detail.traceSummary.strategySummary.rewriteApplied, true);
  assert.equal(detail.traceSummary.strategySummary.rewriteEnabled, true);
});

test("TracesService backfills strategySummary.usedFallback from fallbackReason when legacy usedFallback is missing", async () => {
  const persistedTrace = {
    id: "trace-strategy-used-fallback-backfill",
    conversationId: "conversation-strategy-used-fallback-backfill",
    assistantId: "assistant-strategy-used-fallback-backfill",
    userMessageId: "user-message-strategy-used-fallback-backfill",
    assistantMessageId: null,
    userQuery: "summarize retrieval fallback",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      strategySummary: {
        retrievalMode: "lexical",
        strategyMode: "vector",
        retrievalQuerySource: "original_unchanged",
        rewriteEnabled: true,
        rewriteApplied: false,
        rewriteUsedFallback: null,
        rewritePromptId: null,
        rewriteModelName: null,
        fallbackReason: "vector_error"
      }
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-strategy-used-fallback-backfill");

  assert.equal(detail.traceSummary.fallbackReason, "vector_error");
  assert.equal(detail.traceSummary.strategySummary.fallbackReason, "vector_error");
  assert.equal(detail.traceSummary.strategySummary.usedFallback, true);
});

test("TracesService backfills fallbackReason from legacy retrievalMetadata fallbackReason", async () => {
  const persistedTrace = {
    id: "trace-legacy-fallback-reason",
    conversationId: "conversation-legacy-fallback-reason",
    assistantId: "assistant-legacy-fallback-reason",
    userMessageId: "user-message-legacy-fallback-reason",
    assistantMessageId: null,
    userQuery: "summarize fallback reason",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      fallbackReason: "vector_error"
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-legacy-fallback-reason");

  assert.equal(detail.traceSummary.fallbackReason, "vector_error");
  assert.equal(detail.traceSummary.strategySummary.fallbackReason, "vector_error");
  assert.equal(detail.traceSummary.strategySummary.usedFallback, true);
});

test("TracesService backfills strategySummary.usedFallback from legacy top-level retrievalMetadata.usedFallback", async () => {
  const persistedTrace = {
    id: "trace-legacy-used-fallback",
    conversationId: "conversation-legacy-used-fallback",
    assistantId: "assistant-legacy-used-fallback",
    userMessageId: "user-message-legacy-used-fallback",
    assistantMessageId: null,
    userQuery: "summarize fallback usage",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      usedFallback: true
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-legacy-used-fallback");

  assert.equal(detail.traceSummary.fallbackReason, null);
  assert.equal(detail.traceSummary.strategySummary.usedFallback, true);
  assert.equal(
    detail.traceSummary.retrievalModeProvenanceSentence,
    "Resolved retrieval mode is unknown; fallback was used (reason unspecified)."
  );
  assert.equal(
    detail.traceSummary.strategyReadabilityLabel,
    "unknown mode retrieval via original_disabled; fallback: unspecified; fallback used: yes."
  );
});

test("TracesService backfills strategy summary from legacy top-level fallback clues only", async () => {
  const persistedTrace = {
    id: "trace-legacy-top-level-fallback-clues-only",
    conversationId: "conversation-legacy-top-level-fallback-clues-only",
    assistantId: "assistant-legacy-top-level-fallback-clues-only",
    userMessageId: "user-message-legacy-top-level-fallback-clues-only",
    assistantMessageId: null,
    userQuery: "summarize legacy fallback clues",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      fallbackReason: "vector_error",
      usedFallback: true
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-legacy-top-level-fallback-clues-only");

  assert.equal(detail.traceSummary.fallbackReason, "vector_error");
  assert.equal(detail.traceSummary.strategySummary.fallbackReason, "vector_error");
  assert.equal(detail.traceSummary.strategySummary.usedFallback, true);
  assert.equal(
    detail.traceSummary.strategyReadabilityLabel,
    "unknown mode retrieval via original_disabled; fallback: vector_error; fallback used: yes."
  );
});

test("TracesService keeps legacy fallback traces readable when optional provenance fields are missing", async () => {
  const persistedTrace = {
    id: "trace-legacy-fallback-missing-readable-fields",
    conversationId: "conversation-legacy-fallback-missing-readable-fields",
    assistantId: "assistant-legacy-fallback-missing-readable-fields",
    userMessageId: "user-message-legacy-fallback-missing-readable-fields",
    assistantMessageId: null,
    userQuery: "summarize readable fallback",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      fallbackReason: "vector_error"
    },
    citationsJson: [],
    answeringMetadataJson: {
      missingInformationCount: 1
    },
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-legacy-fallback-missing-readable-fields");

  assert.equal(detail.traceSummary.fallbackReason, "vector_error");
  assert.equal(detail.traceSummary.strategySummary.usedFallback, true);
  assert.equal(
    detail.traceSummary.answerProvenanceSentence,
    "Answer text source is unknown; status source is unknown; attribution summary is unknown attribution via unknown evidence source."
  );
  assert.equal(
    detail.traceSummary.missingInformationProvenanceSentence,
    "Missing-information source is unknown; insufficient-context reason is none; missing-information count is 1."
  );
  assert.equal(detail.traceSummary.answerTextSourceReadabilityLabel, "unknown answer text source");
  assert.equal(detail.traceSummary.answerTextSourceReadabilitySentence, "Answer text source is unknown answer text source.");
  assert.equal(detail.traceSummary.answerStatusSourceReadabilityLabel, "unknown answer status source");
  assert.equal(
    detail.traceSummary.answerProvenanceReadabilitySentence,
    "Answer text source is unknown answer text source; answer status source is unknown answer status source; Answer attribution is unknown; source evidence is unknown."
  );
});

test("TracesService backfills strategySummary.usedFallback from legacy execution fallbackReason when usedFallback is missing", async () => {
  const persistedTrace = {
    id: "trace-execution-fallback-reason-used-fallback-backfill",
    conversationId: "conversation-execution-fallback-reason-used-fallback-backfill",
    assistantId: "assistant-execution-fallback-reason-used-fallback-backfill",
    userMessageId: "user-message-execution-fallback-reason-used-fallback-backfill",
    assistantMessageId: null,
    userQuery: "summarize fallback usage from execution fallback reason",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      execution: {
        actualMode: "lexical",
        fallbackReason: "vector_error"
      }
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-execution-fallback-reason-used-fallback-backfill");

  assert.equal(detail.traceSummary.fallbackReason, "vector_error");
  assert.equal(detail.traceSummary.strategySummary.fallbackReason, "vector_error");
  assert.equal(detail.traceSummary.strategySummary.usedFallback, true);
  assert.equal(
    detail.traceSummary.strategyReadabilityLabel,
    "lexical retrieval via original_disabled; fallback: vector_error; fallback used: yes."
  );
});

test("TracesService backfills strategyMode from legacy retrievalMode when strategyMode is missing", async () => {
  const persistedTrace = {
    id: "trace-strategy-mode-backfill",
    conversationId: "conversation-strategy-mode-backfill",
    assistantId: "assistant-strategy-mode-backfill",
    userMessageId: "user-message-strategy-mode-backfill",
    assistantMessageId: null,
    userQuery: "summarize strategy mode",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      strategySummary: {
        retrievalMode: "hybrid",
        retrievalQuerySource: "original_unchanged",
        rewriteEnabled: true,
        rewriteApplied: false,
        rewriteUsedFallback: null,
        rewritePromptId: null,
        rewriteModelName: null,
        fallbackReason: null,
        usedFallback: false
      }
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-strategy-mode-backfill");

  assert.equal(detail.traceSummary.retrievalMode, "hybrid");
  assert.equal(detail.traceSummary.strategySummary.strategyMode, "hybrid");
});

test("TracesService backfills retrievalMode from legacy top-level retrievalMetadata.retrievalMode", async () => {
  const persistedTrace = {
    id: "trace-retrieval-mode-top-level-backfill",
    conversationId: "conversation-retrieval-mode-top-level-backfill",
    assistantId: "assistant-retrieval-mode-top-level-backfill",
    userMessageId: "user-message-retrieval-mode-top-level-backfill",
    assistantMessageId: null,
    userQuery: "summarize retrieval mode",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      retrievalMode: "lexical"
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-retrieval-mode-top-level-backfill");

  assert.equal(detail.traceSummary.retrievalMode, "lexical");
  assert.equal(detail.traceSummary.strategySummary.retrievalMode, "lexical");
  assert.equal(detail.traceSummary.strategySummary.strategyMode, "lexical");
});

test("TracesService backfills retrievalQuerySource from legacy top-level retrievalMetadata.retrievalQuerySource", async () => {
  const persistedTrace = {
    id: "trace-retrieval-query-source-top-level-backfill",
    conversationId: "conversation-retrieval-query-source-top-level-backfill",
    assistantId: "assistant-retrieval-query-source-top-level-backfill",
    userMessageId: "user-message-retrieval-query-source-top-level-backfill",
    assistantMessageId: null,
    userQuery: "summarize retrieval query source",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      retrievalQuerySource: "rewritten"
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-retrieval-query-source-top-level-backfill");

  assert.equal(detail.traceSummary.retrievalQuerySource, "rewritten");
  assert.equal(detail.traceSummary.strategySummary.retrievalQuerySource, "rewritten");
  assert.equal(detail.traceSummary.rewriteApplied, true);
  assert.equal(detail.traceSummary.strategySummary.rewriteApplied, true);
  assert.equal(detail.traceSummary.strategySummary.rewriteEnabled, true);
});

test("TracesService backfills rewriteApplied from strategySummary.retrievalQuerySource when legacy rewriteApplied is missing", async () => {
  const persistedTrace = {
    id: "trace-rewrite-applied-from-strategy-query-source",
    conversationId: "conversation-rewrite-applied-from-strategy-query-source",
    assistantId: "assistant-rewrite-applied-from-strategy-query-source",
    userMessageId: "user-message-rewrite-applied-from-strategy-query-source",
    assistantMessageId: null,
    userQuery: "summarize retrieval query source",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      strategySummary: {
        retrievalMode: "hybrid",
        strategyMode: "hybrid",
        retrievalQuerySource: "rewritten",
        rewriteEnabled: true,
        rewriteUsedFallback: null,
        rewritePromptId: null,
        rewriteModelName: null,
        fallbackReason: null,
        usedFallback: false
      }
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-rewrite-applied-from-strategy-query-source");

  assert.equal(detail.traceSummary.retrievalQuerySource, "rewritten");
  assert.equal(detail.traceSummary.rewriteApplied, true);
  assert.equal(detail.traceSummary.strategySummary.rewriteApplied, true);
});

test("TracesService backfills rewriteUsedFallback from legacy top-level retrievalMetadata.rewriteUsedFallback", async () => {
  const persistedTrace = {
    id: "trace-rewrite-used-fallback-top-level-backfill",
    conversationId: "conversation-rewrite-used-fallback-top-level-backfill",
    assistantId: "assistant-rewrite-used-fallback-top-level-backfill",
    userMessageId: "user-message-rewrite-used-fallback-top-level-backfill",
    assistantMessageId: null,
    userQuery: "summarize rewrite fallback provenance",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      rewriteUsedFallback: true
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-rewrite-used-fallback-top-level-backfill");

  assert.equal(detail.traceSummary.strategySummary.rewriteUsedFallback, true);
});

test("TracesService backfills rewrite prompt/model provenance from legacy top-level retrievalMetadata fields", async () => {
  const persistedTrace = {
    id: "trace-rewrite-provenance-top-level-backfill",
    conversationId: "conversation-rewrite-provenance-top-level-backfill",
    assistantId: "assistant-rewrite-provenance-top-level-backfill",
    userMessageId: "user-message-rewrite-provenance-top-level-backfill",
    assistantMessageId: null,
    userQuery: "summarize rewrite provenance",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      rewritePromptId: "rewrite-query.v1",
      rewriteModelName: "fallback-rewrite-local"
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-rewrite-provenance-top-level-backfill");

  assert.equal(detail.traceSummary.strategySummary.rewritePromptId, "rewrite-query.v1");
  assert.equal(detail.traceSummary.strategySummary.rewriteModelName, "fallback-rewrite-local");
});

test("TracesService backfills rewriteEnabled from legacy top-level retrievalMetadata.rewriteEnabled", async () => {
  const persistedTrace = {
    id: "trace-rewrite-enabled-top-level-backfill",
    conversationId: "conversation-rewrite-enabled-top-level-backfill",
    assistantId: "assistant-rewrite-enabled-top-level-backfill",
    userMessageId: "user-message-rewrite-enabled-top-level-backfill",
    assistantMessageId: null,
    userQuery: "summarize rewrite enablement",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      rewriteEnabled: true
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-rewrite-enabled-top-level-backfill");

  assert.equal(detail.traceSummary.strategySummary.rewriteEnabled, true);
});

test("TracesService backfills retrievalQuerySource from rewrite enabled metadata when legacy finalQuerySource is missing", async () => {
  const persistedTrace = {
    id: "trace-query-source-from-rewrite-enabled",
    conversationId: "conversation-query-source-from-rewrite-enabled",
    assistantId: "assistant-query-source-from-rewrite-enabled",
    userMessageId: "user-message-query-source-from-rewrite-enabled",
    assistantMessageId: null,
    userQuery: "summarize this",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      queryRewrite: {
        enabled: true,
        applied: false
      }
    },
    citationsJson: [],
    answeringMetadataJson: null,
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-query-source-from-rewrite-enabled");

  assert.equal(detail.traceSummary.retrievalQuerySource, "original_unchanged");
  assert.equal(detail.traceSummary.strategySummary.retrievalQuerySource, "original_unchanged");
  assert.equal(detail.traceSummary.rewriteApplied, false);
  assert.equal(detail.traceSummary.strategySummary.rewriteEnabled, true);
});

test("TracesService keeps answerProvenanceSentence legacy fallback wording when attribution source metadata is missing", async () => {
  const persistedTrace = {
    id: "trace-answer-provenance-legacy-fallback",
    conversationId: "conversation-answer-provenance-legacy-fallback",
    assistantId: "assistant-answer-provenance-legacy-fallback",
    userMessageId: "user-message-answer-provenance-legacy-fallback",
    assistantMessageId: null,
    userQuery: "summarize answer provenance",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      execution: {
        actualMode: "vector"
      }
    },
    citationsJson: [],
    answeringMetadataJson: {
      citationAttribution: "explicit"
    },
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-answer-provenance-legacy-fallback");

  assert.equal(
    detail.traceSummary.answerProvenanceSentence,
    "Answer text source is unknown; status source is unknown; attribution summary is explicit attribution via unknown evidence source."
  );
});

test("TracesService keeps missingInformationProvenanceSentence legacy fallback wording when source metadata is missing", async () => {
  const persistedTrace = {
    id: "trace-missing-information-provenance-legacy-fallback",
    conversationId: "conversation-missing-information-provenance-legacy-fallback",
    assistantId: "assistant-missing-information-provenance-legacy-fallback",
    userMessageId: "user-message-missing-information-provenance-legacy-fallback",
    assistantMessageId: null,
    userQuery: "summarize missing-information provenance",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      execution: {
        actualMode: "vector"
      }
    },
    citationsJson: [],
    answeringMetadataJson: {
      insufficientContextReason: "retrieved_context_insufficient",
      missingInformationCount: 2
    },
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-missing-information-provenance-legacy-fallback");

  assert.equal(
    detail.traceSummary.missingInformationProvenanceSentence,
    "Missing-information source is unknown; insufficient-context reason is retrieved_context_insufficient; missing-information count is 2."
  );
  assert.equal(detail.traceSummary.missingInformationSourceReadabilityLabel, "unknown missing-information source");
});

test("TracesService keeps raw missingInformationSource value in readability label for unknown legacy source", async () => {
  const persistedTrace = {
    id: "trace-missing-information-source-raw-value",
    conversationId: "conversation-missing-information-source-raw-value",
    assistantId: "assistant-missing-information-source-raw-value",
    userMessageId: "user-message-missing-information-source-raw-value",
    assistantMessageId: null,
    userQuery: "show missing-information source readability",
    rewrittenQuery: null,
    retrievedChunkIdsJson: [],
    retrievalScoresJson: [],
    retrievalMetadataJson: {
      execution: {
        actualMode: "vector"
      }
    },
    citationsJson: [],
    answeringMetadataJson: {
      missingInformationSource: "legacy_unknown_source"
    },
    qualityEvaluationJson: null,
    modelName: "fallback-local",
    latencyMs: 5,
    status: "success",
    errorMessage: null,
    createdAt: new Date("2026-03-28T00:00:00.000Z")
  };

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);
  const detail = await service.getTrace("trace-missing-information-source-raw-value");

  assert.equal(
    detail.traceSummary.missingInformationSourceReadabilityLabel,
    "unknown missing-information source (legacy_unknown_source)"
  );
});
