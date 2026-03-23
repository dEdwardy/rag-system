const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { mkdirSync, rmSync } = require("node:fs");
const { resolve } = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { seedDefaultRecords } = require("./support/seed-default-records.js");

const repoRoot = resolve(__dirname, "../../..");
const apiRoot = resolve(repoRoot, "apps/api");
const prisma = new PrismaClient();

test.before(() => {
  seedDefaultRecords(apiRoot);
});

test("Retrieval profile strategyJson can disable query rewrite and force lexical retrieval", async () => {
  await resetTestState();

  const port = 3105;
  const storageRoot = resolve(repoRoot, "storage", `test-retrieval-strategy-${randomUUID()}`);
  const queuePrefix = `test-retrieval-strategy-${randomUUID()}`;
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

    const marker = `lexical-marker-${randomUUID()}`;
    const document = await uploadMarkdownDocument(
      port,
      "lexical-only.md",
      `# Product\n\n## Facts\n\nThis retrieval should work in lexical mode. ${marker}`
    );

    await waitForDocumentReady(port, document.id, 20000);

    const patchResponse = await fetch(
      `http://localhost:${port}/retrieval-profiles/default-retrieval-profile`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          strategyJson: {
            queryRewrite: {
              enabled: false
            },
            candidateSelection: {
              mode: "lexical",
              candidateMultiplier: 4,
              minCandidates: 6
            },
            rerank: {
              enabled: true
            }
          }
        })
      }
    );
    assert.equal(patchResponse.status, 200);

    const updatedProfile = await patchResponse.json();
    assert.deepEqual(updatedProfile.strategyJson, {
      queryRewrite: {
        enabled: false
      },
      candidateSelection: {
        mode: "lexical",
        candidateMultiplier: 4,
        minCandidates: 6
      },
      rerank: {
        enabled: true
      }
    });

    const askResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: `Where is the lexical marker ${marker}?`
      })
    });
    assert.equal(askResponse.status, 201);

    const askResult = await askResponse.json();
    assert.ok(askResult.retrievedChunks.some(chunk => chunk.content.includes(marker)));

    const traceResponse = await fetch(`http://localhost:${port}/traces/${askResult.traceId}`);
    assert.equal(traceResponse.status, 200);
    const trace = await traceResponse.json();
    assert.equal(trace.rewrittenQuery, null);
  } finally {
    server.kill("SIGTERM");
    rmSync(storageRoot, { recursive: true, force: true });
    await prisma.retrievalProfile.update({
      where: {
        id: "default-retrieval-profile"
      },
      data: {
        strategyJson: null
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
      strategyJson: null
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
