const test = require("node:test");
const assert = require("node:assert/strict");
const { RetrievalService } = require("../dist/modules/retrieval/retrieval.service.js");

test("RetrievalService expands neighbor chunks when chunkWindow is enabled", async () => {
  const prisma = {
    documentChunk: {
      findMany: async args => {
        if (args.where.id?.in) {
          return [
            {
              id: "chunk-2",
              documentId: "doc-1",
              chunkIndex: 2,
              content: "main chunk",
              pageNo: null,
              sectionTitle: "Overview",
              document: { title: "Doc 1" }
            }
          ];
        }

        return [
          {
            id: "chunk-1",
            documentId: "doc-1",
            chunkIndex: 1,
            content: "prev chunk",
            pageNo: null,
            sectionTitle: "Overview",
            document: { title: "Doc 1" }
          },
          {
            id: "chunk-2",
            documentId: "doc-1",
            chunkIndex: 2,
            content: "main chunk",
            pageNo: null,
            sectionTitle: "Overview",
            document: { title: "Doc 1" }
          },
          {
            id: "chunk-3",
            documentId: "doc-1",
            chunkIndex: 3,
            content: "next chunk",
            pageNo: null,
            sectionTitle: "Overview",
            document: { title: "Doc 1" }
          }
        ];
      }
    }
  };

  const embeddingService = {
    embedQuery: async () => ({ vector: [1, 0] })
  };

  const vectorStoreService = {
    search: async () => [{ chunkId: "chunk-2", documentId: "doc-1", score: 0.9, modelName: "test" }]
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);
  const chunks = await service.retrieve({
    kbId: "kb-1",
    query: "test",
    topK: 1,
    scoreThreshold: 0,
    chunkWindow: 1
  });

  assert.deepEqual(
    chunks.map(chunk => chunk.chunkId),
    ["chunk-1", "chunk-2", "chunk-3"]
  );
  assert.equal(chunks[1].score, 0.9);
});

test("RetrievalService merges lexical matches when hybrid retrieval is enabled", async () => {
  const prisma = {
    documentChunk: {
      findMany: async args => {
        if (args.where.id?.in) {
          return [
            {
              id: "chunk-vector",
              documentId: "doc-1",
              chunkIndex: 0,
              content: "semantic neighbor",
              pageNo: null,
              sectionTitle: "Overview",
              document: { title: "Doc 1" }
            }
          ];
        }

        return [
          {
            id: "chunk-vector",
            documentId: "doc-1",
            chunkIndex: 0,
            content: "semantic neighbor",
            pageNo: null,
            sectionTitle: "Overview",
            document: { title: "Doc 1" }
          },
          {
            id: "chunk-lexical",
            documentId: "doc-2",
            chunkIndex: 0,
            content: "alpha alpha alpha exact match",
            pageNo: null,
            sectionTitle: "alpha",
            document: { title: "Doc 2" }
          }
        ];
      }
    }
  };

  const embeddingService = {
    embedQuery: async () => ({ vector: [1, 0] })
  };

  const vectorStoreService = {
    search: async () => [{ chunkId: "chunk-vector", documentId: "doc-1", score: 0.8, modelName: "test" }]
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);
  const chunks = await service.retrieve({
    kbId: "kb-1",
    query: "alpha exact",
    topK: 2,
    scoreThreshold: 0,
    enableHybrid: true
  });

  assert.deepEqual(
    chunks.map(chunk => chunk.chunkId),
    ["chunk-vector", "chunk-lexical"]
  );
});

test("RetrievalService reranks hybrid candidates using lexical relevance", async () => {
  const prisma = {
    documentChunk: {
      findMany: async args => {
        if (args.where.id?.in) {
          return [
            {
              id: "chunk-vector",
              documentId: "doc-1",
              chunkIndex: 0,
              content: "semantic neighbor",
              pageNo: null,
              sectionTitle: "Overview",
              document: { title: "Doc 1" }
            },
            {
              id: "chunk-lexical",
              documentId: "doc-2",
              chunkIndex: 0,
              content: "alpha phrase alpha phrase exact",
              pageNo: null,
              sectionTitle: "alpha phrase",
              document: { title: "Doc 2" }
            }
          ];
        }

        return [
          {
            id: "chunk-vector",
            documentId: "doc-1",
            chunkIndex: 0,
            content: "semantic neighbor",
            pageNo: null,
            sectionTitle: "Overview",
            document: { title: "Doc 1" }
          },
          {
            id: "chunk-lexical",
            documentId: "doc-2",
            chunkIndex: 0,
            content: "alpha phrase alpha phrase exact",
            pageNo: null,
            sectionTitle: "alpha phrase",
            document: { title: "Doc 2" }
          }
        ];
      }
    }
  };

  const embeddingService = {
    embedQuery: async () => ({ vector: [1, 0] })
  };

  const vectorStoreService = {
    search: async () => [
      { chunkId: "chunk-vector", documentId: "doc-1", score: 0.92, modelName: "test" },
      { chunkId: "chunk-lexical", documentId: "doc-2", score: 0.5, modelName: "test" }
    ]
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);
  const chunks = await service.retrieve({
    kbId: "kb-1",
    query: "alpha phrase exact",
    topK: 2,
    scoreThreshold: 0,
    enableHybrid: true,
    enableRerank: true
  });

  assert.equal(chunks[0].chunkId, "chunk-lexical");
  assert.ok(chunks[0].score > chunks[1].score);
});

test("RetrievalService limits lexical candidates to configured documentIds", async () => {
  const prisma = {
    documentChunk: {
      findMany: async args => {
        assert.deepEqual(args.where, {
          kbId: "kb-1",
          documentId: {
            in: ["doc-allowed"]
          }
        });

        return [
          {
            id: "chunk-allowed",
            documentId: "doc-allowed",
            chunkIndex: 0,
            content: "alpha exact match in allowed document",
            pageNo: 1,
            sectionTitle: "Allowed",
            document: { title: "Allowed Doc" }
          }
        ];
      }
    }
  };

  const embeddingService = {
    embedQuery: async () => {
      throw new Error("vector disabled");
    }
  };

  const vectorStoreService = {
    search: async () => []
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);
  const chunks = await service.retrieve({
    kbId: "kb-1",
    query: "alpha exact",
    topK: 2,
    scoreThreshold: 0,
    filters: {
      documentIds: ["doc-allowed"]
    }
  });

  assert.deepEqual(
    chunks.map(chunk => chunk.documentId),
    ["doc-allowed"]
  );
});

test("RetrievalService forwards page and section filters to vector search", async () => {
  const prisma = {
    documentChunk: {
      findMany: async args => {
        if (args.where.id?.in) {
          return [
            {
              id: "chunk-2",
              documentId: "doc-1",
              chunkIndex: 2,
              content: "filtered vector hit",
              pageNo: 3,
              sectionTitle: "Specs",
              document: { title: "Doc 1" }
            }
          ];
        }

        return [];
      }
    }
  };

  const embeddingService = {
    embedQuery: async () => ({ vector: [1, 0] })
  };

  let vectorSearchArgs = null;
  const vectorStoreService = {
    search: async args => {
      vectorSearchArgs = args;
      return [{ chunkId: "chunk-2", documentId: "doc-1", score: 0.9, modelName: "test" }];
    }
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);
  const chunks = await service.retrieve({
    kbId: "kb-1",
    query: "specs",
    topK: 1,
    scoreThreshold: 0,
    filters: {
      sectionTitles: ["Specs"],
      pageNumbers: [3]
    }
  });

  assert.deepEqual(vectorSearchArgs.filters, {
    sectionTitles: ["Specs"],
    pageNumbers: [3]
  });
  assert.equal(chunks[0].chunkId, "chunk-2");
});

test("RetrievalService fallback remains inside configured filter scope", async () => {
  let callCount = 0;
  const prisma = {
    documentChunk: {
      findMany: async args => {
        callCount += 1;

        assert.deepEqual(args.where, {
          kbId: "kb-1",
          documentId: {
            in: ["doc-allowed"]
          }
        });

        return [
          {
            id: "chunk-allowed",
            documentId: "doc-allowed",
            chunkIndex: 0,
            content: "irrelevant but still scoped",
            pageNo: null,
            sectionTitle: "Allowed",
            document: { title: "Allowed Doc" }
          }
        ];
      }
    }
  };

  const embeddingService = {
    embedQuery: async () => {
      throw new Error("vector disabled");
    }
  };

  const vectorStoreService = {
    search: async () => []
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);
  const chunks = await service.retrieve({
    kbId: "kb-1",
    query: "term not present anywhere",
    topK: 1,
    scoreThreshold: 99,
    filters: {
      documentIds: ["doc-allowed"]
    }
  });

  assert.equal(callCount >= 2, true);
  assert.deepEqual(
    chunks.map(chunk => chunk.documentId),
    ["doc-allowed"]
  );
});
