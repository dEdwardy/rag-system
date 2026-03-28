const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { existsSync } = require("node:fs");
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

test("Assistant API accepts valid answerPolicyJson and rejects invalid policy values", async () => {
  await resetTestState();

  const port = 3103;
  const queuePrefix = `test-assistants-${randomUUID()}`;

  const server = spawn(process.execPath, [apiDistEntry], {
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

test("Assistant API scopes list/get/update and ask routes to current owner identity", async () => {
  await resetTestState();

  const foreignUserId = `assistant-acl-user-${randomUUID()}`;
  const foreignKbId = `assistant-acl-kb-${randomUUID()}`;
  const foreignAssistantId = `assistant-acl-assistant-${randomUUID()}`;

  await prisma.user.create({
    data: {
      id: foreignUserId,
      tenantId: "default-tenant",
      name: "Assistant ACL foreign owner"
    }
  });
  await prisma.knowledgeBase.create({
    data: {
      id: foreignKbId,
      tenantId: "default-tenant",
      ownerId: foreignUserId,
      name: "Assistant ACL foreign KB",
      description: "owner-scoped assistant access test"
    }
  });
  await prisma.assistant.create({
    data: {
      id: foreignAssistantId,
      tenantId: "default-tenant",
      kbId: foreignKbId,
      name: "Assistant ACL foreign assistant",
      systemPrompt: "You should not be visible to the default owner.",
      retrievalProfileId: "default-retrieval-profile"
    }
  });

  const port = 3104;
  const queuePrefix = `test-assistants-acl-${randomUUID()}`;

  const server = spawn(process.execPath, [apiDistEntry], {
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

    const listResponse = await fetch(`http://localhost:${port}/assistants`);
    assert.equal(listResponse.status, 200);
    const listPayload = await listResponse.json();
    assert.ok(Array.isArray(listPayload));
    assert.ok(listPayload.some(assistant => assistant.id === "default-assistant"));
    assert.ok(listPayload.every(assistant => assistant.id !== foreignAssistantId));

    const foreignGetResponse = await fetch(`http://localhost:${port}/assistants/${foreignAssistantId}`);
    assert.equal(foreignGetResponse.status, 404);

    const foreignPatchResponse = await fetch(`http://localhost:${port}/assistants/${foreignAssistantId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "should-not-update"
      })
    });
    assert.equal(foreignPatchResponse.status, 404);

    const foreignAskResponse = await fetch(`http://localhost:${port}/assistants/${foreignAssistantId}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: "Should fail by owner ACL before retrieval"
      })
    });
    assert.equal(foreignAskResponse.status, 404);

    const foreignAskStreamResponse = await fetch(`http://localhost:${port}/assistants/${foreignAssistantId}/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: "Should fail by owner ACL before retrieval"
      })
    });
    assert.equal(foreignAskStreamResponse.status, 200);
    const streamPayload = await foreignAskStreamResponse.text();
    const firstEventLine = streamPayload
      .split("\n")
      .map(line => line.trim())
      .find(Boolean);
    assert.ok(firstEventLine, "Expected one streamed event line");
    const firstEvent = JSON.parse(firstEventLine);
    assert.equal(firstEvent.type, "error");
    assert.match(String(firstEvent.message ?? ""), /not found/i);
  } finally {
    server.kill("SIGTERM");
    await prisma.assistant.deleteMany({ where: { id: foreignAssistantId } }).catch(() => {});
    await prisma.knowledgeBase.deleteMany({ where: { id: foreignKbId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: foreignUserId } }).catch(() => {});
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

function resolveBuiltApiEntry() {
  const preferredEntry = resolve(repoRoot, "apps/api/dist/apps/api/src/main.js");
  if (existsSync(preferredEntry)) {
    return preferredEntry;
  }

  return resolve(repoRoot, "apps/api/dist/main.js");
}
