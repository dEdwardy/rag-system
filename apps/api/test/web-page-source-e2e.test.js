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

  const pageMarker = `web-page-source-marker-${randomUUID()}`;
  const pageServer = await startWebPageServer(pageMarker);

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
