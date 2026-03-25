const assert = require("node:assert/strict");
const { RetrievalService } = require("../src/modules/retrieval/retrieval.service.ts");
const { VectorStoreCompatibilityError } = require("../src/infra/vector-store/vector-store.types.ts");
const { resolveRetrievalStrategy } = require("../src/modules/retrieval-profiles/retrieval-profile.schemas.ts");

test("resolveRetrievalStrategy uses canonical vector defaults when strategyJson is present", () => {
  const strategy = resolveRetrievalStrategy({
    topK: 4,
    enableHybrid: true,
    enableRerank: true,
    strategyJson: {
      queryRewrite: {
        enabled: false
      }
    }
  });

  assert.deepEqual(strategy, {
    queryRewrite: {
      enabled: false
    },
    candidateSelection: {
      mode: "vector",
      candidateMultiplier: 3,
      minCandidates: 4
    },
    hybrid: {
      vectorWeight: 0.7,
      lexicalWeight: 0.3
    },
    rerank: {
      enabled: false
    }
  });
});

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
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "test",
    topK: 1,
    scoreThreshold: 0,
    chunkWindow: 1
  });
  const chunks = result.retrievedChunks;

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
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "alpha exact",
    topK: 2,
    scoreThreshold: 0,
    enableHybrid: true
  });
  const chunks = result.retrievedChunks;

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
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "alpha phrase exact",
    topK: 2,
    scoreThreshold: 0,
    enableHybrid: true,
    enableRerank: true
  });
  const chunks = result.retrievedChunks;

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
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "alpha exact",
    topK: 2,
    scoreThreshold: 0,
    filters: {
      documentIds: ["doc-allowed"]
    }
  });
  const chunks = result.retrievedChunks;

  assert.deepEqual(
    chunks.map(chunk => chunk.documentId),
    ["doc-allowed"]
  );
});

test("RetrievalService forwards page and section filters to vector search", async () => {
  const queryEmbedding = {
    provider: "fallback",
    model: "hash-v1",
    modelName: "fallback:hash-v1",
    dimensions: 2,
    provenance: {
      modelSource: "builtin:fallback",
      dimensionsSource: "builtin:fallback",
      fallback: "local_deterministic"
    },
    vector: [1, 0]
  };
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
    embedQuery: async () => queryEmbedding
  };

  let vectorSearchArgs = null;
  const vectorStoreService = {
    search: async args => {
      vectorSearchArgs = args;
      return [{ chunkId: "chunk-2", documentId: "doc-1", score: 0.9, modelName: "test" }];
    }
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "specs",
    topK: 1,
    scoreThreshold: 0,
    filters: {
      sectionTitles: ["Specs"],
      pageNumbers: [3]
    }
  });
  const chunks = result.retrievedChunks;

  assert.deepEqual(vectorSearchArgs.filters, {
    sectionTitles: {
      include: ["Specs"]
    },
    pageNumbers: {
      include: [3]
    }
  });
  assert.deepEqual(vectorSearchArgs.queryEmbedding, queryEmbedding);
  assert.equal(chunks[0].chunkId, "chunk-2");
});

test("RetrievalService returns no chunks when all filtered candidates miss the score threshold", async () => {
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
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "term not present anywhere",
    topK: 1,
    scoreThreshold: 99,
    filters: {
      documentIds: ["doc-allowed"]
    }
  });
  const chunks = result.retrievedChunks;

  assert.equal(callCount, 1);
  assert.deepEqual(chunks, []);
  assert.deepEqual(result.contextGroups, []);
});

test("RetrievalService compiles section-title contains filters for lexical retrieval", async () => {
  const prisma = {
    documentChunk: {
      findMany: async args => {
        assert.deepEqual(args.where, {
          kbId: "kb-1",
          sectionTitle: {
            contains: "spec",
            mode: "insensitive"
          }
        });

        return [
          {
            id: "chunk-specs",
            documentId: "doc-1",
            chunkIndex: 0,
            content: "specification details",
            pageNo: 3,
            sectionTitle: "Technical Specs",
            document: { title: "Doc 1" }
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
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "specification",
    topK: 1,
    scoreThreshold: 0,
    filters: {
      sectionTitles: {
        contains: ["spec"]
      }
    }
  });
  const chunks = result.retrievedChunks;

  assert.equal(chunks[0].chunkId, "chunk-specs");
});

test("RetrievalService returns no chunks when page-filtered candidates all miss the score threshold", async () => {
  let callCount = 0;
  const prisma = {
    documentChunk: {
      findMany: async args => {
        callCount += 1;
        assert.deepEqual(args.where, {
          kbId: "kb-1",
          pageNo: {
            gte: 2,
            lte: 4
          },
          NOT: [
            {
              documentId: {
                in: ["doc-blocked"]
              }
            }
          ]
        });

        return [
          {
            id: "chunk-allowed",
            documentId: "doc-allowed",
            chunkIndex: 0,
            content: "page constrained chunk",
            pageNo: 3,
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
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "page constrained",
    topK: 1,
    scoreThreshold: 99,
    filters: {
      documentIds: {
        exclude: ["doc-blocked"]
      },
      pageNumbers: {
        min: 2,
        max: 4
      }
    }
  });
  const chunks = result.retrievedChunks;

  assert.equal(callCount, 1);
  assert.deepEqual(chunks, []);
  assert.deepEqual(result.contextGroups, []);
});

test("RetrievalService groups contiguous expanded chunks into one context group", async () => {
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
              pageNo: 2,
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
            pageNo: 1,
            sectionTitle: "Overview",
            document: { title: "Doc 1" }
          },
          {
            id: "chunk-2",
            documentId: "doc-1",
            chunkIndex: 2,
            content: "main chunk",
            pageNo: 2,
            sectionTitle: "Overview",
            document: { title: "Doc 1" }
          },
          {
            id: "chunk-3",
            documentId: "doc-1",
            chunkIndex: 3,
            content: "next chunk",
            pageNo: 2,
            sectionTitle: "Details",
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
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "test",
    topK: 1,
    scoreThreshold: 0,
    chunkWindow: 1
  });

  assert.equal(Array.isArray(result.contextGroups), true);
  assert.equal(result.contextGroups.length, 1);
  assert.deepEqual(result.contextGroups[0], {
    documentId: "doc-1",
    documentTitle: "Doc 1",
    startChunkIndex: 1,
    endChunkIndex: 3,
    chunkIds: ["chunk-1", "chunk-2", "chunk-3"],
    primaryChunkIds: ["chunk-2"],
    mergedContent: "prev chunk\n\nmain chunk\n\nnext chunk",
    pageNumbers: [1, 2],
    sectionTitles: ["Overview", "Details"]
  });
});

test("RetrievalService keeps non-contiguous expanded chunks in separate context groups", async () => {
  const prisma = {
    documentChunk: {
      findMany: async args => {
        if (args.where.id?.in) {
          return [
            {
              id: "chunk-2",
              documentId: "doc-1",
              chunkIndex: 2,
              content: "primary one",
              pageNo: 1,
              sectionTitle: "Overview",
              document: { title: "Doc 1" }
            },
            {
              id: "chunk-5",
              documentId: "doc-1",
              chunkIndex: 5,
              content: "primary two",
              pageNo: 2,
              sectionTitle: "Details",
              document: { title: "Doc 1" }
            }
          ];
        }

        return [
          {
            id: "chunk-1",
            documentId: "doc-1",
            chunkIndex: 1,
            content: "neighbor one",
            pageNo: 1,
            sectionTitle: "Overview",
            document: { title: "Doc 1" }
          },
          {
            id: "chunk-2",
            documentId: "doc-1",
            chunkIndex: 2,
            content: "primary one",
            pageNo: 1,
            sectionTitle: "Overview",
            document: { title: "Doc 1" }
          },
          {
            id: "chunk-5",
            documentId: "doc-1",
            chunkIndex: 5,
            content: "primary two",
            pageNo: 2,
            sectionTitle: "Details",
            document: { title: "Doc 1" }
          },
          {
            id: "chunk-6",
            documentId: "doc-1",
            chunkIndex: 6,
            content: "neighbor two",
            pageNo: 2,
            sectionTitle: "Details",
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
    search: async () => [
      { chunkId: "chunk-2", documentId: "doc-1", score: 0.95, modelName: "test" },
      { chunkId: "chunk-5", documentId: "doc-1", score: 0.85, modelName: "test" }
    ]
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "test",
    topK: 2,
    scoreThreshold: 0,
    chunkWindow: 1
  });

  assert.equal(result.contextGroups.length, 2);
  assert.deepEqual(
    result.contextGroups.map(group => ({
      startChunkIndex: group.startChunkIndex,
      endChunkIndex: group.endChunkIndex,
      primaryChunkIds: group.primaryChunkIds
    })),
    [
      {
        startChunkIndex: 1,
        endChunkIndex: 2,
        primaryChunkIds: ["chunk-2"]
      },
      {
        startChunkIndex: 5,
        endChunkIndex: 6,
        primaryChunkIds: ["chunk-5"]
      }
    ]
  );
});

test("RetrievalService skips vector retrieval when strategy mode is lexical", async () => {
  let embedCalls = 0;
  let vectorCalls = 0;

  const prisma = {
    documentChunk: {
      findMany: async () => [
        {
          id: "chunk-lexical",
          documentId: "doc-1",
          chunkIndex: 0,
          content: "lexical only marker",
          pageNo: null,
          sectionTitle: "Overview",
          document: { title: "Doc 1" }
        }
      ]
    }
  };

  const embeddingService = {
    embedQuery: async () => {
      embedCalls += 1;
      return { vector: [1, 0] };
    }
  };

  const vectorStoreService = {
    search: async () => {
      vectorCalls += 1;
      return [];
    }
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "lexical only marker",
    topK: 1,
    scoreThreshold: 0,
    strategy: {
      queryRewrite: {
        enabled: true
      },
      candidateSelection: {
        mode: "lexical",
        candidateMultiplier: 3,
        minCandidates: 1
      },
      hybrid: {
        vectorWeight: 0.7,
        lexicalWeight: 0.3
      },
      rerank: {
        enabled: false
      }
    }
  });

  assert.equal(embedCalls, 0);
  assert.equal(vectorCalls, 0);
  assert.equal(result.retrievedChunks[0].chunkId, "chunk-lexical");
  assert.deepEqual(result.execution, {
    actualMode: "lexical",
    usedFallback: false,
    fallbackReason: null,
    rerankApplied: false,
    chunkWindowApplied: false,
    vectorSearchAttempted: false,
    lexicalSearchAttempted: true,
    vectorCandidateLimitHit: false,
    lexicalCandidateLimitHit: false,
    rankingTopKHit: true,
    candidateLimit: 3,
    vectorCandidateCount: 0,
    lexicalCandidateCount: 1,
    mergedCandidateCount: 1,
    rankedCandidateCount: 1
  });
});

test("RetrievalService reports lexical fallback when vector retrieval cannot produce candidates", async () => {
  const prisma = {
    documentChunk: {
      findMany: async () => [
        {
          id: "chunk-lexical",
          documentId: "doc-1",
          chunkIndex: 0,
          content: "lexical fallback marker",
          pageNo: null,
          sectionTitle: "Overview",
          document: { title: "Doc 1" }
        }
      ]
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
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "lexical fallback marker",
    topK: 1,
    scoreThreshold: 0
  });

  assert.equal(result.retrievedChunks[0].chunkId, "chunk-lexical");
  assert.deepEqual(result.execution, {
    actualMode: "lexical",
    usedFallback: true,
    fallbackReason: "vector_error",
    rerankApplied: false,
    chunkWindowApplied: false,
    vectorSearchAttempted: true,
    lexicalSearchAttempted: true,
    vectorCandidateLimitHit: false,
    lexicalCandidateLimitHit: false,
    rankingTopKHit: true,
    candidateLimit: 3,
    vectorCandidateCount: 0,
    lexicalCandidateCount: 1,
    mergedCandidateCount: 1,
    rankedCandidateCount: 1
  });
});

test("RetrievalService fails clearly instead of lexical fallback when embedding config is incompatible with indexed vectors", async () => {
  let lexicalReads = 0;
  const prisma = {
    documentChunk: {
      findMany: async () => {
        lexicalReads += 1;
        return [
          {
            id: "chunk-lexical",
            documentId: "doc-1",
            chunkIndex: 0,
            content: "lexical fallback marker",
            pageNo: null,
            sectionTitle: "Overview",
            document: { title: "Doc 1" }
          }
        ];
      }
    }
  };

  const embeddingService = {
    embedQuery: async () => ({
      provider: "fallback",
      model: "hash-v1",
      modelName: "fallback:hash-v1",
      dimensions: 256,
      provenance: {
        modelSource: "builtin:fallback",
        dimensionsSource: "builtin:fallback",
        fallback: "local_deterministic"
      },
      vector: [1, 0]
    })
  };

  const vectorStoreService = {
    search: async () => {
      throw new VectorStoreCompatibilityError(
        'Embedding index compatibility error for knowledge base "kb-1": Active retrieval embedding config fallback:hash-v1 (256d) (fallback=local_deterministic) is incompatible with indexed vectors openai:text-embedding-3-small (1536d) across 2 document(s). Reindex this knowledge base with one embedding config before continuing.'
      );
    }
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);

  await assert.rejects(
    service.retrieve({
      kbId: "kb-1",
      query: "lexical fallback marker",
      topK: 1,
      scoreThreshold: 0
    }),
    error => {
      assert.ok(error instanceof VectorStoreCompatibilityError);
      assert.match(error.message, /Embedding index compatibility error/);
      assert.match(error.message, /fallback:hash-v1/);
      assert.match(error.message, /openai:text-embedding-3-small/);
      return true;
    }
  );

  assert.equal(lexicalReads, 0);
});

test("RetrievalService reports empty-ranking fallback when vector retrieval yields no ranked candidates", async () => {
  const prisma = {
    documentChunk: {
      findMany: async args => (args.where.id?.in ? [] : [])
    }
  };

  const embeddingService = {
    embedQuery: async () => ({ vector: [1, 0] })
  };

  const vectorStoreService = {
    search: async () => []
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "no matches",
    topK: 1,
    scoreThreshold: 0
  });

  assert.deepEqual(result.retrievedChunks, []);
  assert.deepEqual(result.execution, {
    actualMode: "lexical",
    usedFallback: true,
    fallbackReason: "no_ranked_candidates",
    rerankApplied: false,
    chunkWindowApplied: false,
    vectorSearchAttempted: true,
    lexicalSearchAttempted: true,
    vectorCandidateLimitHit: false,
    lexicalCandidateLimitHit: false,
    rankingTopKHit: false,
    candidateLimit: 3,
    vectorCandidateCount: 0,
    lexicalCandidateCount: 0,
    mergedCandidateCount: 0,
    rankedCandidateCount: 0
  });
});

test("RetrievalService preserves vector candidate diagnostics when ranked vector candidates fall back to lexical", async () => {
  const prisma = {
    documentChunk: {
      findMany: async args => {
        if (args.where.id?.in) {
          return [
            {
              id: "chunk-vector-1",
              documentId: "doc-1",
              chunkIndex: 0,
              content: "vector candidate one",
              pageNo: null,
              sectionTitle: "Overview",
              document: { title: "Doc 1" }
            },
            {
              id: "chunk-vector-2",
              documentId: "doc-2",
              chunkIndex: 0,
              content: "vector candidate two",
              pageNo: null,
              sectionTitle: "Overview",
              document: { title: "Doc 2" }
            }
          ];
        }

        return [
          {
            id: "chunk-lexical",
            documentId: "doc-3",
            chunkIndex: 0,
            content: "lexical fallback marker lexical fallback marker",
            pageNo: null,
            sectionTitle: "lexical fallback marker",
            document: { title: "Doc 3" }
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
      { chunkId: "chunk-vector-1", score: 0.91 },
      { chunkId: "chunk-vector-2", score: 0.89 }
    ]
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "lexical fallback marker",
    topK: 1,
    scoreThreshold: 5
  });

  assert.deepEqual(result.retrievedChunks.map(chunk => chunk.chunkId), ["chunk-lexical"]);
  assert.deepEqual(result.execution, {
    actualMode: "lexical",
    usedFallback: true,
    fallbackReason: "no_ranked_candidates",
    rerankApplied: false,
    chunkWindowApplied: false,
    vectorSearchAttempted: true,
    lexicalSearchAttempted: true,
    vectorCandidateLimitHit: false,
    lexicalCandidateLimitHit: false,
    rankingTopKHit: true,
    candidateLimit: 3,
    vectorCandidateCount: 2,
    lexicalCandidateCount: 1,
    mergedCandidateCount: 1,
    rankedCandidateCount: 1
  });
});

test("RetrievalService hybrid ranking honors configured strategy weights", async () => {
  const prisma = {
    documentChunk: {
      findMany: async args => {
        if (args.where.id?.in) {
          return [
            {
              id: "chunk-vector",
              documentId: "doc-1",
              chunkIndex: 0,
              content: "semantic match only",
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
            content: "semantic match only",
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
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "alpha exact",
    topK: 2,
    scoreThreshold: 0,
    strategy: {
      queryRewrite: {
        enabled: true
      },
      candidateSelection: {
        mode: "hybrid",
        candidateMultiplier: 3,
        minCandidates: 2
      },
      hybrid: {
        vectorWeight: 0.1,
        lexicalWeight: 0.9
      },
      rerank: {
        enabled: false
      }
    }
  });

  assert.deepEqual(
    result.retrievedChunks.map(chunk => chunk.chunkId),
    ["chunk-lexical", "chunk-vector"]
  );
});

test("RetrievalService reports candidate-budget saturation signals", async () => {
  const prisma = {
    documentChunk: {
      findMany: async args => {
        if (args.where.id?.in) {
          return [
            {
              id: "chunk-vector-1",
              documentId: "doc-1",
              chunkIndex: 0,
              content: "semantic alpha",
              pageNo: null,
              sectionTitle: "Overview",
              document: { title: "Doc 1" }
            },
            {
              id: "chunk-vector-2",
              documentId: "doc-2",
              chunkIndex: 0,
              content: "semantic beta",
              pageNo: null,
              sectionTitle: "Overview",
              document: { title: "Doc 2" }
            }
          ];
        }

        return [
          {
            id: "chunk-vector-1",
            documentId: "doc-1",
            chunkIndex: 0,
            content: "semantic alpha",
            pageNo: null,
            sectionTitle: "Overview",
            document: { title: "Doc 1" }
          },
          {
            id: "chunk-vector-2",
            documentId: "doc-2",
            chunkIndex: 0,
            content: "semantic beta",
            pageNo: null,
            sectionTitle: "Overview",
            document: { title: "Doc 2" }
          },
          {
            id: "chunk-lexical-3",
            documentId: "doc-3",
            chunkIndex: 0,
            content: "alpha phrase alpha phrase",
            pageNo: null,
            sectionTitle: "alpha phrase",
            document: { title: "Doc 3" }
          },
          {
            id: "chunk-lexical-4",
            documentId: "doc-4",
            chunkIndex: 0,
            content: "alpha phrase exact match",
            pageNo: null,
            sectionTitle: "alpha phrase",
            document: { title: "Doc 4" }
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
      { chunkId: "chunk-vector-1", score: 0.91 },
      { chunkId: "chunk-vector-2", score: 0.89 }
    ]
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "alpha phrase",
    topK: 2,
    scoreThreshold: 0,
    enableHybrid: true,
    strategy: {
      queryRewrite: {
        enabled: false
      },
      candidateSelection: {
        mode: "hybrid",
        candidateMultiplier: 1,
        minCandidates: 2
      },
      hybrid: {
        vectorWeight: 0.5,
        lexicalWeight: 0.5
      },
      rerank: {
        enabled: false
      }
    }
  });

  assert.deepEqual(result.execution, {
    actualMode: "hybrid",
    usedFallback: false,
    fallbackReason: null,
    rerankApplied: false,
    chunkWindowApplied: false,
    vectorSearchAttempted: true,
    lexicalSearchAttempted: true,
    vectorCandidateLimitHit: true,
    lexicalCandidateLimitHit: true,
    rankingTopKHit: true,
    candidateLimit: 2,
    vectorCandidateCount: 2,
    lexicalCandidateCount: 2,
    mergedCandidateCount: 4,
    rankedCandidateCount: 2
  });
});

test("RetrievalService follows canonical defaults when partial strategyJson coexists with legacy flags", async () => {
  let lexicalReads = 0;

  const prisma = {
    documentChunk: {
      findMany: async args => {
        if (args.where.id?.in) {
          return [
            {
              id: "chunk-vector",
              documentId: "doc-1",
              chunkIndex: 0,
              content: "vector default marker",
              pageNo: null,
              sectionTitle: "Overview",
              document: { title: "Doc 1" }
            }
          ];
        }

        lexicalReads += 1;
        return [
          {
            id: "chunk-lexical",
            documentId: "doc-2",
            chunkIndex: 0,
            content: "lexical only marker",
            pageNo: null,
            sectionTitle: "Facts",
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
    search: async () => [{ chunkId: "chunk-vector", score: 0.88 }]
  };

  const service = new RetrievalService(prisma, embeddingService, vectorStoreService);
  const result = await service.retrieve({
    kbId: "kb-1",
    query: "vector default marker",
    topK: 1,
    scoreThreshold: 0,
    enableHybrid: true,
    enableRerank: true,
    strategy: resolveRetrievalStrategy({
      topK: 1,
      enableHybrid: true,
      enableRerank: true,
      strategyJson: {
        queryRewrite: {
          enabled: false
        },
        candidateSelection: {
          candidateMultiplier: 4,
          minCandidates: 2
        }
      }
    })
  });

  assert.equal(lexicalReads, 0);
  assert.deepEqual(result.retrievedChunks.map(chunk => chunk.chunkId), ["chunk-vector"]);
  assert.deepEqual(result.execution, {
    actualMode: "vector",
    usedFallback: false,
    fallbackReason: null,
    rerankApplied: false,
    chunkWindowApplied: false,
    vectorSearchAttempted: true,
    lexicalSearchAttempted: false,
    vectorCandidateLimitHit: false,
    lexicalCandidateLimitHit: false,
    rankingTopKHit: true,
    candidateLimit: 4,
    vectorCandidateCount: 1,
    lexicalCandidateCount: 0,
    mergedCandidateCount: 1,
    rankedCandidateCount: 1
  });
});
