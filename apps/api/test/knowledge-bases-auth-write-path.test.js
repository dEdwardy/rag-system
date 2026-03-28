const assert = require("node:assert/strict");
const { test } = require("node:test");

const { KnowledgeBasesController } = require("../src/modules/knowledge-bases/knowledge-bases.controller.ts");
const { KnowledgeBasesService } = require("../src/modules/knowledge-bases/knowledge-bases.service.ts");

test("KnowledgeBasesController derives create identity from request auth context", async () => {
  const calls = [];
  const controller = new KnowledgeBasesController({
    createKnowledgeBase: async (input, identity) => {
      calls.push({ input, identity });
      return { id: "kb-1" };
    }
  });

  await controller.createKnowledgeBase(
    {
      name: "KB from auth",
      description: "desc",
      tenantId: "tenant-from-body",
      ownerId: "owner-from-body"
    },
    {
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
    }
  );

  assert.deepEqual(calls, [
    {
      input: {
        name: "KB from auth",
        description: "desc"
      },
      identity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    }
  ]);
});

test("KnowledgeBasesService writes tenantId and ownerId from current identity", async () => {
  const calls = {
    ensureTenant: [],
    ensureOwner: [],
    create: []
  };

  const service = new KnowledgeBasesService({
    tenant: {
      findUnique: async ({ where }) => {
        calls.ensureTenant.push(where);
        return { id: where.id };
      }
    },
    user: {
      findUnique: async ({ where }) => {
        calls.ensureOwner.push(where);
        return { id: where.id };
      }
    },
    knowledgeBase: {
      create: async args => {
        calls.create.push(args);
        return { id: "kb-1", ...args.data };
      }
    }
  });

  await service.createKnowledgeBase(
    {
      name: "Auth scoped KB",
      description: "desc"
    },
    {
      tenantId: "tenant-auth",
      userId: "user-auth"
    }
  );

  assert.deepEqual(calls.ensureTenant, [{ id: "tenant-auth" }]);
  assert.deepEqual(calls.ensureOwner, [{ id: "user-auth" }]);
  assert.deepEqual(calls.create, [
    {
      data: {
        name: "Auth scoped KB",
        description: "desc",
        tenantId: "tenant-auth",
        ownerId: "user-auth"
      }
    }
  ]);
});
