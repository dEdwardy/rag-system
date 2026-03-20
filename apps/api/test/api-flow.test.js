const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { mkdirSync, rmSync } = require("node:fs");
const { resolve } = require("node:path");
const { PrismaClient } = require("@prisma/client");

const repoRoot = resolve(__dirname, "../../..");
const apiRoot = resolve(repoRoot, "apps/api");
const prisma = new PrismaClient();

test("API flow integration: upload -> ready -> ask -> trace", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3101;
  const storageRoot = resolve(repoRoot, "storage", `test-e2e-${randomUUID()}`);
  mkdirSync(storageRoot, { recursive: true });

  const server = spawn(process.execPath, ["apps/api/dist/main.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      API_PORT: String(port),
      STORAGE_ROOT: storageRoot
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

    const traceResponse = await fetch(`http://localhost:${port}/traces/${askResult.traceId}`);
    assert.equal(traceResponse.status, 200);

    const trace = await traceResponse.json();
    assert.equal(trace.status, "success");
    assert.ok(Array.isArray(trace.retrievedChunkIdsJson));
    assert.ok(Array.isArray(trace.citationsJson));
    assert.equal(typeof trace.rewrittenQuery === "string" || trace.rewrittenQuery === null, true);
    assert.ok(Array.isArray(trace.retrievalScoresJson));
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
