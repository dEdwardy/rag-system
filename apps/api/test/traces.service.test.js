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

  const prisma = {
    answerTrace: {
      findUnique: async () => persistedTrace,
      findMany: async () => [persistedTrace]
    }
  };

  const service = new TracesService(prisma);

  const trace = await service.getTrace("trace-1");
  assert.deepEqual(trace.traceSummary, {
    answerStatus: null,
    qualityOverall: null,
    primaryIssue: null,
    retrievalMode: "vector",
    generationMode: null,
    rewriteApplied: false,
    fallbackReason: null,
    citationAttribution: null,
    missingInformationCount: 0,
    insufficientContextReason: null,
    failedStage: "answering",
    failureMessage: "synthetic answer failure",
    retrievedChunkCount: 1,
    citationCount: 0,
    usedFallback: false
  });

  const listed = await service.listConversationTraces("conversation-1");
  assert.equal(listed[0].traceSummary.failedStage, "answering");
  assert.equal(listed[0].traceSummary.failureMessage, "synthetic answer failure");
});
