const assert = require("node:assert/strict");
const { test } = require("node:test");

const { DocumentsController } = require("../src/modules/documents/documents.controller.ts");
const { DocumentsService } = require("../src/modules/documents/documents.service.ts");

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

test("DocumentsController passes request identity to knowledge-base and document reads/writes", async () => {
  const calls = [];
  const controller = new DocumentsController({
    listKnowledgeBaseDocuments: async (knowledgeBaseId, input, identity) => {
      calls.push({ type: "list-kb-documents", knowledgeBaseId, input, identity });
      return [];
    },
    reindexKnowledgeBase: async (knowledgeBaseId, identity) => {
      calls.push({ type: "reindex-kb", knowledgeBaseId, identity });
      return { knowledgeBaseId, requestedCount: 0, documentIds: [] };
    },
    createDocument: async (knowledgeBaseId, input, identity) => {
      calls.push({ type: "create-document", knowledgeBaseId, input, identity });
      return { id: "document-1" };
    },
    getDocument: async (documentId, identity) => {
      calls.push({ type: "get-document", documentId, identity });
      return { id: documentId };
    }
  });

  const request = buildRequest();
  await controller.listKnowledgeBaseDocuments("kb-1", {}, request);
  await controller.reindexKnowledgeBase("kb-1", request);
  await controller.createDocument(
    "kb-1",
    {
      sourceType: "upload",
      sourceName: "notes.txt",
      title: "notes",
      mimeType: "text/plain",
      storageKey: "uploads/notes.txt"
    },
    request
  );
  await controller.getDocument("document-1", request);

  assert.deepEqual(calls, [
    {
      type: "list-kb-documents",
      knowledgeBaseId: "kb-1",
      input: {},
      identity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    },
    {
      type: "reindex-kb",
      knowledgeBaseId: "kb-1",
      identity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    },
    {
      type: "create-document",
      knowledgeBaseId: "kb-1",
      input: {
        sourceType: "upload",
        sourceName: "notes.txt",
        title: "notes",
        mimeType: "text/plain",
        storageKey: "uploads/notes.txt"
      },
      identity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    },
    {
      type: "get-document",
      documentId: "document-1",
      identity: {
        userId: "user-auth",
        tenantId: "tenant-auth",
        sessionId: "session-1",
        authSource: "session"
      }
    }
  ]);
});

test("DocumentsService reindexKnowledgeBase scopes KB access and requests each document reindex", async () => {
  const kbChecks = [];
  const listCalls = [];
  const reindexCalls = [];
  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    knowledgeBasesService: {
      getKnowledgeBase: async (knowledgeBaseId, scope) => {
        kbChecks.push({ knowledgeBaseId, scope });
        return { id: knowledgeBaseId };
      }
    },
    prisma: {
      document: {
        findMany: async args => {
          listCalls.push(args);
          return [{ id: "doc-2" }, { id: "doc-1" }];
        }
      }
    },
    reindexDocument: async documentId => {
      reindexCalls.push(documentId);
      return { id: documentId };
    }
  });

  const result = await DocumentsService.prototype.reindexKnowledgeBase.call(fakeService, "kb-1", {
    tenantId: "tenant-auth",
    userId: "user-auth"
  });

  assert.deepEqual(kbChecks, [
    {
      knowledgeBaseId: "kb-1",
      scope: {
        tenantId: "tenant-auth",
        userId: "user-auth"
      }
    }
  ]);
  assert.deepEqual(listCalls, [
    {
      where: {
        kbId: "kb-1"
      },
      select: {
        id: true
      },
      orderBy: {
        updatedAt: "desc"
      }
    }
  ]);
  assert.deepEqual(reindexCalls, ["doc-2", "doc-1"]);
  assert.deepEqual(result, {
    knowledgeBaseId: "kb-1",
    requestedCount: 2,
    documentIds: ["doc-2", "doc-1"]
  });
});

test("DocumentsService scopes getDocument by owning knowledge-base identity", async () => {
  const calls = {
    documentGet: [],
    knowledgeBaseGet: []
  };
  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        findUnique: async args => {
          calls.documentGet.push(args);
          return { id: "document-1", kbId: "kb-1" };
        }
      }
    },
    knowledgeBasesService: {
      getKnowledgeBase: async (knowledgeBaseId, scope) => {
        calls.knowledgeBaseGet.push({ knowledgeBaseId, scope });
        return { id: knowledgeBaseId };
      }
    }
  });

  const result = await DocumentsService.prototype.getDocument.call(fakeService, "document-1", {
    tenantId: "tenant-auth",
    userId: "user-auth"
  });

  assert.deepEqual(result, { id: "document-1", kbId: "kb-1" });
  assert.deepEqual(calls.documentGet, [
    {
      where: {
        id: "document-1"
      }
    }
  ]);
  assert.deepEqual(calls.knowledgeBaseGet, [
    {
      knowledgeBaseId: "kb-1",
      scope: {
        tenantId: "tenant-auth",
        userId: "user-auth"
      }
    }
  ]);
});

test("DocumentsService checks scoped knowledge-base access before listing documents", async () => {
  const kbChecks = [];
  const listCalls = [];
  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    knowledgeBasesService: {
      getKnowledgeBase: async (knowledgeBaseId, scope) => {
        kbChecks.push({ knowledgeBaseId, scope });
        return { id: knowledgeBaseId };
      }
    },
    prisma: {
      document: {
        findMany: async args => {
          listCalls.push(args);
          return [];
        }
      }
    }
  });

  await DocumentsService.prototype.listKnowledgeBaseDocuments.call(
    fakeService,
    "kb-1",
    {},
    { tenantId: "tenant-auth", userId: "user-auth" }
  );

  assert.deepEqual(kbChecks, [
    {
      knowledgeBaseId: "kb-1",
      scope: {
        tenantId: "tenant-auth",
        userId: "user-auth"
      }
    }
  ]);
  assert.deepEqual(listCalls, [
    {
      where: {
        kbId: "kb-1"
      },
      orderBy: {
        updatedAt: "desc"
      }
    }
  ]);
});

test("DocumentsService denies knowledge-base document list when owner scope check fails", async () => {
  const listCalls = [];
  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    knowledgeBasesService: {
      getKnowledgeBase: async () => {
        throw new Error("Access blocked by owner_only_v1 policy (owner_mismatch: resource owner does not match current user).");
      }
    },
    prisma: {
      document: {
        findMany: async args => {
          listCalls.push(args);
          return [];
        }
      }
    }
  });

  await assert.rejects(
    DocumentsService.prototype.listKnowledgeBaseDocuments.call(fakeService, "kb-1", {}, { tenantId: "tenant-auth", userId: "user-auth" }),
    /Access blocked by owner_only_v1 policy \(owner_mismatch: resource owner does not match current user\)\./
  );
  assert.deepEqual(listCalls, []);
});

test("DocumentsService denies document detail when owning knowledge-base access fails", async () => {
  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        findUnique: async () => ({ id: "document-1", kbId: "kb-1" })
      }
    },
    knowledgeBasesService: {
      getKnowledgeBase: async () => {
        throw new Error("Access blocked by owner_only_v1 policy (owner_mismatch: resource owner does not match current user).");
      }
    }
  });

  await assert.rejects(
    DocumentsService.prototype.getDocument.call(fakeService, "document-1", { tenantId: "tenant-auth", userId: "user-auth" }),
    /Access blocked by owner_only_v1 policy \(owner_mismatch: resource owner does not match current user\)\./
  );
});

test("DocumentsService denies document write create when owning knowledge-base access fails", async () => {
  const createCalls = [];
  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    knowledgeBasesService: {
      getKnowledgeBase: async () => {
        throw new Error("Access blocked by owner_only_v1 policy (owner_mismatch: resource owner does not match current user).");
      }
    },
    prisma: {
      document: {
        create: async args => {
          createCalls.push(args);
          return { id: "document-1" };
        }
      }
    }
  });

  await assert.rejects(
    DocumentsService.prototype.createDocument.call(
      fakeService,
      "kb-1",
      {
        sourceType: "upload",
        sourceName: "notes.txt",
        title: "notes",
        mimeType: "text/plain",
        storageKey: "uploads/notes.txt"
      },
      { tenantId: "tenant-auth", userId: "user-auth" }
    ),
    /Access blocked by owner_only_v1 policy \(owner_mismatch: resource owner does not match current user\)\./
  );
  assert.deepEqual(createCalls, []);
});
