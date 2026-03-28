const assert = require("node:assert/strict");
const { ConversationsService } = require("../src/modules/conversations/conversations.service.ts");

test("ConversationsService scopes list and lookup by identity when provided", async () => {
  const findManyCalls = [];
  const findFirstCalls = [];
  const findUniqueCalls = [];

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
      findUnique: async args => {
        findUniqueCalls.push(args);
        return { id: "conversation-2" };
      }
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
  await service.getConversation("conversation-2");

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
  assert.deepEqual(findUniqueCalls, [
    {
      where: {
        id: "conversation-2"
      }
    }
  ]);
});

test("ConversationsService returns not found for out-of-scope conversation lookup", async () => {
  const service = new ConversationsService({
    conversation: {
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null
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
