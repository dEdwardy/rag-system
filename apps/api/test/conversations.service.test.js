const assert = require("node:assert/strict");
const { ConversationsService } = require("../src/modules/conversations/conversations.service.ts");

test("ConversationsService scopes list and lookup by identity when provided", async () => {
  const findManyCalls = [];
  const findFirstCalls = [];

  const service = new ConversationsService({
    conversation: {
      findMany: async args => {
        findManyCalls.push(args);
        return [{ id: "conversation-1" }];
      },
      findFirst: async args => {
        findFirstCalls.push(args);
        return { id: "conversation-1" };
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
      where: {
        tenantId: "tenant-42",
        userId: "user-42"
      },
      orderBy: {
        updatedAt: "desc"
      }
    }
  ]);
  assert.deepEqual(findFirstCalls, [
    {
      where: {
        id: "conversation-1",
        tenantId: "tenant-42",
        userId: "user-42"
      }
    }
  ]);
});

test("ConversationsService returns not found for out-of-scope conversation lookup", async () => {
  const service = new ConversationsService({
    conversation: {
      findMany: async () => [],
      findFirst: async () => null,
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
  const findFirstCalls = [];
  const updateCalls = [];
  const service = new ConversationsService({
    conversation: {
      findMany: async () => [],
      findFirst: async args => {
        findFirstCalls.push(args);
        return { id: "conversation-1" };
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

  assert.deepEqual(findFirstCalls, [
    {
      where: {
        id: "conversation-1",
        tenantId: "tenant-42",
        userId: "user-42"
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
      findFirst: async () => null,
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
