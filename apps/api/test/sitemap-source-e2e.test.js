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

test("Sitemap source E2E: sitemap -> ready -> chunks -> ask -> reindex", async () => {
  await resetTestState();

  const port = 3106;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-source-${randomUUID()}`);
  const queuePrefix = `test-sitemap-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  let sitemapMarker = `sitemap-source-marker-${randomUUID()}`;
  const sitemapServer = await startSitemapServer(() => sitemapMarker);

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap.xml`,
        maxPages: 2
      })
    });
    assert.equal(createResponse.status, 201);

    const createdDocument = await createResponse.json();
    assert.equal(createdDocument.kbId, "default-kb");
    assert.equal(createdDocument.sourceType, "sitemap");
    assert.equal(createdDocument.sourceName, `${sitemapServer.origin}/sitemap.xml`);

    const readyDocument = await waitForDocumentReady(port, createdDocument.id, 20000);
    assert.equal(readyDocument.status, "ready");
    assert.equal(readyDocument.processingStage, "completed");
    assert.ok(readyDocument.chunkCount >= 1);

    const chunksResponse = await fetch(`http://localhost:${port}/documents/${createdDocument.id}/chunks`);
    assert.equal(chunksResponse.status, 200);

    const chunks = await chunksResponse.json();
    assert.ok(Array.isArray(chunks));
    assert.ok(chunks.some(chunk => chunk.content.includes(sitemapMarker)));

    const askResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: `What unique marker appears in the ingested sitemap pages? Return ${sitemapMarker}`
      })
    });
    assert.equal(askResponse.status, 201);

    const askResult = await askResponse.json();
    assert.ok(Array.isArray(askResult.retrievedChunks));
    assert.ok(askResult.retrievedChunks.some(chunk => chunk.content.includes(sitemapMarker)));

    sitemapMarker = `sitemap-source-marker-${randomUUID()}`;

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
          question: `After reindex, what unique marker appears in the ingested sitemap pages? Return ${sitemapMarker}`
        })
      }
    );
    assert.equal(askAfterReindexResponse.status, 201);

    const askAfterReindex = await askAfterReindexResponse.json();
    assert.ok(Array.isArray(askAfterReindex.retrievedChunks));
    assert.ok(askAfterReindex.retrievedChunks.some(chunk => chunk.content.includes(sitemapMarker)));
  } finally {
    server.kill("SIGTERM");
    await stopServer(sitemapServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Sitemap source E2E: sitemap index -> ready -> chunks -> ask", async () => {
  await resetTestState();

  const port = 3107;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-index-source-${randomUUID()}`);
  const queuePrefix = `test-sitemap-index-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const sitemapMarker = `sitemap-index-marker-${randomUUID()}`;
  const sitemapServer = await startSitemapIndexServer(sitemapMarker);

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap-index.xml`,
        maxPages: 2
      })
    });
    assert.equal(createResponse.status, 201);

    const createdDocument = await createResponse.json();
    assert.equal(createdDocument.sourceType, "sitemap");
    assert.equal(createdDocument.sourceName, `${sitemapServer.origin}/sitemap-index.xml`);

    const readyDocument = await waitForDocumentReady(port, createdDocument.id, 20000);
    assert.equal(readyDocument.status, "ready");
    assert.ok(readyDocument.chunkCount >= 1);

    const chunksResponse = await fetch(`http://localhost:${port}/documents/${createdDocument.id}/chunks`);
    assert.equal(chunksResponse.status, 200);

    const chunks = await chunksResponse.json();
    assert.ok(chunks.some(chunk => chunk.content.includes(sitemapMarker)));

    const askResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: `What unique marker appears in the sitemap index pages? Return ${sitemapMarker}`
      })
    });
    assert.equal(askResponse.status, 201);

    const askResult = await askResponse.json();
    assert.ok(Array.isArray(askResult.retrievedChunks));
    assert.ok(askResult.retrievedChunks.some(chunk => chunk.content.includes(sitemapMarker)));
  } finally {
    server.kill("SIGTERM");
    await stopServer(sitemapServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Sitemap source E2E: partial page failure still reaches ready and persists partial diagnostics", async () => {
  await resetTestState();

  const port = 3108;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-partial-source-${randomUUID()}`);
  const queuePrefix = `test-sitemap-partial-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const sitemapMarker = `sitemap-partial-marker-${randomUUID()}`;
  const sitemapServer = await startPartialFailureSitemapServer(sitemapMarker);

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap.xml`,
        maxPages: 3
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
      message: "Sitemap source completed with partial page fetch failures.",
      attemptedPageCount: 3,
      succeededPageCount: 2,
      failedPageCount: 1,
      failedPageUrls: [`${sitemapServer.origin}/pages/failing`],
      failedPages: [
        {
          url: `${sitemapServer.origin}/pages/failing`,
          code: "UNSUPPORTED_CONTENT_TYPE",
          message: "Unsupported web page content type: application/pdf.",
          retryable: false
        }
      ],
      failedPagesTruncated: false,
      failedPagesOmittedCount: 0,
      partial: true
    });

    const chunksResponse = await fetch(`http://localhost:${port}/documents/${createdDocument.id}/chunks`);
    assert.equal(chunksResponse.status, 200);
    const chunks = await chunksResponse.json();
    assert.ok(chunks.some(chunk => chunk.content.includes(sitemapMarker)));

    const runsResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs?includeDiagnostics=true`
    );
    assert.equal(runsResponse.status, 200);

    const runs = await runsResponse.json();
    assert.equal(runs[0].status, "ready");
    assert.deepEqual(runs[0].diagnosticsJson, readyDocument.diagnosticsJson);

    const summaryResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/document-runs/summary`);
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.retryableFailures, 0);
    assert.equal(summary.nonRetryableFailures, 1);
    assert.equal(summary.latestRetryableFailure, null);
    assert.deepEqual(summary.latestFailure, {
      documentId: createdDocument.id,
      version: readyDocument.version,
      trigger: "external_resync",
      failedStage: "source_fetch",
      sourceType: "sitemap",
      sourceName: `${sitemapServer.origin}/sitemap.xml`,
      message: "Sitemap source completed with partial page fetch failures.",
      finishedAt: summary.latestFailure.finishedAt,
      failureSummary: {
        code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
        failedStage: "source_fetch",
        retryable: false,
        message: "Sitemap source completed with partial page fetch failures."
      }
    });

    const askResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: `What unique marker appears in the reachable sitemap pages? Return ${sitemapMarker}`
      })
    });
    assert.equal(askResponse.status, 201);

    const askResult = await askResponse.json();
    assert.ok(askResult.retrievedChunks.some(chunk => chunk.content.includes(sitemapMarker)));
  } finally {
    server.kill("SIGTERM");
    await stopServer(sitemapServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Sitemap source E2E: partial child sitemap failure still reaches ready and persists child diagnostics", async () => {
  await resetTestState();

  const port = 3109;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-index-partial-source-${randomUUID()}`);
  const queuePrefix = `test-sitemap-index-partial-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const sitemapMarker = `sitemap-index-partial-marker-${randomUUID()}`;
  const sitemapServer = await startPartialChildFailureSitemapIndexServer(sitemapMarker);

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap-index.xml`,
        maxPages: 3
      })
    });
    assert.equal(createResponse.status, 201);

    const createdDocument = await createResponse.json();
    const readyDocument = await waitForDocumentReady(port, createdDocument.id, 20000);
    assert.equal(readyDocument.status, "ready");
    assert.deepEqual(readyDocument.diagnosticsJson, {
      code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
      failedStage: "source_fetch",
      retryable: true,
      documentVersion: readyDocument.version,
      message: "Sitemap source completed with partial child sitemap fetch failures.",
      attemptedPageCount: 2,
      succeededPageCount: 2,
      failedPageCount: 0,
      failedPageUrls: [],
      failedPages: [],
      failedPagesTruncated: false,
      failedPagesOmittedCount: 0,
      partial: true,
      attemptedChildSitemapCount: 2,
      succeededChildSitemapCount: 1,
      failedChildSitemapCount: 1,
      failedChildSitemapUrls: [`${sitemapServer.origin}/sitemaps/failing.xml`],
      failedChildSitemaps: [
        {
          url: `${sitemapServer.origin}/sitemaps/failing.xml`,
          code: "UPSTREAM_FETCH_FAILED",
          message: "Failed to fetch sitemap: upstream responded with 502.",
          retryable: true
        }
      ],
      failedChildSitemapsTruncated: false,
      failedChildSitemapsOmittedCount: 0
    });

    const runsResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs?includeDiagnostics=true`
    );
    assert.equal(runsResponse.status, 200);
    const runs = await runsResponse.json();
    assert.equal(runs[0].status, "ready");
    assert.deepEqual(runs[0].diagnosticsJson, readyDocument.diagnosticsJson);

    const summaryResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/document-runs/summary`);
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.retryableFailures, 1);
    assert.equal(summary.nonRetryableFailures, 0);
    assert.deepEqual(summary.latestRetryableFailure, {
      documentId: createdDocument.id,
      version: readyDocument.version,
      trigger: "external_resync",
      failedStage: "source_fetch",
      sourceType: "sitemap",
      sourceName: `${sitemapServer.origin}/sitemap-index.xml`,
      message: "Sitemap source completed with partial child sitemap fetch failures.",
      finishedAt: summary.latestRetryableFailure.finishedAt,
      failureSummary: {
        code: "EXTERNAL_SOURCE_PARTIAL_SUCCESS",
        failedStage: "source_fetch",
        retryable: true,
        message: "Sitemap source completed with partial child sitemap fetch failures."
      }
    });
    assert.deepEqual(summary.latestFailure, summary.latestRetryableFailure);

    const askResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: `What unique marker appears in the reachable sitemap index pages? Return ${sitemapMarker}`
      })
    });
    assert.equal(askResponse.status, 201);

    const askResult = await askResponse.json();
    assert.ok(askResult.retrievedChunks.some(chunk => chunk.content.includes(sitemapMarker)));
  } finally {
    server.kill("SIGTERM");
    await stopServer(sitemapServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Sitemap source E2E: partial page diagnostics clear after a later clean resync", async () => {
  await resetTestState();

  const port = 3113;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-partial-then-clean-${randomUUID()}`);
  const queuePrefix = `test-sitemap-partial-then-clean-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const initialMarker = `sitemap-partial-then-clean-initial-${randomUUID()}`;
  const cleanMarker = `sitemap-partial-then-clean-clean-${randomUUID()}`;
  const sitemapServer = await startRecoverablePartialSitemapServer(initialMarker, cleanMarker);

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap.xml`,
        maxPages: 3
      })
    });
    assert.equal(createResponse.status, 201);

    const createdDocument = await createResponse.json();
    const partialReadyDocument = await waitForDocumentReady(port, createdDocument.id, 20000);
    assert.equal(partialReadyDocument.status, "ready");
    assert.equal(partialReadyDocument.diagnosticsJson?.partial, true);

    sitemapServer.setClean();

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
            message: "Sitemap source completed with partial page fetch failures."
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
    await stopServer(sitemapServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Sitemap source E2E: partial child sitemap diagnostics clear after a later clean resync", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3115;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-index-partial-then-clean-${randomUUID()}`);
  const queuePrefix = `test-sitemap-index-partial-then-clean-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const initialMarker = `sitemap-index-partial-then-clean-initial-${randomUUID()}`;
  const cleanMarker = `sitemap-index-partial-then-clean-clean-${randomUUID()}`;
  const sitemapServer = await startRecoverablePartialChildSitemapIndexServer(initialMarker, cleanMarker);

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap-index.xml`,
        maxPages: 3
      })
    });
    assert.equal(createResponse.status, 201);

    const createdDocument = await createResponse.json();
    const partialReadyDocument = await waitForDocumentReady(port, createdDocument.id, 20000);
    assert.equal(partialReadyDocument.status, "ready");
    assert.equal(partialReadyDocument.diagnosticsJson?.partial, true);
    assert.equal(partialReadyDocument.diagnosticsJson?.failedChildSitemapCount, 1);

    sitemapServer.setClean();

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
            retryable: true,
            message: "Sitemap source completed with partial child sitemap fetch failures."
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
    await stopServer(sitemapServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Sitemap source E2E: same-URL reuse clears partial page diagnostics after a later clean sync", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3119;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-partial-reuse-clean-${randomUUID()}`);
  const queuePrefix = `test-sitemap-partial-reuse-clean-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const initialMarker = `sitemap-partial-reuse-initial-${randomUUID()}`;
  const cleanMarker = `sitemap-partial-reuse-clean-${randomUUID()}`;
  const sitemapServer = await startRecoverablePartialSitemapServer(initialMarker, cleanMarker);

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

    const firstCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap.xml#root`,
        maxPages: 3
      })
    });
    assert.equal(firstCreateResponse.status, 201);

    const firstDocument = await firstCreateResponse.json();
    const partialReadyDocument = await waitForDocumentReady(port, firstDocument.id, 20000);
    assert.equal(partialReadyDocument.status, "ready");
    assert.equal(partialReadyDocument.diagnosticsJson?.partial, true);

    sitemapServer.setClean();

    const secondCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap.xml`,
        maxPages: 3
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
            message: "Sitemap source completed with partial page fetch failures."
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
    await stopServer(sitemapServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Sitemap source E2E: same-URL reuse clears failed page diagnostics after a later successful sync", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3120;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-failed-reuse-recovered-${randomUUID()}`);
  const queuePrefix = `test-sitemap-failed-reuse-recovered-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const recoveredMarker = `sitemap-reuse-recovered-marker-${randomUUID()}`;
  const sitemapServer = await startRecoverableFailedSitemapServer(recoveredMarker);

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

    const firstCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap.xml#root`,
        maxPages: 2
      })
    });
    assert.equal(firstCreateResponse.status, 502);

    const failedDocumentsResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents`);
    assert.equal(failedDocumentsResponse.status, 200);
    const failedDocuments = await failedDocumentsResponse.json();
    assert.equal(failedDocuments.length, 1);
    assert.equal(failedDocuments[0].status, "failed");

    sitemapServer.setReady();

    const secondCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap.xml`,
        maxPages: 2
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
            message: "Failed to fetch sitemap pages: all sitemap pages failed."
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
          message: "Failed to fetch sitemap pages: all sitemap pages failed."
        }
      }
    );
  } finally {
    server.kill("SIGTERM");
    await stopServer(sitemapServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Sitemap source E2E: same-URL reuse clears failed child sitemap diagnostics after a later successful sync", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3121;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-index-failed-reuse-recovered-${randomUUID()}`);
  const queuePrefix = `test-sitemap-index-failed-reuse-recovered-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const recoveredMarker = `sitemap-index-reuse-recovered-marker-${randomUUID()}`;
  const sitemapServer = await startRecoverableFailedChildSitemapIndexServer(recoveredMarker);

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

    const firstCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap-index.xml#root`,
        maxPages: 2
      })
    });
    assert.equal(firstCreateResponse.status, 502);

    const failedDocumentsResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents`);
    assert.equal(failedDocumentsResponse.status, 200);
    const failedDocuments = await failedDocumentsResponse.json();
    assert.equal(failedDocuments.length, 1);
    assert.equal(failedDocuments[0].status, "failed");

    sitemapServer.setReady();

    const secondCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap-index.xml`,
        maxPages: 2
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
            message: "Failed to fetch sitemap index children: all child sitemap fetches failed."
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
          message: "Failed to fetch sitemap index children: all child sitemap fetches failed."
        }
      }
    );
  } finally {
    server.kill("SIGTERM");
    await stopServer(sitemapServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Sitemap source E2E: failed child sitemap fetch leaves a failed document with diagnostics", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3123;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-index-failed-source-${randomUUID()}`);
  const queuePrefix = `test-sitemap-index-failed-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const sitemapServer = await startRecoverableFailedChildSitemapIndexServer(`unused-marker-${randomUUID()}`);

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap-index.xml`,
        maxPages: 2
      })
    });
    assert.equal(createResponse.status, 502);

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
        sourceType: "sitemap",
        sourceName: `${sitemapServer.origin}/sitemap-index.xml`,
        status: "failed",
        processingStage: "failed",
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_FETCH_FAILED",
          failedStage: "source_fetch",
          retryable: true,
          documentVersion: 1,
          message: "Failed to fetch sitemap index children: all child sitemap fetches failed."
        }
      }
    );

    const detailResponse = await fetch(`http://localhost:${port}/documents/${documents[0].id}`);
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json();
    assert.equal(detail.errorMessage, "Failed to fetch sitemap index children: all child sitemap fetches failed.");
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
          retryable: true,
          message: "Failed to fetch sitemap index children: all child sitemap fetches failed."
        },
        diagnosticsJson: documents[0].diagnosticsJson
      }
    );

    const summaryResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/document-runs/summary`);
    assert.equal(summaryResponse.status, 200);
    const summary = await summaryResponse.json();
    assert.equal(summary.totalRuns, 1);
    assert.equal(summary.retryableFailures, 1);
    assert.equal(summary.nonRetryableFailures, 0);
    assert.deepEqual(summary.failureByStage, {
      source_fetch: 1
    });
    assert.deepEqual(summary.latestFailure, {
      documentId: documents[0].id,
      version: 1,
      trigger: "external_resync",
      failedStage: "source_fetch",
      sourceType: "sitemap",
      sourceName: `${sitemapServer.origin}/sitemap-index.xml`,
      message: "Failed to fetch sitemap index children: all child sitemap fetches failed.",
      finishedAt: summary.latestFailure.finishedAt,
      failureSummary: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: true,
        message: "Failed to fetch sitemap index children: all child sitemap fetches failed."
      }
    });
    assert.deepEqual(summary.latestRetryableFailure, summary.latestFailure);
  } finally {
    server.kill("SIGTERM");
    await stopServer(sitemapServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Sitemap source E2E: all-unsupported-page failure clears current diagnostics after a later successful sync", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3128;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-unsupported-recovery-${randomUUID()}`);
  const queuePrefix = `test-sitemap-unsupported-recovery-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const recoveredMarker = `sitemap-unsupported-recovered-marker-${randomUUID()}`;
  const sitemapServer = await startRecoverableUnsupportedSitemapServer(recoveredMarker);

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

    const failedCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap.xml`,
        maxPages: 2
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
      message: "Failed to fetch sitemap pages: all sitemap pages failed."
    });

    sitemapServer.setReady();

    const recoveredCreateResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap.xml`,
        maxPages: 2
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
          message: "Failed to fetch sitemap pages: all sitemap pages failed."
        }
      }
    );
  } finally {
    server.kill("SIGTERM");
    await stopServer(sitemapServer.server);
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Sitemap source E2E: all unsupported pages leave a failed document with non-retryable diagnostics", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3129;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-unsupported-source-${randomUUID()}`);
  const queuePrefix = `test-sitemap-unsupported-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const sitemapServer = await startRecoverableUnsupportedSitemapServer(`unused-marker-${randomUUID()}`);

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

    const createResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/sitemap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${sitemapServer.origin}/sitemap.xml`,
        maxPages: 2
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
        sourceType: "sitemap",
        sourceName: `${sitemapServer.origin}/sitemap.xml`,
        status: "failed",
        processingStage: "failed",
        diagnosticsJson: {
          code: "EXTERNAL_SOURCE_FETCH_FAILED",
          failedStage: "source_fetch",
          retryable: false,
          documentVersion: 1,
          message: "Failed to fetch sitemap pages: all sitemap pages failed."
        }
      }
    );

    const detailResponse = await fetch(`http://localhost:${port}/documents/${documents[0].id}`);
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json();
    assert.equal(detail.errorMessage, "Failed to fetch sitemap pages: all sitemap pages failed.");
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
          message: "Failed to fetch sitemap pages: all sitemap pages failed."
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
      sourceType: "sitemap",
      sourceName: `${sitemapServer.origin}/sitemap.xml`,
      message: "Failed to fetch sitemap pages: all sitemap pages failed.",
      finishedAt: summary.latestFailure.finishedAt,
      failureSummary: {
        code: "EXTERNAL_SOURCE_FETCH_FAILED",
        failedStage: "source_fetch",
        retryable: false,
        message: "Failed to fetch sitemap pages: all sitemap pages failed."
      }
    });
    assert.equal(summary.latestRetryableFailure, null);
  } finally {
    server.kill("SIGTERM");
    await stopServer(sitemapServer.server);
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

async function startSitemapServer(markerOrFactory) {
  const server = http.createServer((request, response) => {
    if (request.url === "/sitemap.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>http://127.0.0.1:${server.address().port}/pages/alpha</loc></url>
          <url><loc>http://127.0.0.1:${server.address().port}/pages/beta</loc></url>
        </urlset>`);
      return;
    }

    if (request.url === "/pages/alpha") {
      const marker = typeof markerOrFactory === "function" ? markerOrFactory() : markerOrFactory;
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Sitemap Alpha</title>
          </head>
          <body>
            <main>
              <h1>Sitemap Alpha</h1>
              <p>Unique marker: ${marker}</p>
            </main>
          </body>
        </html>`);
      return;
    }

    if (request.url === "/pages/beta") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Sitemap Beta</title>
          </head>
          <body>
            <main>
              <h1>Sitemap Beta</h1>
              <p>Background details for sitemap aggregation.</p>
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

async function startSitemapIndexServer(marker) {
  const server = http.createServer((request, response) => {
    if (request.url === "/sitemap-index.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>http://127.0.0.1:${server.address().port}/sitemaps/docs.xml</loc></sitemap>
          <sitemap><loc>http://127.0.0.1:${server.address().port}/sitemaps/blog.xml</loc></sitemap>
        </sitemapindex>`);
      return;
    }

    if (request.url === "/sitemaps/docs.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>http://127.0.0.1:${server.address().port}/docs/start</loc></url>
          <url><loc>http://127.0.0.1:${server.address().port}/docs/shared</loc></url>
        </urlset>`);
      return;
    }

    if (request.url === "/sitemaps/blog.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>http://127.0.0.1:${server.address().port}/docs/shared</loc></url>
          <url><loc>http://127.0.0.1:${server.address().port}/blog/post-a</loc></url>
        </urlset>`);
      return;
    }

    if (request.url === "/docs/start") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Docs Start</title>
          </head>
          <body>
            <main>
              <h1>Docs Start</h1>
              <p>Unique marker: ${marker}</p>
            </main>
          </body>
        </html>`);
      return;
    }

    if (request.url === "/docs/shared") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Docs Shared</title>
          </head>
          <body>
            <main>
              <h1>Docs Shared</h1>
              <p>Repeated page from sitemap index expansion.</p>
            </main>
          </body>
        </html>`);
      return;
    }

    if (request.url === "/blog/post-a") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Blog Post A</title>
          </head>
          <body>
            <main>
              <h1>Blog Post A</h1>
              <p>This page should be excluded when maxPages is 2.</p>
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

async function startPartialFailureSitemapServer(marker) {
  const server = http.createServer((request, response) => {
    if (request.url === "/sitemap.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>http://127.0.0.1:${server.address().port}/pages/alpha</loc></url>
          <url><loc>http://127.0.0.1:${server.address().port}/pages/failing</loc></url>
          <url><loc>http://127.0.0.1:${server.address().port}/pages/beta</loc></url>
        </urlset>`);
      return;
    }

    if (request.url === "/pages/alpha") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Partial Alpha</title>
          </head>
          <body>
            <main>
              <h1>Partial Alpha</h1>
              <p>Unique marker: ${marker}</p>
            </main>
          </body>
        </html>`);
      return;
    }

    if (request.url === "/pages/beta") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Partial Beta</title>
          </head>
          <body>
            <main>
              <h1>Partial Beta</h1>
              <p>Additional reachable page.</p>
            </main>
          </body>
        </html>`);
      return;
    }

    if (request.url === "/pages/failing") {
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

async function startPartialChildFailureSitemapIndexServer(marker) {
  const server = http.createServer((request, response) => {
    if (request.url === "/sitemap-index.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>http://127.0.0.1:${server.address().port}/sitemaps/good.xml</loc></sitemap>
          <sitemap><loc>http://127.0.0.1:${server.address().port}/sitemaps/failing.xml</loc></sitemap>
        </sitemapindex>`);
      return;
    }

    if (request.url === "/sitemaps/good.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>http://127.0.0.1:${server.address().port}/pages/alpha</loc></url>
          <url><loc>http://127.0.0.1:${server.address().port}/pages/beta</loc></url>
        </urlset>`);
      return;
    }

    if (request.url === "/sitemaps/failing.xml") {
      response.writeHead(502, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end("upstream failed");
      return;
    }

    if (request.url === "/pages/alpha") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Index Partial Alpha</title>
          </head>
          <body>
            <main>
              <h1>Index Partial Alpha</h1>
              <p>Unique marker: ${marker}</p>
            </main>
          </body>
        </html>`);
      return;
    }

    if (request.url === "/pages/beta") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Index Partial Beta</title>
          </head>
          <body>
            <main>
              <h1>Index Partial Beta</h1>
              <p>Additional reachable child sitemap page.</p>
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

async function startRecoverablePartialSitemapServer(initialMarker, cleanMarker) {
  let mode = "partial";

  const server = http.createServer((request, response) => {
    if (request.url === "/sitemap.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });

      const failingPageEntry =
        mode === "partial"
          ? `<url><loc>http://127.0.0.1:${server.address().port}/pages/failing</loc></url>`
          : "";

      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>http://127.0.0.1:${server.address().port}/pages/alpha</loc></url>
          ${failingPageEntry}
          <url><loc>http://127.0.0.1:${server.address().port}/pages/beta</loc></url>
        </urlset>`);
      return;
    }

    if (request.url === "/pages/alpha") {
      const marker = mode === "partial" ? initialMarker : cleanMarker;
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Recoverable Alpha</title>
          </head>
          <body>
            <main>
              <h1>Recoverable Alpha</h1>
              <p>Unique marker: ${marker}</p>
            </main>
          </body>
        </html>`);
      return;
    }

    if (request.url === "/pages/beta") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Recoverable Beta</title>
          </head>
          <body>
            <main>
              <h1>Recoverable Beta</h1>
              <p>Additional reachable page.</p>
            </main>
          </body>
        </html>`);
      return;
    }

    if (request.url === "/pages/failing") {
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

  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
    setClean() {
      mode = "clean";
    }
  };
}

async function startRecoverablePartialChildSitemapIndexServer(initialMarker, cleanMarker) {
  let mode = "partial";

  const server = http.createServer((request, response) => {
    if (request.url === "/sitemap-index.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });

      const childSitemapEntries =
        mode === "partial"
          ? `
            <sitemap><loc>http://127.0.0.1:${server.address().port}/sitemaps/good.xml</loc></sitemap>
            <sitemap><loc>http://127.0.0.1:${server.address().port}/sitemaps/failing.xml</loc></sitemap>
          `
          : `
            <sitemap><loc>http://127.0.0.1:${server.address().port}/sitemaps/good.xml</loc></sitemap>
            <sitemap><loc>http://127.0.0.1:${server.address().port}/sitemaps/clean.xml</loc></sitemap>
          `;

      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          ${childSitemapEntries}
        </sitemapindex>`);
      return;
    }

    if (request.url === "/sitemaps/good.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>http://127.0.0.1:${server.address().port}/pages/alpha</loc></url>
          <url><loc>http://127.0.0.1:${server.address().port}/pages/beta</loc></url>
        </urlset>`);
      return;
    }

    if (request.url === "/sitemaps/clean.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>http://127.0.0.1:${server.address().port}/pages/gamma</loc></url>
        </urlset>`);
      return;
    }

    if (request.url === "/sitemaps/failing.xml") {
      response.writeHead(502, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end("upstream failed");
      return;
    }

    if (request.url === "/pages/alpha") {
      const marker = mode === "partial" ? initialMarker : cleanMarker;
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Recoverable Child Alpha</title>
          </head>
          <body>
            <main>
              <h1>Recoverable Child Alpha</h1>
              <p>Unique marker: ${marker}</p>
            </main>
          </body>
        </html>`);
      return;
    }

    if (request.url === "/pages/beta" || request.url === "/pages/gamma") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Recoverable Child Page</title>
          </head>
          <body>
            <main>
              <h1>Recoverable Child Page</h1>
              <p>Additional reachable child sitemap page.</p>
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

  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
    setClean() {
      mode = "clean";
    }
  };
}

async function startRecoverableFailedSitemapServer(marker) {
  let mode = "failed";

  const server = http.createServer((request, response) => {
    if (request.url === "/sitemap.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });

      if (mode === "failed") {
        response.end(`<?xml version="1.0" encoding="UTF-8"?>
          <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url><loc>http://127.0.0.1:${server.address().port}/pages/failing-a</loc></url>
            <url><loc>http://127.0.0.1:${server.address().port}/pages/failing-b</loc></url>
          </urlset>`);
        return;
      }

      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>http://127.0.0.1:${server.address().port}/pages/alpha</loc></url>
          <url><loc>http://127.0.0.1:${server.address().port}/pages/beta</loc></url>
        </urlset>`);
      return;
    }

    if (request.url === "/pages/failing-a" || request.url === "/pages/failing-b") {
      response.writeHead(502, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end("temporary upstream failure");
      return;
    }

    if (request.url === "/pages/alpha") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Recovered Sitemap Alpha</title>
          </head>
          <body>
            <main>
              <h1>Recovered Sitemap Alpha</h1>
              <p>Unique marker: ${marker}</p>
            </main>
          </body>
        </html>`);
      return;
    }

    if (request.url === "/pages/beta") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Recovered Sitemap Beta</title>
          </head>
          <body>
            <main>
              <h1>Recovered Sitemap Beta</h1>
              <p>Recovered clean payload.</p>
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

  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
    setReady() {
      mode = "ready";
    }
  };
}

async function startRecoverableFailedChildSitemapIndexServer(marker) {
  let mode = "failed";

  const server = http.createServer((request, response) => {
    if (request.url === "/sitemap-index.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });

      if (mode === "failed") {
        response.end(`<?xml version="1.0" encoding="UTF-8"?>
          <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <sitemap><loc>http://127.0.0.1:${server.address().port}/sitemaps/failing-a.xml</loc></sitemap>
            <sitemap><loc>http://127.0.0.1:${server.address().port}/sitemaps/failing-b.xml</loc></sitemap>
          </sitemapindex>`);
        return;
      }

      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>http://127.0.0.1:${server.address().port}/sitemaps/good-a.xml</loc></sitemap>
          <sitemap><loc>http://127.0.0.1:${server.address().port}/sitemaps/good-b.xml</loc></sitemap>
        </sitemapindex>`);
      return;
    }

    if (request.url === "/sitemaps/failing-a.xml" || request.url === "/sitemaps/failing-b.xml") {
      response.writeHead(502, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      response.end("temporary upstream failure");
      return;
    }

    if (request.url === "/sitemaps/good-a.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>http://127.0.0.1:${server.address().port}/pages/alpha</loc></url>
        </urlset>`);
      return;
    }

    if (request.url === "/sitemaps/good-b.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>http://127.0.0.1:${server.address().port}/pages/beta</loc></url>
        </urlset>`);
      return;
    }

    if (request.url === "/pages/alpha") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Recovered Child Sitemap Alpha</title>
          </head>
          <body>
            <main>
              <h1>Recovered Child Sitemap Alpha</h1>
              <p>Unique marker: ${marker}</p>
            </main>
          </body>
        </html>`);
      return;
    }

    if (request.url === "/pages/beta") {
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
      });
      response.end(`<!doctype html>
        <html>
          <head>
            <title>Recovered Child Sitemap Beta</title>
          </head>
          <body>
            <main>
              <h1>Recovered Child Sitemap Beta</h1>
              <p>Recovered clean payload.</p>
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

  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
    setReady() {
      mode = "ready";
    }
  };
}

async function startRecoverableUnsupportedSitemapServer(marker) {
  let mode = "unsupported";

  const server = http.createServer((request, response) => {
    if (request.url === "/sitemap.xml") {
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8"
      });
      response.end(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>http://127.0.0.1:${server.address().port}/pages/alpha</loc></url>
          <url><loc>http://127.0.0.1:${server.address().port}/pages/beta</loc></url>
        </urlset>`);
      return;
    }

    if (request.url === "/pages/alpha" || request.url === "/pages/beta") {
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
            <title>Recovered Sitemap Page</title>
          </head>
          <body>
            <main>
              <h1>Recovered Sitemap Page</h1>
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

  return {
    server,
    origin: `http://127.0.0.1:${server.address().port}`,
    setReady() {
      mode = "ready";
    }
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
