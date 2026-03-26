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
    answerStatus: null,
    qualityOverall: null,
    primaryIssue: null,
    retrievalMode: "vector",
    retrievalQuerySource: null,
    generationMode: null,
    contextMode: null,
    rewriteApplied: false,
    fallbackReason: null,
    resolvedLanguage: null,
    citationAttribution: null,
    citationSelectionSource: null,
    missingInformationCount: 0,
    missingInformationSource: null,
    insufficientContextReason: null,
    answerTextSource: null,
    answerStatusSource: null,
    failedStage: "answering",
    failureMessage: "synthetic answer failure",
    candidateLimit: 8,
    vectorCandidateCount: 1,
    lexicalCandidateCount: 0,
    mergedCandidateCount: 1,
    rankedCandidateCount: 1,
    vectorCandidateLimitHit: false,
    lexicalCandidateLimitHit: false,
    rankingTopKHit: true,
    retrievedChunkCount: 1,
    citationCount: 0,
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
  assert.equal(listed[0].traceSummary.failureMessage, "synthetic answer failure");
  assert.equal("retrievalMetadataJson" in listed[0], false);
  assert.equal("answeringMetadataJson" in listed[0], false);
  assert.equal("qualityEvaluationJson" in listed[0], false);
  assert.equal("retrievedChunkIdsJson" in listed[0], false);
  assert.deepEqual(listed[0].citationsJson, []);
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
        fallbackReason: "no_ranked_candidates",
        candidateLimit: 12,
        vectorCandidateCount: 4,
        lexicalCandidateCount: 2,
        mergedCandidateCount: 5,
        rankedCandidateCount: 0,
        vectorCandidateLimitHit: false,
        lexicalCandidateLimitHit: false,
        rankingTopKHit: false,
        retrievedChunkCount: 2
      }
    },
    citationsJson: [{ chunkId: "chunk-1" }],
    answeringMetadataJson: {
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
    answerStatus: "insufficient_context",
    qualityOverall: "partial",
    primaryIssue: "fallback_generation",
    retrievalMode: "hybrid",
    retrievalQuerySource: "rewritten",
    generationMode: "generated",
    contextMode: "context_groups",
    rewriteApplied: true,
    fallbackReason: "no_ranked_candidates",
    resolvedLanguage: "zh",
    citationAttribution: "heuristic",
    citationSelectionSource: "heuristic",
    missingInformationCount: 1,
    missingInformationSource: "model",
    insufficientContextReason: "retrieved_context_insufficient",
    answerTextSource: "deterministic_policy",
    answerStatusSource: "inferred_from_retrieval",
    failedStage: null,
    failureMessage: null,
    candidateLimit: 12,
    vectorCandidateCount: 4,
    lexicalCandidateCount: 2,
    mergedCandidateCount: 5,
    rankedCandidateCount: 0,
    vectorCandidateLimitHit: false,
    lexicalCandidateLimitHit: false,
    rankingTopKHit: false,
    retrievedChunkCount: 2,
    citationCount: 1,
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
