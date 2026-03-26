const test = require("node:test");
const assert = require("node:assert/strict");
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

test("Retrieval profile filters can be cleared through PATCH", async () => {
  await resetTestState();

  const port = 3106;
  const storageRoot = resolve(repoRoot, "storage", `test-clear-filters-${randomUUID()}`);
  const queuePrefix = `test-clear-filters-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

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

    const setFiltersResponse = await fetch(
      `http://localhost:${port}/retrieval-profiles/default-retrieval-profile`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          filtersJson: {
            documentIds: ["doc-1"]
          }
        })
      }
    );
    assert.equal(setFiltersResponse.status, 200);

    const clearFiltersResponse = await fetch(
      `http://localhost:${port}/retrieval-profiles/default-retrieval-profile`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          filtersJson: null
        })
      }
    );

    assert.equal(clearFiltersResponse.status, 200);

    const clearedProfile = await clearFiltersResponse.json();
    assert.equal(clearedProfile.filtersJson, null);
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

test("Retrieval profile filters constrain ask retrieved chunks", async () => {
  await resetTestState();

  const port = 3102;
  const storageRoot = resolve(repoRoot, "storage", `test-filters-${randomUUID()}`);
  const queuePrefix = `test-filters-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

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
      documentIds: {
        include: [allowedDocument.id]
      }
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

test("Retrieval profile strategy filters accept richer operators and constrain ask retrieved chunks", async () => {
  await resetTestState();

  const port = 3104;
  const storageRoot = resolve(repoRoot, "storage", `test-filter-strategy-${randomUUID()}`);
  const queuePrefix = `test-filter-strategy-${randomUUID()}`;
  mkdirSync(storageRoot, { recursive: true });

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

    const allowedMarker = `spec-allowed-${randomUUID()}`;
    const blockedMarker = `spec-blocked-${randomUUID()}`;

    const allowedDocument = await uploadMarkdownDocument(
      port,
      "allowed-specs.md",
      `# Product\n\n## Technical Specs\n\nThis is the allowed spec section. ${allowedMarker}`
    );
    const blockedDocument = await uploadMarkdownDocument(
      port,
      "blocked-specs.md",
      `# Product\n\n## Technical Specs\n\nThis is the blocked spec section. ${blockedMarker}`
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
            documentIds: {
              exclude: [blockedDocument.id]
            },
            sectionTitles: {
              contains: ["spec"]
            }
          }
        })
      }
    );
    assert.equal(patchResponse.status, 200);

    const updatedProfile = await patchResponse.json();
    assert.deepEqual(updatedProfile.filtersJson, {
      documentIds: {
        exclude: [blockedDocument.id]
      },
      sectionTitles: {
        contains: ["spec"]
      }
    });

    const askResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: `Summarize the allowed spec marker ${allowedMarker} and ignore the blocked marker ${blockedMarker}`
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

function resolveBuiltApiEntry() {
  const preferredEntry = resolve(repoRoot, "apps/api/dist/apps/api/src/main.js");
  if (existsSync(preferredEntry)) {
    return preferredEntry;
  }

  return resolve(repoRoot, "apps/api/dist/main.js");
}
