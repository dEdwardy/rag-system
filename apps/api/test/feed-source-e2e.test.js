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
