const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { existsSync, mkdirSync, rmSync } = require("node:fs");
const { resolve } = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { seedDefaultRecords } = require("./support/seed-default-records.js");

const repoRoot = resolve(__dirname, "../../..");
const apiRoot = resolve(repoRoot, "apps/api");
const apiDistEntry = resolveBuiltApiEntry();
const prisma = new PrismaClient();

test.before(() => {
  seedDefaultRecords(apiRoot);
});

test("API flow integration: upload -> ready -> ask -> trace", async () => {
  await resetTestState();

  const port = 3101;
  const storageRoot = resolve(repoRoot, "storage", `test-e2e-${randomUUID()}`);
  const queuePrefix = `test-e2e-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const server = spawn(process.execPath, [apiDistEntry], {
    cwd: repoRoot,
    env: {
      ...process.env,
      API_PORT: String(port),
      STORAGE_ROOT: storageRoot,
      QUEUE_PREFIX: queuePrefix
    },
    stdio: "ignore"
  });

  try {
    await waitForHealth(port, 20000);

    const marker = `integration-marker-${randomUUID()}`;
    const formData = new FormData();
    formData.set(
      "file",
      new Blob(
        [
          `# Integration Test\n\n## Facts\n\nVectors for the first implementation are stored under storage/vectors. Document ingestion is processed through Redis-backed background jobs. ${marker}`
        ],
        { type: "text/markdown" }
      ),
      "integration-test.md"
    );

    const uploadResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/upload`, {
      method: "POST",
      body: formData
    });
    assert.equal(uploadResponse.status, 201);

    const uploadedDocument = await uploadResponse.json();
    const document = await waitForDocumentReady(port, uploadedDocument.id, 20000);
    assert.equal(document.status, "ready");

    const documentChunksResponse = await fetch(`http://localhost:${port}/documents/${uploadedDocument.id}/chunks`);
    assert.equal(documentChunksResponse.status, 200);

    const documentChunks = await documentChunksResponse.json();
    assert.ok(Array.isArray(documentChunks));
    assert.ok(documentChunks.length >= 1);
    assert.ok(documentChunks.some(chunk => chunk.content.includes(marker)));

    const askResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: `Where are vectors stored and what processes ingestion? Include marker ${marker}`
      })
    });
    assert.equal(askResponse.status, 201);

    const askResult = await askResponse.json();
    assert.equal(typeof askResult.conversationId, "string");
    assert.equal(typeof askResult.traceId, "string");
    assert.match(askResult.answer, /storage\/vectors/i);
    assert.ok(Array.isArray(askResult.citations));
    assert.ok(askResult.citations.length >= 1);
    assert.ok(Array.isArray(askResult.retrievedChunks));
    assert.ok(askResult.retrievedChunks.some(chunk => chunk.content.includes(marker)));
    assert.ok(Array.isArray(askResult.contextGroups));
    assert.ok(askResult.contextGroups.length >= 1);
    assert.ok(askResult.contextGroups.some(group => group.mergedContent.includes(marker)));
    assert.equal(
      askResult.answerStatus === "grounded" || askResult.answerStatus === "insufficient_context",
      true
    );
    assert.ok(Array.isArray(askResult.missingInformation));
    assert.equal(typeof askResult.qualityEvaluation?.overall, "string");
    assert.equal(typeof askResult.qualityEvaluation?.grounding, "string");
    assert.equal(typeof askResult.qualityEvaluation?.completeness, "string");
    assert.ok(Array.isArray(askResult.qualityEvaluation?.flags));
    assert.equal(typeof askResult.qualityEvaluation?.summary, "string");
    assert.equal(typeof askResult.retrievalMetadata?.queryRewrite?.enabled, "boolean");
    assert.equal(typeof askResult.retrievalMetadata?.embedding?.active?.modelName, "string");
    assert.equal(typeof askResult.retrievalMetadata?.embedding?.active?.dimensions, "number");
    assert.equal(typeof askResult.retrievalMetadata?.embedding?.active?.fallbackState, "string");
    assert.equal(typeof askResult.retrievalMetadata?.execution?.retrievedChunkCount, "number");
    assert.equal(typeof askResult.answeringMetadata?.promptId, "string");
    assert.equal(typeof askResult.answeringMetadata?.contextMode, "string");

    const conversationMessagesResponse = await fetch(
      `http://localhost:${port}/conversations/${askResult.conversationId}/messages`
    );
    assert.equal(conversationMessagesResponse.status, 200);

    const conversationMessages = await conversationMessagesResponse.json();
    assert.ok(Array.isArray(conversationMessages));
    assert.equal(conversationMessages.length, 2);
    assert.deepEqual(
      conversationMessages.map(message => ({
        role: message.role,
        traceId: message.traceId
      })),
      [
        {
          role: "user",
          traceId: askResult.traceId
        },
        {
          role: "assistant",
          traceId: askResult.traceId
        }
      ]
    );

    const conversationTracesResponse = await fetch(`http://localhost:${port}/conversations/${askResult.conversationId}/traces`);
    assert.equal(conversationTracesResponse.status, 200);

    const conversationTraces = await conversationTracesResponse.json();
    assert.ok(Array.isArray(conversationTraces));
    assert.ok(conversationTraces.some(trace => trace.id === askResult.traceId));
    const listedTrace = conversationTraces.find(trace => trace.id === askResult.traceId);
    assert.equal(typeof listedTrace?.traceSummary?.answerStatus, "string");
    assert.equal(
      listedTrace?.traceSummary?.promptId === null || typeof listedTrace?.traceSummary?.promptId === "string",
      true
    );
    assert.equal(typeof listedTrace?.traceSummary?.qualityOverall, "string");
    assert.equal(typeof listedTrace?.traceSummary?.primaryIssue, "string");
    assert.equal(typeof listedTrace?.traceSummary?.retrievalMode, "string");
    assert.equal(
      listedTrace?.traceSummary?.retrievalQuerySource === null ||
        typeof listedTrace?.traceSummary?.retrievalQuerySource === "string",
      true
    );
    assert.equal(typeof listedTrace?.traceSummary?.generationMode, "string");
    assert.equal(
      listedTrace?.traceSummary?.contextMode === null || typeof listedTrace?.traceSummary?.contextMode === "string",
      true
    );
    assert.equal(typeof listedTrace?.traceSummary?.rewriteApplied, "boolean");
    assert.equal(
      listedTrace?.traceSummary?.fallbackReason === null || typeof listedTrace?.traceSummary?.fallbackReason === "string",
      true
    );
    assert.equal(
      listedTrace?.traceSummary?.resolvedLanguage === null ||
        typeof listedTrace?.traceSummary?.resolvedLanguage === "string",
      true
    );
    assert.equal(typeof listedTrace?.traceSummary?.citationAttribution, "string");
    assert.equal(
      listedTrace?.traceSummary?.citationSelectionSource === null ||
        typeof listedTrace?.traceSummary?.citationSelectionSource === "string",
      true
    );
    assert.equal(typeof listedTrace?.traceSummary?.missingInformationCount, "number");
    assert.equal(
      listedTrace?.traceSummary?.missingInformationSource === null ||
        typeof listedTrace?.traceSummary?.missingInformationSource === "string",
      true
    );
    assert.equal(
      listedTrace?.traceSummary?.insufficientContextReason === null ||
        typeof listedTrace?.traceSummary?.insufficientContextReason === "string",
      true
    );
    assert.equal(
      listedTrace?.traceSummary?.answerTextSource === null ||
        typeof listedTrace?.traceSummary?.answerTextSource === "string",
      true
    );
    assert.equal(
      listedTrace?.traceSummary?.answerStatusSource === null ||
        typeof listedTrace?.traceSummary?.answerStatusSource === "string",
      true
    );
    assert.equal(typeof listedTrace?.traceSummary?.candidateLimit, "number");
    assert.equal(typeof listedTrace?.traceSummary?.vectorCandidateCount, "number");
    assert.equal(typeof listedTrace?.traceSummary?.lexicalCandidateCount, "number");
    assert.equal(typeof listedTrace?.traceSummary?.mergedCandidateCount, "number");
    assert.equal(typeof listedTrace?.traceSummary?.rankedCandidateCount, "number");
    assert.equal(typeof listedTrace?.traceSummary?.vectorCandidateLimitHit, "boolean");
    assert.equal(typeof listedTrace?.traceSummary?.lexicalCandidateLimitHit, "boolean");
    assert.equal(typeof listedTrace?.traceSummary?.rankingTopKHit, "boolean");
    assert.equal(typeof listedTrace?.traceSummary?.primaryChunkCount, "number");
    assert.equal(typeof listedTrace?.traceSummary?.neighborChunkCount, "number");
    assert.equal(typeof listedTrace?.traceSummary?.retrievedChunkCount, "number");
    assert.equal(typeof listedTrace?.traceSummary?.inputChunkCount, "number");
    assert.equal(typeof listedTrace?.traceSummary?.promptContextCount, "number");
    assert.equal(typeof listedTrace?.traceSummary?.contextGroupCount, "number");
    assert.equal(typeof listedTrace?.traceSummary?.citationCount, "number");
    assert.equal(typeof listedTrace?.traceSummary?.citationCountBeforeLimit, "number");
    assert.equal(typeof listedTrace?.traceSummary?.citationLimitHit, "boolean");
    assert.equal(typeof listedTrace?.traceSummary?.usedFallback, "boolean");

    const traceResponse = await fetch(`http://localhost:${port}/traces/${askResult.traceId}`);
    assert.equal(traceResponse.status, 200);

    const trace = await traceResponse.json();
    assert.equal(trace.status, "success");
    assert.ok(Array.isArray(trace.retrievedChunkIdsJson));
    assert.ok(Array.isArray(trace.citationsJson));
    assert.equal(typeof trace.qualityEvaluationJson?.overall, "string");
    assert.equal(typeof trace.qualityEvaluationJson?.summary, "string");
    assert.equal(typeof trace.rewrittenQuery === "string" || trace.rewrittenQuery === null, true);
    assert.ok(Array.isArray(trace.retrievalScoresJson));
    assert.equal(typeof trace.retrievalMetadataJson?.queryRewrite?.enabled, "boolean");
    assert.equal(typeof trace.retrievalMetadataJson?.embedding?.active?.modelName, "string");
    assert.equal(typeof trace.retrievalMetadataJson?.embedding?.active?.dimensions, "number");
    assert.equal(typeof trace.retrievalMetadataJson?.embedding?.active?.fallbackState, "string");
    assert.equal(typeof trace.retrievalMetadataJson?.execution?.retrievedChunkCount, "number");
    assert.equal(typeof trace.answeringMetadataJson?.promptId, "string");
    assert.equal(typeof trace.answeringMetadataJson?.answerStatus, "string");
    assert.deepEqual(trace.traceSummary, {
      promptId: trace.answeringMetadataJson.promptId,
      answerStatus: trace.answeringMetadataJson.answerStatus,
      qualityOverall: trace.qualityEvaluationJson.overall,
      primaryIssue: trace.qualityEvaluationJson.primaryIssue,
      retrievalMode: trace.retrievalMetadataJson.execution.actualMode,
      retrievalQuerySource: trace.retrievalMetadataJson.queryRewrite.finalQuerySource,
      generationMode: trace.answeringMetadataJson.generationMode,
      contextMode: trace.answeringMetadataJson.contextMode,
      rewriteApplied: trace.rewrittenQuery !== null,
      fallbackReason: trace.retrievalMetadataJson.execution.fallbackReason,
      resolvedLanguage: trace.answeringMetadataJson.resolvedLanguage,
      citationAttribution: trace.answeringMetadataJson.citationAttribution,
      citationSelectionSource: trace.answeringMetadataJson.citationSelectionSource,
      missingInformationCount: trace.answeringMetadataJson.missingInformationCount,
      missingInformationSource: trace.answeringMetadataJson.missingInformationSource,
      insufficientContextReason: trace.answeringMetadataJson.insufficientContextReason,
      answerTextSource: trace.answeringMetadataJson.answerTextSource,
      answerStatusSource: trace.answeringMetadataJson.answerStatusSource,
      failedStage: null,
      failureMessage: null,
      candidateLimit: trace.retrievalMetadataJson.execution.candidateLimit,
      vectorCandidateCount: trace.retrievalMetadataJson.execution.vectorCandidateCount,
      lexicalCandidateCount: trace.retrievalMetadataJson.execution.lexicalCandidateCount,
      mergedCandidateCount: trace.retrievalMetadataJson.execution.mergedCandidateCount,
      rankedCandidateCount: trace.retrievalMetadataJson.execution.rankedCandidateCount,
      vectorCandidateLimitHit: trace.retrievalMetadataJson.execution.vectorCandidateLimitHit,
      lexicalCandidateLimitHit: trace.retrievalMetadataJson.execution.lexicalCandidateLimitHit,
      rankingTopKHit: trace.retrievalMetadataJson.execution.rankingTopKHit,
      primaryChunkCount: trace.retrievalMetadataJson.execution.primaryChunkCount,
      neighborChunkCount: trace.retrievalMetadataJson.execution.neighborChunkCount,
      retrievedChunkCount: trace.retrievalMetadataJson.execution.retrievedChunkCount,
      inputChunkCount: trace.answeringMetadataJson.inputChunkCount,
      promptContextCount: trace.answeringMetadataJson.promptContextCount,
      contextGroupCount: trace.answeringMetadataJson.contextGroupCount,
      citationCount: trace.citationsJson.length,
      citationCountBeforeLimit: trace.answeringMetadataJson.citationCountBeforeLimit,
      citationLimitHit: trace.answeringMetadataJson.citationLimitHit,
      usedFallback: trace.answeringMetadataJson.usedFallback
    });
    assert.ok(
      trace.retrievalScoresJson.every(item =>
        typeof item.chunkId === "string" &&
        typeof item.score === "number" &&
        ("lexicalScore" in item || "vectorScore" in item || "hybridScore" in item || "rerankScore" in item)
      )
    );
    assert.equal(trace.modelName.includes("ollama:") || trace.modelName === "fallback-local", true);

    const reindexResponse = await fetch(`http://localhost:${port}/documents/${uploadedDocument.id}/reindex`, {
      method: "POST"
    });
    assert.equal(reindexResponse.status, 201);

    const reindexedDocument = await waitForDocumentReady(port, uploadedDocument.id, 20000);
    assert.equal(reindexedDocument.status, "ready");

    const askAfterReindexResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: `After reindex, where are vectors stored and what processes ingestion? Include marker ${marker}`
      })
    });
    assert.equal(askAfterReindexResponse.status, 201);

    const askAfterReindex = await askAfterReindexResponse.json();
    assert.match(askAfterReindex.answer, /storage\/vectors/i);
    assert.ok(Array.isArray(askAfterReindex.retrievedChunks));
    assert.ok(askAfterReindex.retrievedChunks.some(chunk => chunk.content.includes(marker)));
    assert.ok(Array.isArray(askAfterReindex.contextGroups));
    assert.ok(askAfterReindex.contextGroups.some(group => group.mergedContent.includes(marker)));
    assert.equal(
      askAfterReindex.answerStatus === "grounded" || askAfterReindex.answerStatus === "insufficient_context",
      true
    );
    assert.ok(Array.isArray(askAfterReindex.missingInformation));
    assert.equal(typeof askAfterReindex.qualityEvaluation?.overall, "string");
    assert.equal(typeof askAfterReindex.retrievalMetadata?.execution?.retrievedChunkCount, "number");
    assert.equal(typeof askAfterReindex.answeringMetadata?.promptId, "string");
  } finally {
    server.kill("SIGTERM");
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});

async function resetTestState() {
  await prisma.answerTrace.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.documentChunk.deleteMany();
  await prisma.document.deleteMany();
}

async function waitForHealth(port, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        return;
      }
    } catch {}

    await sleep(500);
  }

  throw new Error(`Timed out waiting for API health on port ${port}.`);
}

async function waitForDocumentReady(port, documentId, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`http://localhost:${port}/documents/${documentId}`);
    if (response.ok) {
      const document = await response.json();
      if (document.status === "ready") {
        return document;
      }

      if (document.status === "failed") {
        throw new Error(`Document processing failed: ${document.errorMessage ?? "unknown error"}`);
      }
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for document ${documentId} to become ready.`);
}

function sleep(ms) {
  return new Promise(resolvePromise => {
    setTimeout(resolvePromise, ms);
  });
}

function resolveBuiltApiEntry() {
  const preferredEntry = resolve(repoRoot, "apps/api/dist/apps/api/src/main.js");
  if (existsSync(preferredEntry)) {
    return preferredEntry;
  }

  return resolve(repoRoot, "apps/api/dist/main.js");
}
