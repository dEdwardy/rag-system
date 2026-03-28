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

test("DocumentsService scopes getDocument by owning knowledge-base identity", async () => {
  const findCalls = [];
  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    prisma: {
      document: {
        findFirst: async args => {
          findCalls.push(args);
          return { id: "document-1" };
        }
      }
    }
  });

  const result = await DocumentsService.prototype.getDocument.call(fakeService, "document-1", {
    tenantId: "tenant-auth",
    userId: "user-auth"
  });

  assert.deepEqual(result, { id: "document-1" });
  assert.deepEqual(findCalls, [
    {
      where: {
        id: "document-1",
        knowledgeBase: {
          tenantId: "tenant-auth",
          ownerId: "user-auth"
        }
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
