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

test("Sitemap source E2E: sitemap -> ready -> chunks -> ask -> reindex", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3106;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-source-${randomUUID()}`);
  const queuePrefix = `test-sitemap-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  let sitemapMarker = `sitemap-source-marker-${randomUUID()}`;
  const sitemapServer = await startSitemapServer(() => sitemapMarker);

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
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3107;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-index-source-${randomUUID()}`);
  const queuePrefix = `test-sitemap-index-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const sitemapMarker = `sitemap-index-marker-${randomUUID()}`;
  const sitemapServer = await startSitemapIndexServer(sitemapMarker);

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
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3108;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-partial-source-${randomUUID()}`);
  const queuePrefix = `test-sitemap-partial-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const sitemapMarker = `sitemap-partial-marker-${randomUUID()}`;
  const sitemapServer = await startPartialFailureSitemapServer(sitemapMarker);

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
      retryable: true,
      documentVersion: readyDocument.version,
      message: "Sitemap source completed with partial page fetch failures.",
      attemptedPageCount: 3,
      succeededPageCount: 2,
      failedPageCount: 1,
      failedPageUrls: [`${sitemapServer.origin}/pages/failing`],
      failedPages: [
        {
          url: `${sitemapServer.origin}/pages/failing`,
          message: "Unsupported web page content type: application/pdf.",
          retryable: false
        }
      ],
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
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3109;
  const storageRoot = resolve(repoRoot, "storage", `test-sitemap-index-partial-source-${randomUUID()}`);
  const queuePrefix = `test-sitemap-index-partial-source-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

  const sitemapMarker = `sitemap-index-partial-marker-${randomUUID()}`;
  const sitemapServer = await startPartialChildFailureSitemapIndexServer(sitemapMarker);

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
      message: "Sitemap source completed with partial page fetch failures.",
      attemptedPageCount: 2,
      succeededPageCount: 2,
      failedPageCount: 0,
      failedPageUrls: [],
      failedPages: [],
      partial: true,
      attemptedChildSitemapCount: 2,
      succeededChildSitemapCount: 1,
      failedChildSitemapCount: 1,
      failedChildSitemapUrls: [`${sitemapServer.origin}/sitemaps/failing.xml`],
      failedChildSitemaps: [
        {
          url: `${sitemapServer.origin}/sitemaps/failing.xml`,
          message: "Failed to fetch sitemap: upstream responded with 502.",
          retryable: true
        }
      ]
    });

    const runsResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/document-runs?includeDiagnostics=true`
    );
    assert.equal(runsResponse.status, 200);
    const runs = await runsResponse.json();
    assert.equal(runs[0].status, "ready");
    assert.deepEqual(runs[0].diagnosticsJson, readyDocument.diagnosticsJson);

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
