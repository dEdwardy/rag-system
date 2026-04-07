const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ConversationsController } = require("../src/modules/conversations/conversations.controller.ts");

function buildRequest() {
  return {
    authContext: {
      identity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      },
      currentIdentity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    }
  };
}

test("ConversationsController skips conversation precheck when messages already resolve", async () => {
  const calls = [];
  const controller = new ConversationsController(
    {
      getConversation: async () => {
        calls.push("getConversation");
        return { id: "conversation-1" };
      }
    },
    {
      listConversationMessages: async () => {
        calls.push("listConversationMessages");
        return [{ id: "message-1" }];
      }
    },
    {
      listConversationTraces: async () => {
        calls.push("listConversationTraces");
        return [];
      }
    }
  );

  const result = await controller.listConversationMessages("conversation-1", buildRequest());

  assert.deepEqual(result, [{ id: "message-1" }]);
  assert.deepEqual(calls, ["listConversationMessages"]);
});

test("ConversationsController falls back to conversation precheck when messages are empty", async () => {
  const calls = [];
  const controller = new ConversationsController(
    {
      getConversation: async () => {
        calls.push("getConversation");
        return { id: "conversation-1" };
      }
    },
    {
      listConversationMessages: async () => {
        calls.push("listConversationMessages");
        return [];
      }
    },
    {
      listConversationTraces: async () => {
        calls.push("listConversationTraces");
        return [];
      }
    }
  );

  const result = await controller.listConversationMessages("conversation-1", buildRequest());

  assert.deepEqual(result, []);
  assert.deepEqual(calls, ["listConversationMessages", "getConversation"]);
});

test("ConversationsController falls back to conversation precheck when traces are empty", async () => {
  const calls = [];
  const controller = new ConversationsController(
    {
      getConversation: async () => {
        calls.push("getConversation");
        return { id: "conversation-1" };
      }
    },
    {
      listConversationMessages: async () => {
        calls.push("listConversationMessages");
        return [];
      }
    },
    {
      listConversationTraces: async () => {
        calls.push("listConversationTraces");
        return [];
      }
    }
  );

  const result = await controller.listConversationTraces("conversation-1", {}, buildRequest());

  assert.deepEqual(result, []);
  assert.deepEqual(calls, ["listConversationTraces", "getConversation"]);
});
