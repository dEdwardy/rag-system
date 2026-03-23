const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { resolve } = require("node:path");
const { PrismaClient } = require("@prisma/client");
const { seedDefaultRecords } = require("./support/seed-default-records.js");

const repoRoot = resolve(__dirname, "../../..");
const apiRoot = resolve(repoRoot, "apps/api");
const prisma = new PrismaClient();

test.before(() => {
  seedDefaultRecords(apiRoot);
});

test("Assistant API accepts valid answerPolicyJson and rejects invalid policy values", async () => {
  await resetTestState();

  const port = 3103;
  const queuePrefix = `test-assistants-${randomUUID()}`;

  const server = spawn(process.execPath, ["apps/api/dist/main.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      API_PORT: String(port),
      QUEUE_PREFIX: queuePrefix
    },
    stdio: "ignore"
  });

  try {
    await waitForHealth(port, 20000);

    const validPolicy = {
      responseStyle: "balanced",
      tone: "friendly",
      outputFormat: "bullets",
      language: "same_as_question",
      citationMode: "required",
      maxCitations: 2,
      noAnswerBehavior: "say_insufficient_context",
      includeMissingInformation: false
    };

    const patchResponse = await fetch(`http://localhost:${port}/assistants/default-assistant`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        answerPolicyJson: validPolicy
      })
    });
    assert.equal(patchResponse.status, 200);

    const patchedAssistant = await patchResponse.json();
    assert.deepEqual(patchedAssistant.answerPolicyJson, validPolicy);

    const invalidPatchResponse = await fetch(`http://localhost:${port}/assistants/default-assistant`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        answerPolicyJson: {
          ...validPolicy,
          outputFormat: "table"
        }
      })
    });
    assert.equal(invalidPatchResponse.status, 400);
  } finally {
    server.kill("SIGTERM");
    await prisma.assistant.update({
      where: {
        id: "default-assistant"
      },
      data: {
        answerPolicyJson: null
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
  await prisma.assistant.updateMany({
    data: {
      answerPolicyJson: null
    }
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

function sleep(ms) {
  return new Promise(resolvePromise => {
    setTimeout(resolvePromise, ms);
  });
}
