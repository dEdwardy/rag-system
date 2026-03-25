const assert = require("node:assert/strict");
const { IndexingService } = require("../src/modules/indexing/indexing.service.ts");

test("IndexingService forwards resolved embedding records to the vector store", async () => {
  const document = {
    id: "doc-1",
    kbId: "kb-1",
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
      findUnique: async () => document
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
  await service.indexDocument("doc-1");

  assert.ok(replaceArgs);
  assert.equal(replaceArgs.kbId, "kb-1");
  assert.equal(replaceArgs.documentId, "doc-1");
  assert.deepEqual(replaceArgs.records[0].embedding, embedding);
});
