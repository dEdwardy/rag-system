import assert from "node:assert/strict";
import { test } from "vitest";

import { IndexingService } from "../src/modules/indexing/indexing.service.ts";

test("IndexingService forwards resolved embedding records to the vector store", async () => {
  const document = {
    id: "doc-1",
    kbId: "kb-1",
    version: 1,
    chunks: [
      {
        id: "chunk-1",
        chunkIndex: 0,
        sectionTitle: "Overview",
        pageNo: 1,
        content: "chunk body"
      }
    ]
  };
  const embedding = {
    provider: "fallback",
    model: "hash-v1",
    modelName: "fallback:hash-v1",
    dimensions: 3,
    provenance: {
      modelSource: "builtin:fallback",
      dimensionsSource: "builtin:fallback",
      fallback: "local_deterministic"
    },
    vector: [1, 0, 0]
  };

  const prisma = {
    document: {
      findUnique: async args => {
        if (args.select) {
          return { version: 1 };
        }

        return document;
      }
    },
    documentChunk: {
      update: async args => args
    },
    $transaction: async operations => Promise.all(operations)
  };
  const embeddingService = {
    embedTexts: async texts => {
      assert.deepEqual(texts, ["Overview\n\nchunk body"]);
      return [embedding];
    }
  };

  let replaceArgs = null;
  const vectorStoreService = {
    replaceDocumentVectors: async args => {
      replaceArgs = args;
    },
    deleteDocumentVectors: async () => {
      throw new Error("deleteDocumentVectors should not be called");
    }
  };

  const service = new IndexingService(prisma, embeddingService, vectorStoreService);
  await service.indexDocument("doc-1", 1);

  assert.ok(replaceArgs);
  assert.equal(replaceArgs.kbId, "kb-1");
  assert.equal(replaceArgs.documentId, "doc-1");
  assert.deepEqual(replaceArgs.records[0].embedding, embedding);
});

test("IndexingService does not replace vectors when the expected document version is stale", async () => {
  const document = {
    id: "doc-stale-replace-1",
    kbId: "kb-1",
    version: 1,
    chunks: [
      {
        id: "chunk-1",
        chunkIndex: 0,
        sectionTitle: "Overview",
        pageNo: 1,
        content: "chunk body"
      }
    ]
  };
  const embedding = {
    provider: "fallback",
    model: "hash-v1",
    modelName: "fallback:hash-v1",
    dimensions: 3,
    provenance: {
      modelSource: "builtin:fallback",
      dimensionsSource: "builtin:fallback",
      fallback: "local_deterministic"
    },
    vector: [1, 0, 0]
  };

  const chunkUpdates = [];
  const prisma = {
    document: {
      findUnique: async args => {
        if (args.select) {
          return { version: 2 };
        }

        return document;
      }
    },
    documentChunk: {
      update: async args => {
        chunkUpdates.push(args);
        return args;
      }
    },
    $transaction: async operations => Promise.all(operations)
  };
  const embeddingService = {
    embedTexts: async () => [embedding]
  };

  let replaceCalls = 0;
  let deleteCalls = 0;
  const vectorStoreService = {
    replaceDocumentVectors: async () => {
      replaceCalls += 1;
    },
    deleteDocumentVectors: async () => {
      deleteCalls += 1;
    }
  };

  const service = new IndexingService(prisma, embeddingService, vectorStoreService);
  await service.indexDocument("doc-stale-replace-1", 1);

  assert.equal(replaceCalls, 0);
  assert.equal(deleteCalls, 0);
  assert.deepEqual(chunkUpdates, []);
});

test("IndexingService does not delete vectors when the expected document version is stale", async () => {
  const document = {
    id: "doc-stale-delete-1",
    kbId: "kb-1",
    version: 1,
    chunks: []
  };

  const prisma = {
    document: {
      findUnique: async args => {
        if (args.select) {
          return { version: 2 };
        }

        return document;
      }
    },
    documentChunk: {
      update: async args => args
    },
    $transaction: async operations => Promise.all(operations)
  };
  const embeddingService = {
    embedTexts: async () => {
      throw new Error("embedTexts should not be called when there are no chunks");
    }
  };

  let replaceCalls = 0;
  let deleteCalls = 0;
  const vectorStoreService = {
    replaceDocumentVectors: async () => {
      replaceCalls += 1;
    },
    deleteDocumentVectors: async () => {
      deleteCalls += 1;
    }
  };

  const service = new IndexingService(prisma, embeddingService, vectorStoreService);
  await service.indexDocument("doc-stale-delete-1", 1);

  assert.equal(replaceCalls, 0);
  assert.equal(deleteCalls, 0);
});
