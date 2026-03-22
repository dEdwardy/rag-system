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

test("Web page source E2E: url -> ready -> chunks -> ask -> reindex", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3104;
  const storageRoot = resolve(repoRoot, "storage", `test-web-page-source-${randomUUID()}`);
  const queuePrefix = `test-web-page-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  let pageMarker = `web-page-source-marker-${randomUUID()}`;
  const pageServer = await startWebPageServer(() => pageMarker);

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
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3114;
  const storageRoot = resolve(repoRoot, "storage", `test-web-page-resync-${randomUUID()}`);
  const queuePrefix = `test-web-page-resync-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  let pageMarker = `web-page-source-marker-${randomUUID()}`;
  const pageServer = await startWebPageServer(() => pageMarker);

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
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3116;
  const storageRoot = resolve(repoRoot, "storage", `test-web-page-failed-fetch-${randomUUID()}`);
  const queuePrefix = `test-web-page-failed-fetch-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const pageServer = await startFailingWebPageServer();

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
        sourceType: runs[0].document.sourceType,
        sourceName: runs[0].document.sourceName
      },
      {
        documentId: documents[0].id,
        version: 1,
        trigger: "external_resync",
        status: "failed",
        failedStage: "source_fetch",
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
      finishedAt: summary.latestRetryableFailure.finishedAt
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
      finishedAt: summary.latestFailure.finishedAt
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
