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

test("Retrieval profile filters constrain ask retrieved chunks", async () => {
  await resetTestState();
  execFileSync(process.execPath, ["prisma/seed.js"], {
    cwd: apiRoot,
    stdio: "pipe"
  });

  const port = 3102;
  const storageRoot = resolve(repoRoot, "storage", `test-filters-${randomUUID()}`);
  const queuePrefix = `test-filters-${randomUUID()}`;
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

    const allowedMarker = `allowed-${randomUUID()}`;
    const blockedMarker = `blocked-${randomUUID()}`;

    const allowedDocument = await uploadMarkdownDocument(
      port,
      "allowed.md",
      `# Allowed\n\n## Facts\n\nThis is the allowed document. ${allowedMarker}`
    );
    const blockedDocument = await uploadMarkdownDocument(
      port,
      "blocked.md",
      `# Blocked\n\n## Facts\n\nThis is the blocked document. ${blockedMarker}`
    );

    await waitForDocumentReady(port, allowedDocument.id, 20000);
    await waitForDocumentReady(port, blockedDocument.id, 20000);

    const patchResponse = await fetch(
      `http://localhost:${port}/retrieval-profiles/default-retrieval-profile`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topK: 3,
          filtersJson: {
            documentIds: [allowedDocument.id]
          }
        })
      }
    );
    assert.equal(patchResponse.status, 200);

    const updatedProfile = await patchResponse.json();
    assert.deepEqual(updatedProfile.filtersJson, {
      documentIds: [allowedDocument.id]
    });

    const askResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: `Compare the allowed marker ${allowedMarker} and blocked marker ${blockedMarker}`
      })
    });
    assert.equal(askResponse.status, 201);

    const askResult = await askResponse.json();
    assert.ok(Array.isArray(askResult.retrievedChunks));
    assert.ok(askResult.retrievedChunks.length >= 1);
    assert.ok(askResult.retrievedChunks.every(chunk => chunk.documentId === allowedDocument.id));
    assert.ok(askResult.retrievedChunks.some(chunk => chunk.content.includes(allowedMarker)));
    assert.ok(askResult.retrievedChunks.every(chunk => !chunk.content.includes(blockedMarker)));
  } finally {
    server.kill("SIGTERM");
    rmSync(storageRoot, { recursive: true, force: true });
    await prisma.retrievalProfile.update({
      where: {
        id: "default-retrieval-profile"
      },
      data: {
        filtersJson: null
      }
    }).catch(() => {});
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
  await prisma.retrievalProfile.updateMany({
    data: {
      filtersJson: null
    }
  });
}

async function uploadMarkdownDocument(port, filename, content) {
  const formData = new FormData();
  formData.set("file", new Blob([content], { type: "text/markdown" }), filename);

  const response = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/upload`, {
    method: "POST",
    body: formData
  });
  assert.equal(response.status, 201);

  return response.json();
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
