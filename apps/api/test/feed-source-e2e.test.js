const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn, execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { mkdirSync, rmSync } = require("node:fs");
const { resolve } = require("node:path");
const { PrismaClient } = require("@prisma/client");

const repoRoot = resolve(__dirname, "../../..");
const apiRoot = resolve(repoRoot, "apps/api");
const prisma = new PrismaClient();

test("Feed source E2E: url -> ready -> chunks -> ask -> reindex", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3105;
  const storageRoot = resolve(repoRoot, "storage", `test-feed-source-${randomUUID()}`);
  const queuePrefix = `test-feed-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  let feedMarker = `feed-source-marker-${randomUUID()}`;
  const feedServer = await startFeedServer(() => feedMarker);

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${feedServer.origin}/updates.xml`,
        maxItems: 2
      })
    });
    assert.equal(createResponse.status, 201);

    const createdDocument = await createResponse.json();
    assert.equal(createdDocument.kbId, "default-kb");
    assert.equal(createdDocument.sourceType, "feed");
    assert.equal(createdDocument.sourceName, `${feedServer.origin}/updates.xml`);

    const readyDocument = await waitForDocumentReady(port, createdDocument.id, 20000);
    assert.equal(readyDocument.status, "ready");
    assert.equal(readyDocument.processingStage, "completed");
    assert.ok(readyDocument.chunkCount >= 1);

    const chunksResponse = await fetch(`http://localhost:${port}/documents/${createdDocument.id}/chunks`);
    assert.equal(chunksResponse.status, 200);

    const chunks = await chunksResponse.json();
    assert.ok(Array.isArray(chunks));
    assert.ok(chunks.some(chunk => chunk.content.includes(feedMarker)));

    const askResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: `What unique marker appears in the ingested feed? Return ${feedMarker}`
      })
    });
    assert.equal(askResponse.status, 201);

    const askResult = await askResponse.json();
    assert.ok(Array.isArray(askResult.retrievedChunks));
    assert.ok(askResult.retrievedChunks.some(chunk => chunk.content.includes(feedMarker)));

    feedMarker = `feed-source-marker-${randomUUID()}`;

    const reindexResponse = await fetch(`http://localhost:${port}/documents/${createdDocument.id}/reindex`, {
      method: "POST"
    });
    assert.equal(reindexResponse.status, 201);

    const reindexedDocument = await waitForDocumentReady(port, createdDocument.id, 20000);
    assert.equal(reindexedDocument.status, "ready");

    const askAfterReindexResponse = await fetch(
      `http://localhost:${port}/assistants/default-assistant/ask`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: `After reindex, what unique marker appears in the ingested feed? Return ${feedMarker}`
        })
      }
    );
    assert.equal(askAfterReindexResponse.status, 201);

    const askAfterReindex = await askAfterReindexResponse.json();
    assert.ok(Array.isArray(askAfterReindex.retrievedChunks));
    assert.ok(askAfterReindex.retrievedChunks.some(chunk => chunk.content.includes(feedMarker)));
  } finally {
    server.kill("SIGTERM");
    await stopServer(feedServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Feed source E2E: Atom feed -> ready -> chunks -> ask", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3122;
  const storageRoot = resolve(repoRoot, "storage", `test-feed-atom-source-${randomUUID()}`);
  const queuePrefix = `test-feed-atom-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const feedMarker = `feed-atom-marker-${randomUUID()}`;
  const feedServer = await startAtomFeedServer(feedMarker);

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${feedServer.origin}/atom.xml`,
        maxItems: 2
      })
    });
    assert.equal(createResponse.status, 201);

    const createdDocument = await createResponse.json();
    assert.equal(createdDocument.kbId, "default-kb");
    assert.equal(createdDocument.sourceType, "feed");
    assert.equal(createdDocument.sourceName, `${feedServer.origin}/atom.xml`);

    const readyDocument = await waitForDocumentReady(port, createdDocument.id, 20000);
    assert.equal(readyDocument.status, "ready");
    assert.equal(readyDocument.processingStage, "completed");
    assert.ok(readyDocument.chunkCount >= 1);

    const chunksResponse = await fetch(`http://localhost:${port}/documents/${createdDocument.id}/chunks`);
    assert.equal(chunksResponse.status, 200);
    const chunks = await chunksResponse.json();
    assert.ok(Array.isArray(chunks));
    assert.ok(chunks.some(chunk => chunk.content.includes(feedMarker)));

    const askResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: `What unique marker appears in the ingested Atom feed? Return ${feedMarker}`
      })
    });
    assert.equal(askResponse.status, 201);

    const askResult = await askResponse.json();
    assert.ok(Array.isArray(askResult.retrievedChunks));
    assert.ok(askResult.retrievedChunks.some(chunk => chunk.content.includes(feedMarker)));
  } finally {
    server.kill("SIGTERM");
    await stopServer(feedServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Feed source E2E: partial invalid entries still reach ready and persist diagnostics", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3110;
  const storageRoot = resolve(repoRoot, "storage", `test-feed-partial-source-${randomUUID()}`);
  const queuePrefix = `test-feed-partial-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const feedMarker = `feed-partial-marker-${randomUUID()}`;
  const feedServer = await startPartialFeedServer(feedMarker);

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${feedServer.origin}/updates.xml`,
        maxItems: 2
      })
    });
    assert.equal(createResponse.status, 201);

    const createdDocument = await createResponse.json();
    const readyDocument = await waitForDocumentReady(port, createdDocument.id, 20000);
    assert.equal(readyDocument.status, "ready");
    assert.deepEqual(readyDocument.diagnosticsJson, {
      code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
      failedStage: "source_fetch",
      retryable: false,
      documentVersion: readyDocument.version,
      message: "Feed source completed with partial entry validation failures.",
      attemptedEntryCount: 2,
      succeededEntryCount: 1,
      failedEntryCount: 1,
      failedEntryRefs: ["Broken Entry"],
      failedEntries: [
        {
          ref: "Broken Entry",
          code: "ENTRY_CONTENT_EMPTY",
          message: "Feed entry is missing both summary and link.",
          retryable: false
        }
      ],
      failedEntriesTruncated: false,
      failedEntriesOmittedCount: 0,
      partial: true
    });

    const runsResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs?includeDiagnostics=true`
    );
    assert.equal(runsResponse.status, 200);
    const runs = await runsResponse.json();
    assert.equal(runs[0].status, "ready");
    assert.equal(runs[0].failedStage, "source_fetch");
    assert.deepEqual(runs[0].diagnosticsJson, readyDocument.diagnosticsJson);
    assert.deepEqual(runs[0].failureSummary, {
      code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
      failedStage: "source_fetch",
      retryable: false,
      message: "Feed source completed with partial entry validation failures."
    });

    const summaryResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/document-runs/summary`);
    assert.equal(summaryResponse.status, 200);

    const summary = await summaryResponse.json();
    assert.equal(summary.totalRuns, 1);
    assert.equal(summary.retryableFailures, 0);
    assert.equal(summary.nonRetryableFailures, 1);
    assert.deepEqual(summary.failureByStage, {
      source_fetch: 1
    });
    assert.deepEqual(summary.latestRetryableFailure, null);
    assert.deepEqual(summary.latestFailure, {
      documentId: createdDocument.id,
      version: readyDocument.version,
      trigger: "external_resync",
      failedStage: "source_fetch",
      sourceType: "feed",
      sourceName: `${feedServer.origin}/updates.xml`,
      message: "Feed source completed with partial entry validation failures.",
      finishedAt: summary.latestFailure.finishedAt,
      failureSummary: {
        code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
        failedStage: "source_fetch",
        retryable: false,
        message: "Feed source completed with partial entry validation failures."
      }
    });
    assert.ok(summary.latestFailure.finishedAt);

    const failedRunsResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs?status=failed`
    );
    assert.equal(failedRunsResponse.status, 200);
    assert.deepEqual(await failedRunsResponse.json(), []);

    const askResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: `What unique marker appears in the ingested feed? Return ${feedMarker}`
      })
    });
    assert.equal(askResponse.status, 201);

    const askResult = await askResponse.json();
    assert.ok(askResult.retrievedChunks.some(chunk => chunk.content.includes(feedMarker)));
  } finally {
    server.kill("SIGTERM");
    await stopServer(feedServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Feed source E2E: in-flight reindex from a partial-ready source does not pollute current failure summary", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3111;
  const storageRoot = resolve(repoRoot, "storage", `test-feed-partial-reindex-${randomUUID()}`);
  const queuePrefix = `test-feed-partial-reindex-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const feedServer = await startControllablePartialFeedServer();

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${feedServer.origin}/updates.xml`,
        maxItems: 2
      })
    });
    assert.equal(createResponse.status, 201);

    const createdDocument = await createResponse.json();
    const readyDocument = await waitForDocumentReady(port, createdDocument.id, 20000);
    assert.equal(readyDocument.status, "ready");

    const delayedMarker = `feed-reindex-marker-${randomUUID()}`;
    feedServer.setDelayedLargePartial(delayedMarker);

    const reindexResponsePromise = fetch(`http://localhost:${port}/documents/${createdDocument.id}/reindex`, {
      method: "POST"
    });

    const pendingRun = await waitForDocumentRun(port, createdDocument.id, run => run.version === 2, 10000);
    assert.equal(pendingRun.status, "pending");
    assert.equal(pendingRun.failedStage, null);
    assert.equal(pendingRun.failureSummary, null);

    const pendingSummaryResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs/summary`
    );
    assert.equal(pendingSummaryResponse.status, 200);
    const pendingSummary = await pendingSummaryResponse.json();
    assert.equal(pendingSummary.nonRetryableFailures, 1);
    assert.deepEqual(pendingSummary.failureByStage, {
      source_fetch: 1
    });
    assert.equal(pendingSummary.latestFailure.version, 1);

    feedServer.releaseDelayedResponse();

    const reindexResponse = await reindexResponsePromise;
    assert.equal(reindexResponse.status, 201);

    const processingRun = await waitForDocumentRun(
      port,
      createdDocument.id,
      run => run.version === 2 && run.status === "processing",
      15000
    );
    assert.equal(processingRun.failedStage, null);
    assert.deepEqual(processingRun.failureSummary, {
      code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
      failedStage: "source_fetch",
      retryable: false,
      message: "Feed source completed with partial entry validation failures."
    });

    const processingSummaryResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs/summary`
    );
    assert.equal(processingSummaryResponse.status, 200);
    const processingSummary = await processingSummaryResponse.json();
    assert.equal(processingSummary.nonRetryableFailures, 1);
    assert.deepEqual(processingSummary.failureByStage, {
      source_fetch: 1
    });
    assert.equal(processingSummary.latestFailure.version, 1);

    const readyAfterReindex = await waitForDocumentReady(port, createdDocument.id, 60000);
    assert.equal(readyAfterReindex.version, 2);
  } finally {
    server.kill("SIGTERM");
    await stopServer(feedServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Feed source E2E: partial-ready source clears current diagnostics after a later clean resync", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3112;
  const storageRoot = resolve(repoRoot, "storage", `test-feed-partial-then-clean-${randomUUID()}`);
  const queuePrefix = `test-feed-partial-then-clean-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const initialMarker = `feed-partial-then-clean-initial-${randomUUID()}`;
  const cleanMarker = `feed-partial-then-clean-clean-${randomUUID()}`;
  const feedServer = await startRecoverableFeedServer(initialMarker, cleanMarker);

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${feedServer.origin}/updates.xml`,
        maxItems: 2
      })
    });
    assert.equal(createResponse.status, 201);

    const createdDocument = await createResponse.json();
    const partialReadyDocument = await waitForDocumentReady(port, createdDocument.id, 20000);
    assert.equal(partialReadyDocument.status, "ready");
    assert.equal(partialReadyDocument.diagnosticsJson?.partial, true);

    feedServer.setClean();

    const reindexResponse = await fetch(`http://localhost:${port}/documents/${createdDocument.id}/reindex`, {
      method: "POST"
    });
    assert.equal(reindexResponse.status, 201);

    const readyDocument = await waitForDocumentReady(port, createdDocument.id, 20000);
    assert.equal(readyDocument.version, 2);
    assert.equal(readyDocument.status, "ready");
    assert.equal(readyDocument.errorMessage, null);
    assert.equal(readyDocument.diagnosticsJson, null);

    const documentsResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents`);
    assert.equal(documentsResponse.status, 200);
    const documents = await documentsResponse.json();
    assert.equal(documents.length, 1);
    assert.deepEqual(
      {
        id: documents[0].id,
        version: documents[0].version,
        status: documents[0].status,
        errorMessage: documents[0].errorMessage,
        diagnosticsJson: documents[0].diagnosticsJson
      },
      {
        id: createdDocument.id,
        version: 2,
        status: "ready",
        errorMessage: null,
        diagnosticsJson: null
      }
    );

    const detailResponse = await fetch(`http://localhost:${port}/documents/${createdDocument.id}`);
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json();
    assert.deepEqual(
      {
        id: detail.id,
        version: detail.version,
        status: detail.status,
        errorMessage: detail.errorMessage,
        diagnosticsJson: detail.diagnosticsJson
      },
      {
        id: createdDocument.id,
        version: 2,
        status: "ready",
        errorMessage: null,
        diagnosticsJson: null
      }
    );

    const runsResponse = await fetch(`http://localhost:${port}/documents/${createdDocument.id}/runs`);
    assert.equal(runsResponse.status, 200);
    const runs = await runsResponse.json();
    assert.equal(runs.length, 2);
    assert.deepEqual(
      runs.map(run => ({
        version: run.version,
        status: run.status,
        failedStage: run.failedStage,
        failureSummary: run.failureSummary
      })),
      [
        {
          version: 2,
          status: "ready",
          failedStage: null,
          failureSummary: null
        },
        {
          version: 1,
          status: "ready",
          failedStage: "source_fetch",
          failureSummary: {
            code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
            failedStage: "source_fetch",
            retryable: false,
            message: "Feed source completed with partial entry validation failures."
          }
        }
      ]
    );

    const summaryResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/document-runs/summary`);
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.totalRuns, 2);
    assert.equal(summary.retryableFailures, 0);
    assert.equal(summary.nonRetryableFailures, 0);
    assert.deepEqual(summary.failureByStage, {});
    assert.equal(summary.latestRetryableFailure, null);
    assert.equal(summary.latestFailure, null);

  } finally {
    server.kill("SIGTERM");
    await stopServer(feedServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Feed source E2E: same-URL reuse clears partial diagnostics after a later clean sync", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3118;
  const storageRoot = resolve(repoRoot, "storage", `test-feed-partial-reuse-clean-${randomUUID()}`);
  const queuePrefix = `test-feed-partial-reuse-clean-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const initialMarker = `feed-partial-reuse-initial-${randomUUID()}`;
  const cleanMarker = `feed-partial-reuse-clean-${randomUUID()}`;
  const feedServer = await startRecoverableFeedServer(initialMarker, cleanMarker);

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

    const firstCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${feedServer.origin}/updates.xml#latest`,
        maxItems: 2
      })
    });
    assert.equal(firstCreateResponse.status, 201);

    const firstDocument = await firstCreateResponse.json();
    const partialReadyDocument = await waitForDocumentReady(port, firstDocument.id, 20000);
    assert.equal(partialReadyDocument.status, "ready");
    assert.equal(partialReadyDocument.diagnosticsJson?.partial, true);

    feedServer.setClean();

    const secondCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${feedServer.origin}/updates.xml`,
        maxItems: 2
      })
    });
    assert.equal(secondCreateResponse.status, 201);

    const secondDocument = await secondCreateResponse.json();
    assert.equal(secondDocument.id, firstDocument.id);
    assert.equal(secondDocument.status, "pending");

    const readyDocument = await waitForDocumentReady(port, secondDocument.id, 20000);
    assert.equal(readyDocument.version, 2);
    assert.equal(readyDocument.status, "ready");
    assert.equal(readyDocument.errorMessage, null);
    assert.equal(readyDocument.diagnosticsJson, null);

    const documentsResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents`);
    assert.equal(documentsResponse.status, 200);
    const documents = await documentsResponse.json();
    assert.equal(documents.length, 1);
    assert.deepEqual(
      {
        id: documents[0].id,
        version: documents[0].version,
        status: documents[0].status,
        errorMessage: documents[0].errorMessage,
        diagnosticsJson: documents[0].diagnosticsJson
      },
      {
        id: firstDocument.id,
        version: 2,
        status: "ready",
        errorMessage: null,
        diagnosticsJson: null
      }
    );

    const runsResponse = await fetch(`http://localhost:${port}/documents/${firstDocument.id}/runs`);
    assert.equal(runsResponse.status, 200);
    const runs = await runsResponse.json();
    assert.equal(runs.length, 2);
    assert.deepEqual(
      runs.map(run => ({
        version: run.version,
        status: run.status,
        failedStage: run.failedStage,
        failureSummary: run.failureSummary
      })),
      [
        {
          version: 2,
          status: "ready",
          failedStage: null,
          failureSummary: null
        },
        {
          version: 1,
          status: "ready",
          failedStage: "source_fetch",
          failureSummary: {
            code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
            failedStage: "source_fetch",
            retryable: false,
            message: "Feed source completed with partial entry validation failures."
          }
        }
      ]
    );

    const summaryResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/document-runs/summary`);
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.totalRuns, 2);
    assert.equal(summary.retryableFailures, 0);
    assert.equal(summary.nonRetryableFailures, 0);
    assert.deepEqual(summary.failureByStage, {});
    assert.equal(summary.latestRetryableFailure, null);
    assert.equal(summary.latestFailure, null);

  } finally {
    server.kill("SIGTERM");
    await stopServer(feedServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Feed source E2E: same-URL reuse clears failed diagnostics after a later successful sync", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3119;
  const storageRoot = resolve(repoRoot, "storage", `test-feed-failed-reuse-recovered-${randomUUID()}`);
  const queuePrefix = `test-feed-failed-reuse-recovered-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const recoveredMarker = `feed-reuse-recovered-marker-${randomUUID()}`;
  const feedServer = await startRecoverableFailedFeedServer(recoveredMarker);

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

    const firstCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${feedServer.origin}/updates.xml#latest`,
        maxItems: 2
      })
    });
    assert.equal(firstCreateResponse.status, 502);

    const failedDocumentsResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents`);
    assert.equal(failedDocumentsResponse.status, 200);
    const failedDocuments = await failedDocumentsResponse.json();
    assert.equal(failedDocuments.length, 1);
    assert.equal(failedDocuments[0].status, "failed");

    feedServer.setReady();

    const secondCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${feedServer.origin}/updates.xml`,
        maxItems: 2
      })
    });
    assert.equal(secondCreateResponse.status, 201);

    const secondDocument = await secondCreateResponse.json();
    assert.equal(secondDocument.id, failedDocuments[0].id);
    assert.equal(secondDocument.status, "pending");

    const readyDocument = await waitForDocumentReady(port, secondDocument.id, 20000);
    assert.equal(readyDocument.version, 2);
    assert.equal(readyDocument.status, "ready");
    assert.equal(readyDocument.errorMessage, null);
    assert.equal(readyDocument.diagnosticsJson, null);

    const documentsResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents`);
    assert.equal(documentsResponse.status, 200);
    const documents = await documentsResponse.json();
    assert.equal(documents.length, 1);
    assert.deepEqual(
      {
        id: documents[0].id,
        version: documents[0].version,
        status: documents[0].status,
        errorMessage: documents[0].errorMessage,
        diagnosticsJson: documents[0].diagnosticsJson
      },
      {
        id: failedDocuments[0].id,
        version: 2,
        status: "ready",
        errorMessage: null,
        diagnosticsJson: null
      }
    );

    const runsResponse = await fetch(`http://localhost:${port}/documents/${failedDocuments[0].id}/runs`);
    assert.equal(runsResponse.status, 200);
    const runs = await runsResponse.json();
    assert.equal(runs.length, 2);
    assert.deepEqual(
      runs.map(run => ({
        version: run.version,
        status: run.status,
        failedStage: run.failedStage,
        failureSummary: run.failureSummary
      })),
      [
        {
          version: 2,
          status: "ready",
          failedStage: null,
          failureSummary: null
        },
        {
          version: 1,
          status: "failed",
          failedStage: "source_fetch",
          failureSummary: {
            code: "EXTERNAL_SOURCE_FETCH_FAILED",
            failedStage: "source_fetch",
            retryable: true,
            message: "Failed to fetch feed: upstream responded with 502."
          }
        }
      ]
    );

    const summaryResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/document-runs/summary`);
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.totalRuns, 2);
    assert.equal(summary.retryableFailures, 0);
    assert.equal(summary.nonRetryableFailures, 0);
    assert.deepEqual(summary.failureByStage, {});
    assert.equal(summary.latestRetryableFailure, null);
    assert.equal(summary.latestFailure, null);

    const failedRunsResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs?status=failed&documentId=${failedDocuments[0].id}`
    );
    assert.equal(failedRunsResponse.status, 200);
    const failedRuns = await failedRunsResponse.json();
    assert.equal(failedRuns.length, 1);
    assert.deepEqual(
      {
        documentId: failedRuns[0].documentId,
        version: failedRuns[0].version,
        status: failedRuns[0].status,
        failedStage: failedRuns[0].failedStage,
        failureSummary: failedRuns[0].failureSummary
      },
      {
        documentId: failedDocuments[0].id,
        version: 1,
        status: "failed",
        failedStage: "source_fetch",
        failureSummary: {
          code: "EXTERNAL_SOURCE_FETCH_FAILED",
          failedStage: "source_fetch",
          retryable: true,
          message: "Failed to fetch feed: upstream responded with 502."
        }
      }
    );
  } finally {
    server.kill("SIGTERM");
    await stopServer(feedServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Feed source E2E: all-invalid entries leave a failed document with diagnostics", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3124;
  const storageRoot = resolve(repoRoot, "storage", `test-feed-invalid-source-${randomUUID()}`);
  const queuePrefix = `test-feed-invalid-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const feedServer = await startInvalidFeedServer();

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${feedServer.origin}/updates.xml`,
        maxItems: 2
      })
    });
    assert.equal(createResponse.status, 400);

    const documentsResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents`);
    assert.equal(documentsResponse.status, 200);
    const documents = await documentsResponse.json();
    assert.equal(documents.length, 1);
    assert.deepEqual(
      {
        sourceType: documents[0].sourceType,
        sourceName: documents[0].sourceName,
        status: documents[0].status,
        processingStage: documents[0].processingStage,
        diagnosticsJson: documents[0].diagnosticsJson
      },
      {
        sourceType: "feed",
        sourceName: `${feedServer.origin}/updates.xml`,
        status: "failed",
        processingStage: "failed",
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_FETCH_FAILED",
          failedStage: "source_fetch",
          retryable: false,
          documentVersion: 1,
          message: "Extracted feed content is empty: all feed entries were invalid."
        }
      }
    );

    const detailResponse = await fetch(`http://localhost:${port}/documents/${documents[0].id}`);
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json();
    assert.equal(detail.errorMessage, "Extracted feed content is empty: all feed entries were invalid.");
    assert.deepEqual(detail.diagnosticsJson, documents[0].diagnosticsJson);

    const runsResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs?includeDiagnostics=true`
    );
    assert.equal(runsResponse.status, 200);
    const runs = await runsResponse.json();
    assert.equal(runs.length, 1);
    assert.deepEqual(
      {
        documentId: runs[0].documentId,
        status: runs[0].status,
        failedStage: runs[0].failedStage,
        failureSummary: runs[0].failureSummary,
        diagnosticsJson: runs[0].diagnosticsJson
      },
      {
        documentId: documents[0].id,
        status: "failed",
        failedStage: "source_fetch",
        failureSummary: {
          code: "EXTERNAL_SOURCE_FETCH_FAILED",
          failedStage: "source_fetch",
          retryable: false,
          message: "Extracted feed content is empty: all feed entries were invalid."
        },
        diagnosticsJson: documents[0].diagnosticsJson
      }
    );

    const summaryResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/document-runs/summary`);
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.totalRuns, 1);
    assert.equal(summary.retryableFailures, 0);
    assert.equal(summary.nonRetryableFailures, 1);
    assert.deepEqual(summary.failureByStage, {
      source_fetch: 1
    });
    assert.deepEqual(summary.latestFailure, {
      documentId: documents[0].id,
      version: 1,
      trigger: "external_resync",
      failedStage: "source_fetch",
      sourceType: "feed",
      sourceName: `${feedServer.origin}/updates.xml`,
      message: "Extracted feed content is empty: all feed entries were invalid.",
      finishedAt: summary.latestFailure.finishedAt,
      failureSummary: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: false,
        message: "Extracted feed content is empty: all feed entries were invalid."
      }
    });
    assert.equal(summary.latestRetryableFailure, null);
  } finally {
    server.kill("SIGTERM");
    await stopServer(feedServer.server);
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

async function startFeedServer(markerOrFactory) {
  const server = http.createServer((request, response) => {
    if (request.url === "/updates.xml") {
      const marker = typeof markerOrFactory === "function" ? markerOrFactory() : markerOrFactory;
      response.writeHead(200, {
        "Content-Type": "application/rss+xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Remote Feed Updates</title>
            <description>External knowledge source test feed.</description>
            <item>
              <title>Release Note 1</title>
              <link>https://example.com/release-1</link>
              <description><![CDATA[<p>Unique marker: ${marker}</p>]]></description>
              <pubDate>Sun, 21 Mar 2026 10:00:00 GMT</pubDate>
            </item>
            <item>
              <title>Release Note 2</title>
              <description>Background details for the source integration path.</description>
            </item>
          </channel>
        </rss>`);
      return;
    }

    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("Not found");
  });

  await new Promise(resolvePromise => {
    server.listen(0, "127.0.0.1", resolvePromise);
  });

  const address = server.address();
  return {
    server,
    origin: `http://127.0.0.1:${address.port}`
  };
}

async function startPartialFeedServer(marker) {
  const server = http.createServer((request, response) => {
    if (request.url === "/updates.xml") {
      response.writeHead(200, {
        "Content-Type": "application/rss+xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Remote Feed Updates</title>
            <description>External knowledge source test feed.</description>
            <item>
              <title>Release Note 1</title>
              <link>https://example.com/release-1</link>
              <description><![CDATA[<p>Unique marker: ${marker}</p>]]></description>
            </item>
            <item>
              <title>Broken Entry</title>
            </item>
          </channel>
        </rss>`);
      return;
    }

    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("Not found");
  });

  await new Promise(resolvePromise => {
    server.listen(0, "127.0.0.1", resolvePromise);
  });

  const address = server.address();
  return {
    server,
    origin: `http://127.0.0.1:${address.port}`
  };
}

async function startAtomFeedServer(marker) {
  const server = http.createServer((request, response) => {
    if (request.url === "/atom.xml") {
      response.writeHead(200, {
        "Content-Type": "application/atom+xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>Remote Atom Updates</title>
          <subtitle>External knowledge source test atom feed.</subtitle>
          <entry>
            <title>Atom Release 1</title>
            <link rel="alternate" href="https://example.com/atom/release-1" />
            <updated>2026-03-22T10:00:00Z</updated>
            <summary><![CDATA[<p>Unique marker: ${marker}</p>]]></summary>
          </entry>
          <entry>
            <title>Atom Release 2</title>
            <link rel="alternate" href="https://example.com/atom/release-2" />
            <published>2026-03-21T08:00:00Z</published>
            <content type="html"><![CDATA[<div>Atom feed fallback content.</div>]]></content>
          </entry>
        </feed>`);
      return;
    }

    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("Not found");
  });

  await new Promise(resolvePromise => {
    server.listen(0, "127.0.0.1", resolvePromise);
  });

  const address = server.address();
  return {
    server,
    origin: `http://127.0.0.1:${address.port}`
  };
}

async function startControllablePartialFeedServer() {
  let mode = "initial";
  let delayedMarker = "";
  let delayedResponsePromise = Promise.resolve();
  let releaseDelayedResponse = () => {};

  const server = http.createServer(async (request, response) => {
    if (request.url === "/updates.xml") {
      if (mode === "delayed-large-partial") {
        await delayedResponsePromise;
        response.writeHead(200, {
          "Content-Type": "application/rss+xml; charset=utf-8"
        });
        response.end(buildPartialFeedXml(delayedMarker, "Large Entry", buildLargeFeedBody(delayedMarker)));
        return;
      }

      response.writeHead(200, {
        "Content-Type": "application/rss+xml; charset=utf-8"
      });
      response.end(
        buildPartialFeedXml(
          `feed-initial-marker-${randomUUID()}`,
          "Release Note 1",
          "<p>Initial partial-ready feed payload.</p>"
        )
      );
      return;
    }

    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("Not found");
  });

  await new Promise(resolvePromise => {
    server.listen(0, "127.0.0.1", resolvePromise);
  });

  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
    setDelayedLargePartial(marker) {
      mode = "delayed-large-partial";
      delayedMarker = marker;
      delayedResponsePromise = new Promise(resolvePromise => {
        releaseDelayedResponse = resolvePromise;
      });
    },
    releaseDelayedResponse() {
      releaseDelayedResponse();
    }
  };
}

async function startRecoverableFeedServer(initialMarker, cleanMarker) {
  let mode = "partial";

  const server = http.createServer((request, response) => {
    if (request.url === "/updates.xml") {
      response.writeHead(200, {
        "Content-Type": "application/rss+xml; charset=utf-8"
      });

      if (mode === "partial") {
        response.end(buildPartialFeedXml(initialMarker, "Release Note 1", "<p>Initial partial-ready feed payload.</p>"));
        return;
      }

      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Remote Feed Updates</title>
            <description>External knowledge source test feed.</description>
            <item>
              <title>Release Note 1</title>
              <link>https://example.com/release-1</link>
              <description><![CDATA[<p>Unique marker: ${cleanMarker}</p>]]></description>
            </item>
            <item>
              <title>Release Note 2</title>
              <link>https://example.com/release-2</link>
              <description><![CDATA[<p>Clean recovery payload.</p>]]></description>
            </item>
          </channel>
        </rss>`);
      return;
    }

    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("Not found");
  });

  await new Promise(resolvePromise => {
    server.listen(0, "127.0.0.1", resolvePromise);
  });

  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
    setClean() {
      mode = "clean";
    }
  };
}

async function startRecoverableFailedFeedServer(marker) {
  let mode = "failed";

  const server = http.createServer((request, response) => {
    if (request.url === "/updates.xml") {
      if (mode === "failed") {
        response.writeHead(502, {
          "Content-Type": "text/plain; charset=utf-8"
        });
        response.end("temporary upstream failure");
        return;
      }

      response.writeHead(200, {
        "Content-Type": "application/rss+xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Remote Feed Updates</title>
            <description>External knowledge source test feed.</description>
            <item>
              <title>Release Note 1</title>
              <link>https://example.com/release-1</link>
              <description><![CDATA[<p>Unique marker: ${marker}</p>]]></description>
            </item>
            <item>
              <title>Release Note 2</title>
              <link>https://example.com/release-2</link>
              <description><![CDATA[<p>Recovered clean payload.</p>]]></description>
            </item>
          </channel>
        </rss>`);
      return;
    }

    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("Not found");
  });

  await new Promise(resolvePromise => {
    server.listen(0, "127.0.0.1", resolvePromise);
  });

  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
    setReady() {
      mode = "ready";
    }
  };
}

async function startInvalidFeedServer() {
  const server = http.createServer((request, response) => {
    if (request.url === "/updates.xml") {
      response.writeHead(200, {
        "Content-Type": "application/rss+xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title>Broken Feed Updates</title>
            <description>Every entry is invalid.</description>
            <item>
              <title>Broken Entry 1</title>
            </item>
            <item>
              <title>Broken Entry 2</title>
            </item>
          </channel>
        </rss>`);
      return;
    }

    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("Not found");
  });

  await new Promise(resolvePromise => {
    server.listen(0, "127.0.0.1", resolvePromise);
  });

  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`
  };
}

function buildPartialFeedXml(marker, entryTitle, descriptionHtml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Remote Feed Updates</title>
        <description>External knowledge source test feed.</description>
        <item>
          <title>${entryTitle}</title>
          <link>https://example.com/release-1</link>
          <description><![CDATA[${descriptionHtml}<p>Unique marker: ${marker}</p>]]></description>
        </item>
        <item>
          <title>Broken Entry</title>
        </item>
      </channel>
    </rss>`;
}

function buildLargeFeedBody(marker) {
  return Array.from({ length: 1200 }, (_, index) => `<p>${marker} paragraph ${index}</p>`).join("");
}

async function stopServer(server) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.close(error => {
      if (error) {
        rejectPromise(error);
        return;
      }

      resolvePromise();
    });
  });
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

async function waitForDocumentRun(port, documentId, predicate, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`http://localhost:${port}/documents/${documentId}/runs`);
    if (response.ok) {
      const runs = await response.json();
      const matched = runs.find(predicate);
      if (matched) {
        return matched;
      }
    }

    await sleep(100);
  }

  throw new Error(`Timed out waiting for a matching run on document ${documentId}.`);
}

function sleep(ms) {
  return new Promise(resolvePromise => {
    setTimeout(resolvePromise, ms);
  });
}
