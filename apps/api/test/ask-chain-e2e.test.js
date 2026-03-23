const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { mkdirSync, rmSync } = require("node:fs");
const { resolve } = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { seedDefaultRecords } = require("./support/seed-default-records.js");

const repoRoot = resolve(__dirname, "../../..");
const apiRoot = resolve(repoRoot, "apps/api");
const prisma = new PrismaClient();

test.before(() => {
  seedDefaultRecords(apiRoot);
});

test("Ask chain E2E: upload -> grounded ask -> conversation reuse -> trace growth -> reindex -> ask", async () => {
  await resetTestState();

  const port = 3103;
  const storageRoot = resolve(repoRoot, "storage", `test-ask-chain-${randomUUID()}`);
  const queuePrefix = `test-ask-chain-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const server = spawn(process.execPath, ["apps/api/dist/main.js"], {
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

    const marker = `ask-chain-marker-${randomUUID()}`;
    const formData = new FormData();
    formData.set(
      "file",
      new Blob(
        [
          [
            "# Ask Chain Test",
            "",
            "## Facts",
            "",
            "Ask-chain E2E should persist messages and traces for the same conversation.",
            "Reindex should not break later retrieval from the same knowledge base.",
            `Unique marker: ${marker}`
          ].join("\n")
        ],
        { type: "text/markdown" }
      ),
      "ask-chain-test.md"
    );

    const uploadResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/upload`, {
      method: "POST",
      body: formData
    });
    assert.equal(uploadResponse.status, 201);

    const uploadedDocument = await uploadResponse.json();
    const readyDocument = await waitForDocumentReady(port, uploadedDocument.id, 20000);
    assert.equal(readyDocument.status, "ready");

    const firstAsk = await askAssistant(port, {
      question: `What does the ask-chain document say about persistence and reindex? Include marker ${marker}.`
    });
    assert.equal(firstAsk.response.status, 201);
    assert.equal(typeof firstAsk.body.conversationId, "string");
    assert.equal(typeof firstAsk.body.traceId, "string");
    assert.equal(typeof firstAsk.body.answer, "string");
    assert.ok(firstAsk.body.answer.length >= 1);
    assert.ok(Array.isArray(firstAsk.body.citations));
    assert.ok(firstAsk.body.citations.length >= 1);
    assert.ok(Array.isArray(firstAsk.body.retrievedChunks));
    assert.ok(firstAsk.body.retrievedChunks.some(chunk => chunk.content.includes(marker)));
    assert.ok(Array.isArray(firstAsk.body.contextGroups));
    assert.ok(firstAsk.body.contextGroups.some(group => group.mergedContent.includes(marker)));
    assert.equal(
      firstAsk.body.answerStatus === "grounded" || firstAsk.body.answerStatus === "insufficient_context",
      true
    );
    assert.ok(Array.isArray(firstAsk.body.missingInformation));
    assert.equal(typeof firstAsk.body.qualityEvaluation?.overall, "string");
    assert.equal(typeof firstAsk.body.qualityEvaluation?.summary, "string");
    assert.equal(typeof firstAsk.body.retrievalMetadata?.execution?.retrievedChunkCount, "number");
    assert.equal(typeof firstAsk.body.answeringMetadata?.promptId, "string");

    await assertConversationState(port, firstAsk.body.conversationId, [
      firstAsk.body.traceId,
      firstAsk.body.traceId
    ]);
    await assertTraceState(port, firstAsk.body.traceId);

    const secondAsk = await askAssistant(port, {
      question: `Repeat the ask-chain facts again and keep the same source marker ${marker}.`,
      conversationId: firstAsk.body.conversationId
    });
    assert.equal(secondAsk.response.status, 201);
    assert.equal(secondAsk.body.conversationId, firstAsk.body.conversationId);
    assert.notEqual(secondAsk.body.traceId, firstAsk.body.traceId);
    assert.ok(Array.isArray(secondAsk.body.retrievedChunks));
    assert.ok(secondAsk.body.retrievedChunks.some(chunk => chunk.content.includes(marker)));
    assert.ok(Array.isArray(secondAsk.body.contextGroups));
    assert.ok(secondAsk.body.contextGroups.some(group => group.mergedContent.includes(marker)));

    await assertConversationState(port, firstAsk.body.conversationId, [
      firstAsk.body.traceId,
      firstAsk.body.traceId,
      secondAsk.body.traceId,
      secondAsk.body.traceId
    ]);
    await assertConversationTraces(port, firstAsk.body.conversationId, [
      firstAsk.body.traceId,
      secondAsk.body.traceId
    ]);
    await assertTraceState(port, secondAsk.body.traceId);

    const reindexResponse = await fetch(`http://localhost:${port}/documents/${uploadedDocument.id}/reindex`, {
      method: "POST"
    });
    assert.equal(reindexResponse.status, 201);

    const reindexedDocument = await waitForDocumentReady(port, uploadedDocument.id, 20000);
    assert.equal(reindexedDocument.status, "ready");

    const thirdAsk = await askAssistant(port, {
      question: `After reindex, what should still work for the same conversation? Include marker ${marker}.`,
      conversationId: firstAsk.body.conversationId
    });
    assert.equal(thirdAsk.response.status, 201);
    assert.equal(thirdAsk.body.conversationId, firstAsk.body.conversationId);
    assert.ok(Array.isArray(thirdAsk.body.retrievedChunks));
    assert.ok(thirdAsk.body.retrievedChunks.some(chunk => chunk.content.includes(marker)));
    assert.ok(Array.isArray(thirdAsk.body.contextGroups));
    assert.ok(thirdAsk.body.contextGroups.some(group => group.mergedContent.includes(marker)));

    await assertConversationState(port, firstAsk.body.conversationId, [
      firstAsk.body.traceId,
      firstAsk.body.traceId,
      secondAsk.body.traceId,
      secondAsk.body.traceId,
      thirdAsk.body.traceId,
      thirdAsk.body.traceId
    ]);
    await assertConversationTraces(port, firstAsk.body.conversationId, [
      firstAsk.body.traceId,
      secondAsk.body.traceId,
      thirdAsk.body.traceId
    ]);
    await assertTraceState(port, thirdAsk.body.traceId);
  } finally {
    server.kill("SIGTERM");
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});

async function askAssistant(port, body) {
  const response = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return {
    response,
    body: await response.json()
  };
}

async function assertConversationState(port, conversationId, expectedTraceIds) {
  const messagesResponse = await fetch(`http://localhost:${port}/conversations/${conversationId}/messages`);
  assert.equal(messagesResponse.status, 200);

  const messages = await messagesResponse.json();
  assert.equal(messages.length, expectedTraceIds.length);
  assert.deepEqual(
    messages.map(message => message.role),
    expectedTraceIds.map((_, index) => (index % 2 === 0 ? "user" : "assistant"))
  );
  assert.deepEqual(
    messages.map(message => message.traceId),
    expectedTraceIds
  );
}

async function assertConversationTraces(port, conversationId, expectedTraceIds) {
  const tracesResponse = await fetch(`http://localhost:${port}/conversations/${conversationId}/traces`);
  assert.equal(tracesResponse.status, 200);

  const traces = await tracesResponse.json();
  assert.equal(traces.length, expectedTraceIds.length);
  assert.ok(traces.every(trace => typeof trace.traceSummary?.answerStatus === "string"));
  assert.ok(traces.every(trace => typeof trace.traceSummary?.qualityOverall === "string"));
  assert.ok(traces.every(trace => typeof trace.traceSummary?.primaryIssue === "string"));
  assert.ok(traces.every(trace => typeof trace.traceSummary?.retrievalMode === "string"));
  assert.ok(traces.every(trace => typeof trace.traceSummary?.generationMode === "string"));
  assert.ok(traces.every(trace => typeof trace.traceSummary?.rewriteApplied === "boolean"));
  assert.ok(
    traces.every(
      trace => trace.traceSummary?.fallbackReason === null || typeof trace.traceSummary?.fallbackReason === "string"
    )
  );
  assert.ok(traces.every(trace => typeof trace.traceSummary?.citationAttribution === "string"));
  assert.ok(traces.every(trace => typeof trace.traceSummary?.missingInformationCount === "number"));
  assert.ok(
    traces.every(
      trace =>
        trace.traceSummary?.insufficientContextReason === null ||
        typeof trace.traceSummary?.insufficientContextReason === "string"
    )
  );
  assert.ok(traces.every(trace => typeof trace.traceSummary?.retrievedChunkCount === "number"));
  assert.ok(traces.every(trace => typeof trace.traceSummary?.citationCount === "number"));
  assert.ok(traces.every(trace => typeof trace.traceSummary?.usedFallback === "boolean"));
  assert.deepEqual(
    traces.map(trace => trace.id).sort(),
    [...expectedTraceIds].sort()
  );
}

async function assertTraceState(port, traceId) {
  const traceResponse = await fetch(`http://localhost:${port}/traces/${traceId}`);
  assert.equal(traceResponse.status, 200);

  const trace = await traceResponse.json();
  assert.equal(trace.status, "success");
  assert.ok(Array.isArray(trace.retrievedChunkIdsJson));
  assert.ok(trace.retrievedChunkIdsJson.length >= 1);
  assert.ok(Array.isArray(trace.citationsJson));
  assert.ok(trace.citationsJson.length >= 1);
  assert.ok(Array.isArray(trace.retrievalScoresJson));
  assert.ok(trace.retrievalScoresJson.every(item => typeof item.chunkId === "string"));
  assert.ok(trace.retrievalScoresJson.every(item => typeof item.documentTitle === "string"));
  assert.ok(trace.retrievalScoresJson.every(item => typeof item.contentPreview === "string"));
  assert.equal(typeof trace.retrievalMetadataJson?.queryRewrite?.enabled, "boolean");
  assert.equal(typeof trace.retrievalMetadataJson?.execution?.retrievedChunkCount, "number");
  assert.equal(typeof trace.answeringMetadataJson?.promptId, "string");
  assert.equal(typeof trace.answeringMetadataJson?.answerStatus, "string");
  assert.equal(typeof trace.qualityEvaluationJson?.overall, "string");
  assert.equal(typeof trace.qualityEvaluationJson?.summary, "string");
  assert.deepEqual(trace.traceSummary, {
    answerStatus: trace.answeringMetadataJson.answerStatus,
    qualityOverall: trace.qualityEvaluationJson.overall,
    primaryIssue: trace.qualityEvaluationJson.primaryIssue,
    retrievalMode: trace.retrievalMetadataJson.execution.actualMode,
    generationMode: trace.answeringMetadataJson.generationMode,
    rewriteApplied: trace.rewrittenQuery !== null,
    fallbackReason: trace.retrievalMetadataJson.execution.fallbackReason,
    citationAttribution: trace.answeringMetadataJson.citationAttribution,
    missingInformationCount: trace.answeringMetadataJson.missingInformationCount,
    insufficientContextReason: trace.answeringMetadataJson.insufficientContextReason,
    failedStage: null,
    failureMessage: null,
    retrievedChunkCount: trace.retrievalMetadataJson.execution.retrievedChunkCount,
    citationCount: trace.citationsJson.length,
    usedFallback: trace.answeringMetadataJson.usedFallback
  });
  assert.equal(typeof trace.rewrittenQuery === "string" || trace.rewrittenQuery === null, true);
  assert.equal(typeof trace.modelName, "string");
}

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
