const assert = require("node:assert/strict");
const { ConversationsService } = require("../src/modules/conversations/conversations.service.ts");

test("ConversationsService scopes list and lookup by identity when provided", async () => {
  const findManyCalls = [];
  const findUniqueCalls = [];

  const service = new ConversationsService({
    conversation: {
      findMany: async args => {
        findManyCalls.push(args);
        return [{ id: "conversation-1" }];
      },
      findUnique: async args => {
        findUniqueCalls.push(args);
        return { id: "conversation-1", tenantId: "tenant-42", userId: "user-42" };
      },
      update: async () => ({ id: "conversation-1" })
    }
  });

  await service.listConversations({
    tenantId: "tenant-42",
    userId: "user-42"
  });
  await service.getConversation("conversation-1", {
    tenantId: "tenant-42",
    userId: "user-42"
  });

  assert.deepEqual(findManyCalls, [
    {
      select: {
        id: true,
        tenantId: true,
        userId: true,
        assistantId: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      where: {
        tenantId: "tenant-42",
        userId: "user-42",
        status: "active"
      },
      orderBy: {
        updatedAt: "desc"
      }
    }
  ]);
  assert.deepEqual(findUniqueCalls, [
    {
      where: { id: "conversation-1" },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        assistantId: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    }
  ]);
});

test("ConversationsService returns not found for out-of-scope conversation lookup", async () => {
  const service = new ConversationsService({
    conversation: {
      findMany: async () => [],
      findUnique: async () => null,
      update: async () => {
        throw new Error("update should not be reached");
      }
    }
  });

  await assert.rejects(
    service.getConversation("conversation-missing", {
      tenantId: "tenant-42",
      userId: "user-42"
    }),
    /Conversation conversation-missing not found\./
  );
});

test("ConversationsService scopes conversation touch writes by owner identity", async () => {
  const findUniqueCalls = [];
  const updateCalls = [];
  const service = new ConversationsService({
    conversation: {
      findMany: async () => [],
      findUnique: async args => {
        findUniqueCalls.push(args);
        return { id: "conversation-1", tenantId: "tenant-42", userId: "user-42" };
      },
      update: async args => {
        updateCalls.push(args);
        return { id: "conversation-1" };
      }
    }
  });

  await service.touchConversation("conversation-1", {
    tenantId: "tenant-42",
    userId: "user-42"
  });

  assert.deepEqual(findUniqueCalls, [
    {
      where: { id: "conversation-1" },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        assistantId: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    }
  ]);
  assert.equal(updateCalls.length, 1);
  assert.deepEqual(updateCalls[0].where, {
    id: "conversation-1"
  });
  assert.equal(updateCalls[0].data.updatedAt instanceof Date, true);
});

test("ConversationsService blocks out-of-scope conversation touch writes", async () => {
  const updateCalls = [];
  const service = new ConversationsService({
    conversation: {
      findMany: async () => [],
      findUnique: async () => null,
      update: async args => {
        updateCalls.push(args);
        return { id: "conversation-1" };
      }
    }
  });

  await assert.rejects(
    service.touchConversation("conversation-1", {
      tenantId: "tenant-42",
      userId: "user-42"
    }),
    /Conversation conversation-1 not found\./
  );

  assert.equal(updateCalls.length, 0);
});

test("ConversationsService blocks conversation lookup when owner scope does not match", async () => {
  const service = new ConversationsService({
    conversation: {
      findMany: async () => [],
      findUnique: async () => ({ id: "conversation-1", tenantId: "tenant-42", userId: "user-other" }),
      update: async () => ({ id: "conversation-1" })
    }
  });

  await assert.rejects(
    service.getConversation("conversation-1", {
      tenantId: "tenant-42",
      userId: "user-42"
    }),
    /Conversation conversation-1 not found\./
  );
});
