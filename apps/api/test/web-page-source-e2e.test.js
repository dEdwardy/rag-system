const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
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

test("Web page source E2E: url -> ready -> chunks -> ask -> reindex", async () => {
  await resetTestState();

  const port = 3104;
  const storageRoot = resolve(repoRoot, "storage", `test-web-page-source-${randomUUID()}`);
  const queuePrefix = `test-web-page-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  let pageMarker = `web-page-source-marker-${randomUUID()}`;
  const pageServer = await startWebPageServer(() => pageMarker);

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/web-page`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${pageServer.origin}/knowledge/article`
      })
    });
    assert.equal(createResponse.status, 201);

    const createdDocument = await createResponse.json();
    assert.equal(createdDocument.kbId, "default-kb");
    assert.equal(createdDocument.sourceType, "web_page");
    assert.equal(createdDocument.sourceName, `${pageServer.origin}/knowledge/article`);

    const readyDocument = await waitForDocumentReady(port, createdDocument.id, 20000);
    assert.equal(readyDocument.status, "ready");
    assert.equal(readyDocument.processingStage, "completed");
    assert.ok(readyDocument.chunkCount >= 1);

    const chunksResponse = await fetch(`http://localhost:${port}/documents/${createdDocument.id}/chunks`);
    assert.equal(chunksResponse.status, 200);

    const chunks = await chunksResponse.json();
    assert.ok(Array.isArray(chunks));
    assert.ok(chunks.some(chunk => chunk.content.includes(pageMarker)));

    const askResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: `What unique marker appears on the fetched web page? Return ${pageMarker}`
      })
    });
    assert.equal(askResponse.status, 201);

    const askResult = await askResponse.json();
    assert.ok(Array.isArray(askResult.retrievedChunks));
    assert.ok(askResult.retrievedChunks.some(chunk => chunk.content.includes(pageMarker)));

    pageMarker = `web-page-source-marker-${randomUUID()}`;

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
          question: `After reindex, what unique marker appears on the fetched web page? Return ${pageMarker}`
        })
      }
    );
    assert.equal(askAfterReindexResponse.status, 201);

    const askAfterReindex = await askAfterReindexResponse.json();
    assert.ok(Array.isArray(askAfterReindex.retrievedChunks));
    assert.ok(askAfterReindex.retrievedChunks.some(chunk => chunk.content.includes(pageMarker)));
  } finally {
    server.kill("SIGTERM");
    await stopServer(pageServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Web page source E2E: ingesting the same URL again reuses the document and refreshes content", async () => {
  await resetTestState();

  const port = 3114;
  const storageRoot = resolve(repoRoot, "storage", `test-web-page-resync-${randomUUID()}`);
  const queuePrefix = `test-web-page-resync-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  let pageMarker = `web-page-source-marker-${randomUUID()}`;
  const pageServer = await startWebPageServer(() => pageMarker);

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

    const firstCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/web-page`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${pageServer.origin}/knowledge/article#intro`
      })
    });
    assert.equal(firstCreateResponse.status, 201);

    const firstDocument = await firstCreateResponse.json();
    const firstReadyDocument = await waitForDocumentReady(port, firstDocument.id, 20000);
    assert.equal(firstReadyDocument.version, 1);

    pageMarker = `web-page-source-marker-${randomUUID()}`;

    const secondCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/web-page`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${pageServer.origin}/knowledge/article`
      })
    });
    assert.equal(secondCreateResponse.status, 201);

    const secondDocument = await secondCreateResponse.json();
    assert.equal(secondDocument.id, firstDocument.id);
    assert.equal(secondDocument.sourceName, `${pageServer.origin}/knowledge/article`);
    assert.equal(secondDocument.status, "pending");

    const refreshedDocument = await waitForDocumentReady(port, secondDocument.id, 20000);
    assert.equal(refreshedDocument.version, 2);

    const chunksResponse = await fetch(`http://localhost:${port}/documents/${secondDocument.id}/chunks`);
    assert.equal(chunksResponse.status, 200);

    const chunks = await chunksResponse.json();
    assert.ok(chunks.some(chunk => chunk.content.includes(pageMarker)));
  } finally {
    server.kill("SIGTERM");
    await stopServer(pageServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Web page source E2E: failed fetch leaves a failed document with diagnostics", async () => {
  await resetTestState();

  const port = 3116;
  const storageRoot = resolve(repoRoot, "storage", `test-web-page-failed-fetch-${randomUUID()}`);
  const queuePrefix = `test-web-page-failed-fetch-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const pageServer = await startFailingWebPageServer();

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/web-page`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${pageServer.origin}/knowledge/down`
      })
    });
    assert.equal(createResponse.status, 502);

    const documentsResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents`);
    assert.equal(documentsResponse.status, 200);

    const documents = await documentsResponse.json();
    assert.equal(documents.length, 1);
    assert.equal(documents[0].sourceType, "web_page");
    assert.equal(documents[0].sourceName, `${pageServer.origin}/knowledge/down`);
    assert.equal(documents[0].status, "failed");
    assert.equal(documents[0].processingStage, "failed");
    assert.deepEqual(documents[0].diagnosticsJson, {
      code: "EXTERNAL_SOURCE_FETCH_FAILED",
      failedStage: "source_fetch",
      retryable: true,
      documentVersion: 1,
      message: "Failed to fetch web page: upstream responded with 502."
    });

    const runsResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/document-runs`);
    assert.equal(runsResponse.status, 200);

    const runs = await runsResponse.json();
    assert.equal(runs.length, 1);
    assert.equal("diagnosticsJson" in runs[0], false);
    assert.deepEqual(
      {
        documentId: runs[0].documentId,
        version: runs[0].version,
        trigger: runs[0].trigger,
        status: runs[0].status,
        failedStage: runs[0].failedStage,
        failureSummary: runs[0].failureSummary,
        sourceType: runs[0].document.sourceType,
        sourceName: runs[0].document.sourceName
      },
      {
        documentId: documents[0].id,
        version: 1,
        trigger: "external_resync",
        status: "failed",
        failedStage: "source_fetch",
        failureSummary: {
          code: "EXTERNAL_SOURCE_FETCH_FAILED",
          failedStage: "source_fetch",
          retryable: true,
          message: "Failed to fetch web page: upstream responded with 502."
        },
        sourceType: "web_page",
        sourceName: `${pageServer.origin}/knowledge/down`
      }
    );

    const runsWithDiagnosticsResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs?includeDiagnostics=true`
    );
    assert.equal(runsWithDiagnosticsResponse.status, 200);

    const runsWithDiagnostics = await runsWithDiagnosticsResponse.json();
    assert.equal(runsWithDiagnostics.length, 1);
    assert.deepEqual(runsWithDiagnostics[0].diagnosticsJson, documents[0].diagnosticsJson);

    const filteredRunsResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs?status=failed&trigger=external_resync&sourceType=web_page&limit=1`
    );
    assert.equal(filteredRunsResponse.status, 200);

    const filteredRuns = await filteredRunsResponse.json();
    assert.equal(filteredRuns.length, 1);
    assert.deepEqual(
      {
        documentId: filteredRuns[0].documentId,
        version: filteredRuns[0].version,
        status: filteredRuns[0].status,
        trigger: filteredRuns[0].trigger,
        failedStage: filteredRuns[0].failedStage
      },
      {
        documentId: documents[0].id,
        version: 1,
        status: "failed",
        trigger: "external_resync",
        failedStage: "source_fetch"
      }
    );

    const recentFilteredRunsResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs?status=failed&sinceHours=1`
    );
    assert.equal(recentFilteredRunsResponse.status, 200);

    const recentFilteredRuns = await recentFilteredRunsResponse.json();
    assert.equal(recentFilteredRuns.length, 1);

    const summaryResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/document-runs/summary`);
    assert.equal(summaryResponse.status, 200);

    const summary = await summaryResponse.json();
    assert.equal(summary.totalRuns, 1);
    assert.equal(summary.latestRunAt !== null, true);
    assert.equal(summary.latestFinishedAt !== null, true);
    assert.deepEqual(summary.byStatus, {
      pending: 0,
      processing: 0,
      ready: 0,
      failed: 1,
      skipped: 0
    });
    assert.deepEqual(summary.byTrigger, {
      upload: 0,
      reindex: 0,
      external_resync: 1
    });
    assert.deepEqual(summary.bySourceType, {
      web_page: 1
    });
    assert.equal(summary.retryableFailures, 1);
    assert.equal(summary.nonRetryableFailures, 0);
    assert.deepEqual(summary.failureByStage, {
      source_fetch: 1
    });
    assert.deepEqual(summary.latestRetryableFailure, {
      documentId: documents[0].id,
      version: 1,
      trigger: "external_resync",
      failedStage: "source_fetch",
      sourceType: "web_page",
      sourceName: `${pageServer.origin}/knowledge/down`,
      message: "Failed to fetch web page: upstream responded with 502.",
      finishedAt: summary.latestRetryableFailure.finishedAt,
      failureSummary: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        message: "Failed to fetch web page: upstream responded with 502."
      }
    });
    assert.ok(summary.latestRetryableFailure.finishedAt);
    assert.deepEqual(summary.latestSkipped, null);
    assert.deepEqual(summary.latestFailure, {
      documentId: documents[0].id,
      version: 1,
      trigger: "external_resync",
      failedStage: "source_fetch",
      sourceType: "web_page",
      sourceName: `${pageServer.origin}/knowledge/down`,
      message: "Failed to fetch web page: upstream responded with 502.",
      finishedAt: summary.latestFailure.finishedAt,
      failureSummary: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        message: "Failed to fetch web page: upstream responded with 502."
      }
    });
    assert.ok(summary.latestFailure.finishedAt);

    const recentSummaryResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs/summary?sinceHours=1`
    );
    assert.equal(recentSummaryResponse.status, 200);

    const recentSummary = await recentSummaryResponse.json();
    assert.equal(recentSummary.totalRuns, 1);
    assert.equal(recentSummary.retryableFailures, 1);
  } finally {
    server.kill("SIGTERM");
    await stopServer(pageServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Web page source E2E: a failed source no longer remains in summary after a later successful recovery", async () => {
  await resetTestState();

  const port = 3117;
  const storageRoot = resolve(repoRoot, "storage", `test-web-page-failed-then-recovered-${randomUUID()}`);
  const queuePrefix = `test-web-page-failed-then-recovered-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const recoveredMarker = `web-page-recovered-marker-${randomUUID()}`;
  const pageServer = await startRecoverableWebPageServer(recoveredMarker);

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

    const failedCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/web-page`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${pageServer.origin}/knowledge/recoverable`
      })
    });
    assert.equal(failedCreateResponse.status, 502);

    const failedDocumentsResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents`);
    assert.equal(failedDocumentsResponse.status, 200);
    const failedDocuments = await failedDocumentsResponse.json();
    assert.equal(failedDocuments.length, 1);
    assert.equal(failedDocuments[0].status, "failed");

    pageServer.setReady();

    const recoveredCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/web-page`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${pageServer.origin}/knowledge/recoverable`
      })
    });
    assert.equal(recoveredCreateResponse.status, 201);

    const recoveredDocument = await recoveredCreateResponse.json();
    assert.equal(recoveredDocument.id, failedDocuments[0].id);

    const readyDocument = await waitForDocumentReady(port, recoveredDocument.id, 20000);
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
        id: recoveredDocument.id,
        version: 2,
        status: "ready",
        errorMessage: null,
        diagnosticsJson: null
      }
    );

    const documentDetailResponse = await fetch(`http://localhost:${port}/documents/${recoveredDocument.id}`);
    assert.equal(documentDetailResponse.status, 200);
    const documentDetail = await documentDetailResponse.json();
    assert.deepEqual(
      {
        id: documentDetail.id,
        version: documentDetail.version,
        status: documentDetail.status,
        errorMessage: documentDetail.errorMessage,
        diagnosticsJson: documentDetail.diagnosticsJson
      },
      {
        id: recoveredDocument.id,
        version: 2,
        status: "ready",
        errorMessage: null,
        diagnosticsJson: null
      }
    );

    const runsResponse = await fetch(`http://localhost:${port}/documents/${recoveredDocument.id}/runs`);
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
            message: "Failed to fetch web page: upstream responded with 502."
          }
        }
      ]
    );

    const summaryResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/document-runs/summary`);
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.totalRuns, 2);
    assert.deepEqual(summary.byStatus, {
      pending: 0,
      processing: 0,
      ready: 1,
      failed: 1,
      skipped: 0
    });
    assert.deepEqual(summary.byTrigger, {
      upload: 0,
      reindex: 0,
      external_resync: 2
    });
    assert.deepEqual(summary.bySourceType, {
      web_page: 2
    });
    assert.equal(summary.retryableFailures, 0);
    assert.equal(summary.nonRetryableFailures, 0);
    assert.deepEqual(summary.failureByStage, {});
    assert.equal(summary.latestRetryableFailure, null);
    assert.equal(summary.latestFailure, null);

    const failedRunsResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs?status=failed&trigger=external_resync&sourceType=web_page&limit=10`
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
          message: "Failed to fetch web page: upstream responded with 502."
        }
      }
    );
  } finally {
    server.kill("SIGTERM");
    await stopServer(pageServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Web page source E2E: same-URL reuse clears failed diagnostics after a later successful sync", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3118;
  const storageRoot = resolve(repoRoot, "storage", `test-web-page-failed-reuse-recovered-${randomUUID()}`);
  const queuePrefix = `test-web-page-failed-reuse-recovered-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const recoveredMarker = `web-page-reuse-recovered-marker-${randomUUID()}`;
  const pageServer = await startRecoverableWebPageServer(recoveredMarker);

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

    const firstCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/web-page`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${pageServer.origin}/knowledge/recoverable#intro`
      })
    });
    assert.equal(firstCreateResponse.status, 502);

    const failedDocumentsResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents`);
    assert.equal(failedDocumentsResponse.status, 200);
    const failedDocuments = await failedDocumentsResponse.json();
    assert.equal(failedDocuments.length, 1);
    assert.equal(failedDocuments[0].status, "failed");

    pageServer.setReady();

    const secondCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/web-page`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${pageServer.origin}/knowledge/recoverable`
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
            message: "Failed to fetch web page: upstream responded with 502."
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
    await stopServer(pageServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Web page source E2E: unsupported content type leaves a failed document with diagnostics", async () => {
  await resetTestState();

  const port = 3125;
  const storageRoot = resolve(repoRoot, "storage", `test-web-page-unsupported-source-${randomUUID()}`);
  const queuePrefix = `test-web-page-unsupported-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const pageServer = await startUnsupportedWebPageServer();

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/web-page`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${pageServer.origin}/knowledge/pdf`
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
        sourceType: "web_page",
        sourceName: `${pageServer.origin}/knowledge/pdf`,
        status: "failed",
        processingStage: "failed",
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_FETCH_FAILED",
          failedStage: "source_fetch",
          retryable: false,
          documentVersion: 1,
          message: "Unsupported web page content type: application/pdf."
        }
      }
    );

    const detailResponse = await fetch(`http://localhost:${port}/documents/${documents[0].id}`);
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json();
    assert.equal(detail.errorMessage, "Unsupported web page content type: application/pdf.");
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
          message: "Unsupported web page content type: application/pdf."
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
      sourceType: "web_page",
      sourceName: `${pageServer.origin}/knowledge/pdf`,
      message: "Unsupported web page content type: application/pdf.",
      finishedAt: summary.latestFailure.finishedAt,
      failureSummary: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: false,
        message: "Unsupported web page content type: application/pdf."
      }
    });
    assert.equal(summary.latestRetryableFailure, null);
  } finally {
    server.kill("SIGTERM");
    await stopServer(pageServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Web page source E2E: unsupported-content failure clears current diagnostics after a later successful sync", async () => {
  await resetTestState();

  const port = 3126;
  const storageRoot = resolve(repoRoot, "storage", `test-web-page-unsupported-recovery-${randomUUID()}`);
  const queuePrefix = `test-web-page-unsupported-recovery-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const recoveredMarker = `web-page-unsupported-recovered-marker-${randomUUID()}`;
  const pageServer = await startRecoverableUnsupportedWebPageServer(recoveredMarker);

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

    const failedCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/web-page`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${pageServer.origin}/knowledge/recoverable-pdf`
      })
    });
    assert.equal(failedCreateResponse.status, 400);

    const failedDocumentsResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents`);
    assert.equal(failedDocumentsResponse.status, 200);
    const failedDocuments = await failedDocumentsResponse.json();
    assert.equal(failedDocuments.length, 1);
    assert.equal(failedDocuments[0].status, "failed");
    assert.deepEqual(failedDocuments[0].diagnosticsJson, {
      code: "EXTERNAL_SOURCE_FETCH_FAILED",
      failedStage: "source_fetch",
      retryable: false,
      documentVersion: 1,
      message: "Unsupported web page content type: application/pdf."
    });

    pageServer.setReady();

    const recoveredCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/web-page`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${pageServer.origin}/knowledge/recoverable-pdf`
      })
    });
    assert.equal(recoveredCreateResponse.status, 201);

    const recoveredDocument = await recoveredCreateResponse.json();
    assert.equal(recoveredDocument.id, failedDocuments[0].id);
    assert.equal(recoveredDocument.status, "pending");

    const readyDocument = await waitForDocumentReady(port, recoveredDocument.id, 20000);
    assert.deepEqual(
      {
        version: readyDocument.version,
        status: readyDocument.status,
        errorMessage: readyDocument.errorMessage,
        diagnosticsJson: readyDocument.diagnosticsJson
      },
      {
        version: 2,
        status: "ready",
        errorMessage: null,
        diagnosticsJson: null
      }
    );

    const chunksResponse = await fetch(`http://localhost:${port}/documents/${recoveredDocument.id}/chunks`);
    assert.equal(chunksResponse.status, 200);
    const chunks = await chunksResponse.json();
    assert.ok(chunks.some(chunk => chunk.content.includes(recoveredMarker)));

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
        id: recoveredDocument.id,
        version: 2,
        status: "ready",
        errorMessage: null,
        diagnosticsJson: null
      }
    );

    const detailResponse = await fetch(`http://localhost:${port}/documents/${recoveredDocument.id}`);
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
        id: recoveredDocument.id,
        version: 2,
        status: "ready",
        errorMessage: null,
        diagnosticsJson: null
      }
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
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs?status=failed&documentId=${recoveredDocument.id}`
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
        documentId: recoveredDocument.id,
        version: 1,
        status: "failed",
        failedStage: "source_fetch",
        failureSummary: {
          code: "EXTERNAL_SOURCE_FETCH_FAILED",
          failedStage: "source_fetch",
          retryable: false,
          message: "Unsupported web page content type: application/pdf."
        }
      }
    );
  } finally {
    server.kill("SIGTERM");
    await stopServer(pageServer.server);
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

async function startWebPageServer(markerOrFactory) {
  const server = http.createServer((request, response) => {
    if (request.url === "/knowledge/article") {
      const marker = typeof markerOrFactory === "function" ? markerOrFactory() : markerOrFactory;
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Fetched Knowledge Article</title>
          </head>
          <body>
            <main>
              <h1>Fetched Knowledge Article</h1>
              <p>This page was fetched through the backend web-page ingestion path.</p>
              <p>Unique marker: ${marker}</p>
            </main>
          </body>
        </html>`);
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

async function startFailingWebPageServer() {
  const server = http.createServer((request, response) => {
    if (request.url === "/knowledge/down") {
      response.writeHead(502, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end("temporary upstream failure");
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

async function startRecoverableWebPageServer(marker) {
  let mode = "failed";

  const server = http.createServer((request, response) => {
    if (request.url === "/knowledge/recoverable") {
      if (mode === "failed") {
        response.writeHead(502, {
          "Content-Type": "text/plain; charset=utf-8"
        });
        response.end("temporary upstream failure");
        return;
      }

      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Recovered Knowledge Article</title>
          </head>
          <body>
            <main>
              <h1>Recovered Knowledge Article</h1>
              <p>Unique marker: ${marker}</p>
            </main>
          </body>
        </html>`);
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
    origin: `http://127.0.0.1:${address.port}`,
    setReady() {
      mode = "ready";
    }
  };
}

async function startUnsupportedWebPageServer() {
  const server = http.createServer((request, response) => {
    if (request.url === "/knowledge/pdf") {
      response.writeHead(200, {
        "Content-Type": "application/pdf"
      });
      response.end("%PDF-1.7");
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

async function startRecoverableUnsupportedWebPageServer(marker) {
  let mode = "unsupported";

  const server = http.createServer((request, response) => {
    if (request.url === "/knowledge/recoverable-pdf") {
      if (mode === "unsupported") {
        response.writeHead(200, {
          "Content-Type": "application/pdf"
        });
        response.end("%PDF-1.7");
        return;
      }

      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Recovered Html Article</title>
          </head>
          <body>
            <main>
              <h1>Recovered Html Article</h1>
              <p>Unique marker: ${marker}</p>
            </main>
          </body>
        </html>`);
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
    origin: `http://127.0.0.1:${address.port}`,
    setReady() {
      mode = "ready";
    }
  };
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
