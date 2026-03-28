const assert = require("node:assert/strict");
const { test } = require("node:test");

const { DocumentsService } = require("../src/modules/documents/documents.service.ts");
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

test("KnowledgeBasesController scopes read and update calls by request identity", async () => {
  const calls = [];
  const controller = new KnowledgeBasesController({
    listKnowledgeBases: async identity => {
      calls.push({ type: "list", identity });
      return [];
    },
    getKnowledgeBase: async (id, identity) => {
      calls.push({ type: "get", id, identity });
      return { id };
    },
    updateKnowledgeBase: async (id, input, identity) => {
      calls.push({ type: "update", id, input, identity });
      return { id, ...input };
    }
  });

  const request = {
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

  await controller.listKnowledgeBases(request);
  await controller.getKnowledgeBase("kb-1", request);
  await controller.updateKnowledgeBase("kb-1", { name: "Updated name" }, request);

  assert.deepEqual(calls, [
    {
      type: "list",
      identity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    },
    {
      type: "get",
      id: "kb-1",
      identity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    },
    {
      type: "update",
      id: "kb-1",
      input: {
        name: "Updated name"
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

test("KnowledgeBasesService scopes list and get queries by owner identity", async () => {
  const calls = {
    list: [],
    get: []
  };

  const service = new KnowledgeBasesService({
    knowledgeBase: {
      findMany: async args => {
        calls.list.push(args);
        return [];
      },
      findUnique: async args => {
        calls.get.push(args);
        return {
          id: "kb-1",
          tenantId: "tenant-auth",
          ownerId: "user-auth"
        };
      }
    }
  });

  await service.listKnowledgeBases({ tenantId: "tenant-auth", userId: "user-auth" });
  await service.getKnowledgeBase("kb-1", { tenantId: "tenant-auth", userId: "user-auth" });

  assert.deepEqual(calls.list, [
    {
      where: {
        tenantId: "tenant-auth",
        ownerId: "user-auth"
      },
      orderBy: {
        createdAt: "desc"
      }
    }
  ]);
  assert.deepEqual(calls.get, [
    {
      where: {
        id: "kb-1"
      }
    }
  ]);
});

test("KnowledgeBasesService denies read detail when owner check fails", async () => {
  const service = new KnowledgeBasesService({
    knowledgeBase: {
      findUnique: async () => ({
        id: "kb-1",
        tenantId: "tenant-auth",
        ownerId: "user-other"
      })
    }
  });

  await assert.rejects(
    service.getKnowledgeBase("kb-1", { tenantId: "tenant-auth", userId: "user-auth" }),
    /Access blocked by owner_only_v1 policy \(owner_mismatch: resource owner does not match current user\)\./
  );
});

test("DocumentsService verifies document read access through knowledge-base owner check", async () => {
  const calls = {
    documentGet: [],
    knowledgeBaseGet: []
  };

  const service = new DocumentsService(
    {
      document: {
        findUnique: async args => {
          calls.documentGet.push(args);
          return {
            id: "doc-1",
            kbId: "kb-1"
          };
        }
      }
    },
    {
      getKnowledgeBase: async (id, scope) => {
        calls.knowledgeBaseGet.push({ id, scope });
        return { id };
      }
    },
    {},
    {},
    {},
    {},
    {},
    {},
    {}
  );

  await service.getDocument("doc-1", { tenantId: "tenant-auth", userId: "user-auth" });

  assert.deepEqual(calls.documentGet, [{ where: { id: "doc-1" } }]);
  assert.deepEqual(calls.knowledgeBaseGet, [
    {
      id: "kb-1",
      scope: {
        tenantId: "tenant-auth",
        userId: "user-auth"
      }
    }
  ]);
});
