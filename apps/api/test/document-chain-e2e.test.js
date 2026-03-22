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

test("Document chain E2E: knowledge base -> upload -> ready -> chunks -> reindex -> delete", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3102;
  const storageRoot = resolve(repoRoot, "storage", `test-document-chain-${randomUUID()}`);
  const queuePrefix = `test-document-chain-${randomUUID()}`;
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

    const knowledgeBaseResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb`);
    assert.equal(knowledgeBaseResponse.status, 200);

    const knowledgeBase = await knowledgeBaseResponse.json();
    assert.equal(knowledgeBase.id, "default-kb");

    const listBeforeUploadResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/documents`
    );
    assert.equal(listBeforeUploadResponse.status, 200);

    const listBeforeUpload = await listBeforeUploadResponse.json();
    assert.deepEqual(listBeforeUpload, []);

    const marker = `document-chain-marker-${randomUUID()}`;
    const formData = new FormData();
    formData.set(
      "file",
      new Blob(
        [
          `# Document Chain Test\n\n## Facts\n\nDocument ingestion should reach ready status through the background queue. Reindex should preserve chunk retrieval. ${marker}`
        ],
        { type: "text/markdown" }
      ),
      "document-chain-test.md"
    );

    const uploadResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/upload`, {
      method: "POST",
      body: formData
    });
    assert.equal(uploadResponse.status, 201);

    const uploadedDocument = await uploadResponse.json();
    assert.equal(uploadedDocument.kbId, "default-kb");
    assert.equal(uploadedDocument.sourceName, "document-chain-test.md");
    assert.equal(uploadedDocument.version, 1);

    const readyDocument = await waitForDocumentReady(port, uploadedDocument.id, 20000);
    assert.equal(readyDocument.status, "ready");
    assert.equal(readyDocument.processingStage, "completed");
    assert.equal(readyDocument.errorMessage, null);
    assert.equal(typeof readyDocument.chunkCount, "number");
    assert.ok(readyDocument.chunkCount >= 1);

    const uploadRunsResponse = await fetch(`http://localhost:${port}/documents/${uploadedDocument.id}/runs`);
    assert.equal(uploadRunsResponse.status, 200);

    const uploadRuns = await uploadRunsResponse.json();
    assert.equal(uploadRuns.length, 1);
    assert.equal(uploadRuns[0].documentId, uploadedDocument.id);
    assert.equal(uploadRuns[0].version, 1);
    assert.equal(uploadRuns[0].trigger, "upload");
    assert.equal(uploadRuns[0].status, "ready");
    assert.equal(uploadRuns[0].failedStage, null);
    assert.equal(uploadRuns[0].diagnosticsJson, null);
    assert.ok(uploadRuns[0].startedAt);
    assert.ok(uploadRuns[0].finishedAt);

    const listAfterUploadResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/documents`
    );
    assert.equal(listAfterUploadResponse.status, 200);

    const listAfterUpload = await listAfterUploadResponse.json();
    assert.equal(listAfterUpload.length, 1);
    assert.equal(listAfterUpload[0].id, uploadedDocument.id);
    assert.equal(listAfterUpload[0].status, "ready");

    const chunksResponse = await fetch(`http://localhost:${port}/documents/${uploadedDocument.id}/chunks`);
    assert.equal(chunksResponse.status, 200);

    const chunks = await chunksResponse.json();
    assert.ok(Array.isArray(chunks));
    assert.ok(chunks.length >= 1);
    assert.ok(chunks.some(chunk => chunk.content.includes(marker)));

    const reindexResponse = await fetch(`http://localhost:${port}/documents/${uploadedDocument.id}/reindex`, {
      method: "POST"
    });
    assert.equal(reindexResponse.status, 201);

    const reindexResult = await reindexResponse.json();
    assert.equal(reindexResult.id, uploadedDocument.id);
    assert.equal(reindexResult.status, "pending");
    assert.equal(reindexResult.processingStage, "uploaded");
    assert.equal(reindexResult.version, 2);

    const readyAfterReindex = await waitForDocumentReady(port, uploadedDocument.id, 20000);
    assert.equal(readyAfterReindex.status, "ready");
    assert.equal(readyAfterReindex.processingStage, "completed");
    assert.ok(readyAfterReindex.chunkCount >= 1);
    assert.equal(readyAfterReindex.version, 2);

    const runsAfterReindexResponse = await fetch(`http://localhost:${port}/documents/${uploadedDocument.id}/runs`);
    assert.equal(runsAfterReindexResponse.status, 200);

    const runsAfterReindex = await runsAfterReindexResponse.json();
    assert.equal(runsAfterReindex.length, 2);
    assert.deepEqual(
      runsAfterReindex.map(run => ({
        version: run.version,
        trigger: run.trigger,
        status: run.status,
        failedStage: run.failedStage
      })),
      [
        {
          version: 2,
          trigger: "reindex",
          status: "ready",
          failedStage: null
        },
        {
          version: 1,
          trigger: "upload",
          status: "ready",
          failedStage: null
        }
      ]
    );
    assert.ok(runsAfterReindex.every(run => run.startedAt && run.finishedAt));

    const chunksAfterReindexResponse = await fetch(`http://localhost:${port}/documents/${uploadedDocument.id}/chunks`);
    assert.equal(chunksAfterReindexResponse.status, 200);

    const chunksAfterReindex = await chunksAfterReindexResponse.json();
    assert.ok(Array.isArray(chunksAfterReindex));
    assert.ok(chunksAfterReindex.some(chunk => chunk.content.includes(marker)));

    const deleteResponse = await fetch(`http://localhost:${port}/documents/${uploadedDocument.id}`, {
      method: "DELETE"
    });
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(await deleteResponse.json(), { success: true });

    const listAfterDeleteResponse = await fetch(
      `http://localhost:${port}/knowledge-bases/default-kb/documents`
    );
    assert.equal(listAfterDeleteResponse.status, 200);
    assert.deepEqual(await listAfterDeleteResponse.json(), []);

    const deletedDocumentResponse = await fetch(`http://localhost:${port}/documents/${uploadedDocument.id}`);
    assert.equal(deletedDocumentResponse.status, 404);

    const deletedChunksResponse = await fetch(`http://localhost:${port}/documents/${uploadedDocument.id}/chunks`);
    assert.equal(deletedChunksResponse.status, 404);
  } finally {
    server.kill("SIGTERM");
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test("Document chain E2E: unsupported upload records structured ingestion diagnostics", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3115;
  const storageRoot = resolve(repoRoot, "storage", `test-document-failure-${randomUUID()}`);
  const queuePrefix = `test-document-failure-${randomUUID()}`;
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

    const formData = new FormData();
    formData.set(
      "file",
      new Blob([Buffer.from([0xde, 0xad, 0xbe, 0xef])], { type: "application/octet-stream" }),
      "unsupported.bin"
    );

    const uploadResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/upload`, {
      method: "POST",
      body: formData
    });
    assert.equal(uploadResponse.status, 201);

    const uploadedDocument = await uploadResponse.json();
    const failedDocument = await waitForDocumentFailed(port, uploadedDocument.id, 20000);

    assert.equal(failedDocument.status, "failed");
    assert.equal(failedDocument.processingStage, "failed");
    assert.match(failedDocument.errorMessage, /Unsupported file type/);
    assert.deepEqual(failedDocument.diagnosticsJson, {
      code: "INGESTION_UNSUPPORTED_FILE_TYPE",
      failedStage: "parsing",
      retryable: false,
      documentVersion: 1,
      message: failedDocument.errorMessage
    });

    const failedRunsResponse = await fetch(`http://localhost:${port}/documents/${uploadedDocument.id}/runs`);
    assert.equal(failedRunsResponse.status, 200);

    const failedRuns = await failedRunsResponse.json();
    assert.equal(failedRuns.length, 1);
    assert.deepEqual(
      {
        documentId: failedRuns[0].documentId,
        version: failedRuns[0].version,
        trigger: failedRuns[0].trigger,
        status: failedRuns[0].status,
        failedStage: failedRuns[0].failedStage,
        diagnosticsJson: failedRuns[0].diagnosticsJson
      },
      {
        documentId: uploadedDocument.id,
        version: 1,
        trigger: "upload",
        status: "failed",
        failedStage: "parsing",
        diagnosticsJson: failedDocument.diagnosticsJson
      }
    );
    assert.ok(failedRuns[0].startedAt);
    assert.ok(failedRuns[0].finishedAt);
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

async function waitForDocumentFailed(port, documentId, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`http://localhost:${port}/documents/${documentId}`);
    if (response.ok) {
      const document = await response.json();
      if (document.status === "failed") {
        return document;
      }
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for document ${documentId} to fail.`);
}

function sleep(ms) {
  return new Promise(resolvePromise => {
    setTimeout(resolvePromise, ms);
  });
}
