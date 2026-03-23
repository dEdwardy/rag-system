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

test("Ask stream E2E: upload -> stream ask -> final payload", async () => {
  await resetTestState();

  const port = 3108;
  const storageRoot = resolve(repoRoot, "storage", `test-ask-stream-${randomUUID()}`);
  const queuePrefix = `test-ask-stream-${randomUUID()}`;
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

    const marker = `ask-stream-marker-${randomUUID()}`;
    const formData = new FormData();
    formData.set(
      "file",
      new Blob(
        [
          [
            "# Ask Stream Test",
            "",
            "The streamed ask response should eventually return a final payload.",
            `Unique marker: ${marker}`
          ].join("\n")
        ],
        { type: "text/markdown" }
      ),
      "ask-stream-test.md"
    );

    const uploadResponse = await fetch(`http://localhost:${port}/knowledge-bases/default-kb/documents/upload`, {
      method: "POST",
      body: formData
    });
    assert.equal(uploadResponse.status, 201);

    const uploadedDocument = await uploadResponse.json();
    await waitForDocumentReady(port, uploadedDocument.id, 20000);

    const streamResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/x-ndjson"
      },
      body: JSON.stringify({
        question: `What unique marker is in the document? Return ${marker}.`
      })
    });

    assert.equal(streamResponse.status, 200);
    assert.match(streamResponse.headers.get("content-type") ?? "", /application\/x-ndjson/i);

    const events = await readNdjsonEvents(streamResponse);

    assert.deepEqual(
      events.filter(event => event.type === "status").map(event => event.phase),
      ["started", "retrieving", "generating"]
    );

    const answerDeltas = events.filter(event => event.type === "answer_delta");
    assert.ok(answerDeltas.length > 0);

    const finalEvent = events.find(event => event.type === "final");
    assert.ok(finalEvent);
    assert.equal(typeof finalEvent.data?.conversationId, "string");
    assert.equal(typeof finalEvent.data?.traceId, "string");
    assert.equal(typeof finalEvent.data?.answer, "string");
    assert.ok(finalEvent.data.answer.includes(marker));
    assert.ok(Array.isArray(finalEvent.data.citations));
    assert.equal(events.at(-1)?.type, "final");
    assert.deepEqual(
      answerDeltas.map(event => event.delta).join(""),
      finalEvent.data.answer
    );
  } finally {
    server.kill("SIGTERM");
    rmSync(storageRoot, { recursive: true, force: true });
  }
});

test.after(async () => {
  await prisma.$disconnect();
});

async function readNdjsonEvents(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex < 0) {
        break;
      }

      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) {
        continue;
      }

      events.push(JSON.parse(line));
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    events.push(JSON.parse(trailing));
  }

  return events;
}

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
