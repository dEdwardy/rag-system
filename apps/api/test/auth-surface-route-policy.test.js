const assert = require("node:assert/strict");
const { test } = require("node:test");
require("reflect-metadata");

const { AUTH_ROUTE_POLICY_KEY } = require("../src/modules/auth/auth-route-policy.ts");
const { AssistantsController } = require("../src/modules/assistants/assistants.controller.ts");
const { ConversationsController } = require("../src/modules/conversations/conversations.controller.ts");
const { RetrievalProfilesController } = require("../src/modules/retrieval-profiles/retrieval-profiles.controller.ts");
const { TracesController } = require("../src/modules/traces/traces.controller.ts");

test("assistant, conversation, trace, and retrieval-profile controllers require authenticated routes", () => {
  const protectedControllers = [
    AssistantsController,
    ConversationsController,
    TracesController,
    RetrievalProfilesController
  ];

  for (const controller of protectedControllers) {
    assert.equal(Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, controller), "authenticated");
  }
});
