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
    assert.equal(foreignGetResponse.status, 403);
    const foreignGetPayload = await foreignGetResponse.json();
    assert.match(
      String(foreignGetPayload.message ?? ""),
      /Access blocked by owner_only_v1 policy \(owner_mismatch: resource owner does not match current user\)\./
    );

    const foreignPatchResponse = await fetch(`http://localhost:${port}/assistants/${foreignAssistantId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "should-not-update"
      })
    });
    assert.equal(foreignPatchResponse.status, 403);
    const foreignPatchPayload = await foreignPatchResponse.json();
    assert.match(
      String(foreignPatchPayload.message ?? ""),
      /Access blocked by owner_only_v1 policy \(owner_mismatch: resource owner does not match current user\)\./
    );

    const persistedForeignAssistant = await prisma.assistant.findUnique({
      where: {
        id: foreignAssistantId
      },
      select: {
        name: true
      }
    });
    assert.equal(persistedForeignAssistant?.name, "Assistant ACL foreign assistant");

    const foreignAskResponse = await fetch(`http://localhost:${port}/assistants/${foreignAssistantId}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: "Should fail by owner ACL before retrieval"
      })
    });
    assert.equal(foreignAskResponse.status, 403);
    const foreignAskPayload = await foreignAskResponse.json();
    assert.match(
      String(foreignAskPayload.message ?? ""),
      /Access blocked by owner_only_v1 policy \(owner_mismatch: resource owner does not match current user\)\./
    );

    const foreignAskStreamResponse = await fetch(`http://localhost:${port}/assistants/${foreignAssistantId}/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: "Should fail by owner ACL before retrieval"
      })
    });
    assert.equal(foreignAskStreamResponse.status, 403);
    const foreignAskStreamPayload = await foreignAskStreamResponse.json();
    assert.match(
      String(foreignAskStreamPayload.message ?? ""),
      /Access blocked by owner_only_v1 policy \(owner_mismatch: resource owner does not match current user\)\./
    );

    const deniedConversationCount = await prisma.conversation.count({
      where: {
        assistantId: foreignAssistantId
      }
    });
    assert.equal(deniedConversationCount, 0);
  } finally {
    server.kill("SIGTERM");
    await prisma.assistant.deleteMany({ where: { id: foreignAssistantId } }).catch(() => {});
    await prisma.knowledgeBase.deleteMany({ where: { id: foreignKbId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: foreignUserId } }).catch(() => {});
  }
});

test("Assistant ask and ask-stream both return explicit 401 denial when unauthenticated", async () => {
  await resetTestState();

  const port = 3113;
  const queuePrefix = `test-assistants-unauth-${randomUUID()}`;

  const server = spawn(process.execPath, [apiDistEntry], {
    cwd: repoRoot,
    env: {
      ...process.env,
      API_PORT: String(port),
      QUEUE_PREFIX: queuePrefix,
      AUTH_DEV_DEFAULT_USER_MODE: "false"
    },
    stdio: "ignore"
  });

  try {
    await waitForHealth(port, 20000);

    const askResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: "Should fail without auth identity"
      })
    });
    assert.equal(askResponse.status, 401);
    const askPayload = await askResponse.json();
    assert.match(String(askPayload.message ?? ""), /Authentication required\./);

    const askStreamResponse = await fetch(`http://localhost:${port}/assistants/default-assistant/ask/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question: "Should fail without auth identity"
      })
    });
    assert.equal(askStreamResponse.status, 401);
    const askStreamPayload = await askStreamResponse.json();
    assert.match(String(askStreamPayload.message ?? ""), /Authentication required\./);

    const deniedConversationCount = await prisma.conversation.count();
    assert.equal(deniedConversationCount, 0);
  } finally {
    server.kill("SIGTERM");
  }
});

test("Conversation and trace APIs enforce owner scope on list/detail linked reads", async () => {
  await resetTestState();

  const ownConversationId = `conversation-acl-own-${randomUUID()}`;
  const ownUserMessageId = `conversation-acl-own-user-message-${randomUUID()}`;
  const ownAssistantMessageId = `conversation-acl-own-assistant-message-${randomUUID()}`;
  const ownTraceId = `conversation-acl-own-trace-${randomUUID()}`;

  const foreignUserId = `conversation-acl-user-${randomUUID()}`;
  const foreignKbId = `conversation-acl-kb-${randomUUID()}`;
  const foreignAssistantId = `conversation-acl-assistant-${randomUUID()}`;
  const foreignConversationId = `conversation-acl-foreign-${randomUUID()}`;
  const foreignUserMessageId = `conversation-acl-foreign-user-message-${randomUUID()}`;
  const foreignAssistantMessageId = `conversation-acl-foreign-assistant-message-${randomUUID()}`;
  const foreignTraceId = `conversation-acl-foreign-trace-${randomUUID()}`;

  await prisma.user.create({
    data: {
      id: foreignUserId,
      tenantId: "default-tenant",
      name: "Conversation ACL foreign owner"
    }
  });
  await prisma.knowledgeBase.create({
    data: {
      id: foreignKbId,
      tenantId: "default-tenant",
      ownerId: foreignUserId,
      name: "Conversation ACL foreign KB",
      description: "owner-scoped conversation and trace access test"
    }
  });
  await prisma.assistant.create({
    data: {
      id: foreignAssistantId,
      tenantId: "default-tenant",
      kbId: foreignKbId,
      name: "Conversation ACL foreign assistant",
      systemPrompt: "You should not be visible to the default owner.",
      retrievalProfileId: "default-retrieval-profile"
    }
  });

  await prisma.conversation.create({
    data: {
      id: ownConversationId,
      tenantId: "default-tenant",
      userId: "default-user",
      assistantId: "default-assistant",
      title: "Conversation ACL owned"
    }
  });
  await prisma.message.createMany({
    data: [
      {
        id: ownUserMessageId,
        conversationId: ownConversationId,
        role: "user",
        content: "owned-user-message",
        traceId: ownTraceId
      },
      {
        id: ownAssistantMessageId,
        conversationId: ownConversationId,
        role: "assistant",
        content: "owned-assistant-message",
        traceId: ownTraceId
      }
    ]
  });
  await prisma.answerTrace.create({
    data: {
      id: ownTraceId,
      conversationId: ownConversationId,
      assistantId: "default-assistant",
      userMessageId: ownUserMessageId,
      assistantMessageId: ownAssistantMessageId,
      userQuery: "owned-query",
      status: "success"
    }
  });

  await prisma.conversation.create({
    data: {
      id: foreignConversationId,
      tenantId: "default-tenant",
      userId: foreignUserId,
      assistantId: foreignAssistantId,
      title: "Conversation ACL foreign"
    }
  });
  await prisma.message.createMany({
    data: [
      {
        id: foreignUserMessageId,
        conversationId: foreignConversationId,
        role: "user",
        content: "foreign-user-message",
        traceId: foreignTraceId
      },
      {
        id: foreignAssistantMessageId,
        conversationId: foreignConversationId,
        role: "assistant",
        content: "foreign-assistant-message",
        traceId: foreignTraceId
      }
    ]
  });
  await prisma.answerTrace.create({
    data: {
      id: foreignTraceId,
      conversationId: foreignConversationId,
      assistantId: foreignAssistantId,
      userMessageId: foreignUserMessageId,
      assistantMessageId: foreignAssistantMessageId,
      userQuery: "foreign-query",
      status: "success"
    }
  });

  const port = 3105;
  const queuePrefix = `test-conversation-trace-acl-${randomUUID()}`;

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

    const conversationsListResponse = await fetch(`http://localhost:${port}/conversations`);
    assert.equal(conversationsListResponse.status, 200);
    const conversations = await conversationsListResponse.json();
    assert.ok(Array.isArray(conversations));
    assert.ok(conversations.some(conversation => conversation.id === ownConversationId));
    assert.ok(conversations.every(conversation => conversation.id !== foreignConversationId));

    const ownConversationResponse = await fetch(`http://localhost:${port}/conversations/${ownConversationId}`);
    assert.equal(ownConversationResponse.status, 200);

    const foreignConversationResponse = await fetch(`http://localhost:${port}/conversations/${foreignConversationId}`);
    assert.equal(foreignConversationResponse.status, 404);

    const foreignMessagesResponse = await fetch(`http://localhost:${port}/conversations/${foreignConversationId}/messages`);
    assert.equal(foreignMessagesResponse.status, 404);

    const foreignConversationTracesResponse = await fetch(
      `http://localhost:${port}/conversations/${foreignConversationId}/traces`
    );
    assert.equal(foreignConversationTracesResponse.status, 404);

    const tracesListResponse = await fetch(`http://localhost:${port}/traces`);
    assert.equal(tracesListResponse.status, 200);
    const traces = await tracesListResponse.json();
    assert.ok(Array.isArray(traces));
    assert.ok(traces.some(trace => trace.id === ownTraceId));
    assert.ok(traces.every(trace => trace.id !== foreignTraceId));

    const ownTraceResponse = await fetch(`http://localhost:${port}/traces/${ownTraceId}`);
    assert.equal(ownTraceResponse.status, 200);

    const foreignTraceResponse = await fetch(`http://localhost:${port}/traces/${foreignTraceId}`);
    assert.equal(foreignTraceResponse.status, 404);
  } finally {
    server.kill("SIGTERM");
    await prisma.answerTrace.deleteMany({ where: { id: { in: [ownTraceId, foreignTraceId] } } }).catch(() => {});
    await prisma.message.deleteMany({ where: { id: { in: [ownUserMessageId, ownAssistantMessageId, foreignUserMessageId, foreignAssistantMessageId] } } }).catch(() => {});
    await prisma.conversation.deleteMany({ where: { id: { in: [ownConversationId, foreignConversationId] } } }).catch(() => {});
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
