const assert = require("node:assert/strict");

const { PgVectorStoreService } = require("../src/infra/vector-store/pg-vector-store.service.ts");
const { VectorStoreCompatibilityError } = require("../src/infra/vector-store/vector-store.types.ts");

test("PgVectorStoreService exposes active and indexed embedding diagnostics for compatible searches", async () => {
  await withPgVectorEnv(async () => {
    const fakePrisma = createFakePrisma({
      queryResponses: [
        [
          {
            modelName: "ollama:nomic-embed-text",
            dimensions: 768,
            recordCount: 2,
            documentCount: 1
          }
        ],
        [
          {
            chunkId: "chunk-1",
            documentId: "doc-1",
            modelName: "ollama:nomic-embed-text",
            score: 0.98
          }
        ]
      ]
    });
    const service = new PgVectorStoreService(fakePrisma);

    const embedding = createEmbedding({
      provider: "ollama",
      model: "nomic-embed-text",
      modelName: "ollama:nomic-embed-text",
      dimensions: 768,
      provenance: {
        modelSource: "env:OLLAMA_EMBEDDING_MODEL",
        dimensionsSource: "provider_response",
        fallback: "none"
      },
      vector: [1, 0, 0]
    });

    const result = await service.search({
      kbId: "kb-1",
      queryEmbedding: embedding,
      topK: 3,
      scoreThreshold: 0
    });

    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].chunkId, "chunk-1");
    assert.deepEqual(result.embedding, {
      active: {
        provider: "ollama",
        model: "nomic-embed-text",
        modelName: "ollama:nomic-embed-text",
        dimensions: 768,
        modelSource: "env:OLLAMA_EMBEDDING_MODEL",
        dimensionsSource: "provider_response",
        fallbackState: "none"
      },
      indexed: {
        provider: "ollama",
        model: "nomic-embed-text",
        modelName: "ollama:nomic-embed-text",
        dimensions: 768,
        fallbackState: "none",
        recordCount: 2,
        documentCount: 1
      }
    });
    assert.equal(fakePrisma.queryCalls.length, 2);
  });
});

test("PgVectorStoreService caches indexed embedding summary across searches for the same knowledge base", async () => {
  await withPgVectorEnv(async () => {
    const fakePrisma = createFakePrisma({
      queryResponses: [
        [
          {
            modelName: "ollama:nomic-embed-text",
            dimensions: 768,
            recordCount: 2,
            documentCount: 1
          }
        ],
        [
          {
            chunkId: "chunk-1",
            documentId: "doc-1",
            chunkIndex: 0,
            modelName: "ollama:nomic-embed-text",
            score: 0.98
          }
        ],
        [
          {
            chunkId: "chunk-2",
            documentId: "doc-1",
            chunkIndex: 1,
            modelName: "ollama:nomic-embed-text",
            score: 0.95
          }
        ]
      ]
    });
    const service = new PgVectorStoreService(fakePrisma);
    const embedding = createEmbedding({
      provider: "ollama",
      model: "nomic-embed-text",
      modelName: "ollama:nomic-embed-text",
      dimensions: 768,
      provenance: {
        modelSource: "env:OLLAMA_EMBEDDING_MODEL",
        dimensionsSource: "provider_response",
        fallback: "none"
      },
      vector: [1, 0, 0]
    });

    await service.search({
      kbId: "kb-1",
      queryEmbedding: embedding,
      topK: 3,
      scoreThreshold: 0
    });
    await service.search({
      kbId: "kb-1",
      queryEmbedding: embedding,
      topK: 3,
      scoreThreshold: 0
    });

    assert.equal(fakePrisma.queryCalls.length, 3);
  });
});

test("PgVectorStoreService rejects indexing when embedding dimensions do not match configured pgvector dimensions", async () => {
  await withPgVectorEnv(
    {
      VECTOR_STORE_PGVECTOR_DIMENSIONS: "1024"
    },
    async () => {
      const service = new PgVectorStoreService(createFakePrisma());

      await assert.rejects(
        service.replaceDocumentVectors({
          kbId: "kb-1",
          documentId: "doc-1",
          records: [
            {
              id: "chunk-1",
              kbId: "kb-1",
              documentId: "doc-1",
              chunkId: "chunk-1",
              chunkIndex: 0,
              sectionTitle: null,
              pageNo: null,
              content: "content",
              metadata: {},
              embedding: createEmbedding({
                provider: "openai",
                model: "text-embedding-3-small",
                modelName: "openai:text-embedding-3-small",
                dimensions: 1536,
                provenance: {
                  modelSource: "env:OPENAI_EMBEDDING_MODEL",
                  dimensionsSource: "provider_response",
                  fallback: "none"
                },
                vector: new Array(1536).fill(0)
              })
            }
          ]
        }),
        error => {
          assert.ok(error instanceof VectorStoreCompatibilityError);
          assert.match(error.message, /pgvector store dimension 1024d/);
          return true;
        }
      );
    }
  );
});

test("PgVectorStoreService replaces legacy fallback vectors when indexing with a dedicated embedding config", async () => {
  await withPgVectorEnv(async () => {
    const fakePrisma = createFakePrisma({
      queryResponses: [
        [
          {
            modelName: "fallback:hash-v1",
            dimensions: 256,
            recordCount: 2,
            documentCount: 1
          }
        ]
      ]
    });
    const service = new PgVectorStoreService(fakePrisma);

    await service.replaceDocumentVectors({
      kbId: "kb-1",
      documentId: "doc-2",
      records: [
        {
          id: "chunk-2",
          kbId: "kb-1",
          documentId: "doc-2",
          chunkId: "chunk-2",
          chunkIndex: 0,
          sectionTitle: "Overview",
          pageNo: 1,
          content: "replacement content",
          metadata: {},
          embedding: createEmbedding({
            provider: "ollama",
            model: "nomic-embed-text",
            modelName: "ollama:nomic-embed-text",
            dimensions: 1024,
            provenance: {
              modelSource: "env:OLLAMA_EMBEDDING_MODEL",
              dimensionsSource: "provider_response",
              fallback: "none"
            },
            vector: new Array(1024).fill(0)
          })
        }
      ]
    });

    assert.equal(fakePrisma.executeCalls.length, 2);
    assert.equal(fakePrisma.executeCalls[0].values.length, 1);
    assert.equal(fakePrisma.executeCalls[0].values[0], "kb-1");
  });
});

function createEmbedding(input) {
  return input;
}

function createFakePrisma(options = {}) {
  const queryResponses = [...(options.queryResponses ?? [])];
  const queryCalls = [];
  const executeCalls = [];

  const prisma = {
    queryCalls,
    executeCalls,
    async $queryRaw(query) {
      queryCalls.push(query);
      return queryResponses.shift() ?? [];
    },
    async $executeRaw(query) {
      executeCalls.push(query);
      return 1;
    },
    async $transaction(callback) {
      return callback(prisma);
    }
  };

  return prisma;
}

async function withPgVectorEnv(overridesOrCallback, callbackMaybe) {
  const overrides = typeof overridesOrCallback === "function" ? {} : overridesOrCallback;
  const callback = typeof overridesOrCallback === "function" ? overridesOrCallback : callbackMaybe;
  const originalProvider = process.env.VECTOR_STORE_PROVIDER;
  const originalTable = process.env.VECTOR_STORE_PGVECTOR_TABLE;
  const originalDimensions = process.env.VECTOR_STORE_PGVECTOR_DIMENSIONS;

  process.env.VECTOR_STORE_PROVIDER = "pgvector";
  process.env.VECTOR_STORE_PGVECTOR_TABLE = overrides.VECTOR_STORE_PGVECTOR_TABLE ?? "ChunkEmbedding";
  process.env.VECTOR_STORE_PGVECTOR_DIMENSIONS = overrides.VECTOR_STORE_PGVECTOR_DIMENSIONS ?? "1024";

  try {
    await callback();
  } finally {
    restoreEnv("VECTOR_STORE_PROVIDER", originalProvider);
    restoreEnv("VECTOR_STORE_PGVECTOR_TABLE", originalTable);
    restoreEnv("VECTOR_STORE_PGVECTOR_DIMENSIONS", originalDimensions);
  }
}

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
