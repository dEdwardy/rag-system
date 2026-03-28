const assert = require("node:assert/strict");
const {
  EmbeddingRuntimeConfigError,
  resolveEmbeddingRuntimeConfig
} = require("../src/infra/embedding/embedding-runtime-config.ts");
const { EmbeddingService } = require("../src/infra/embedding/embedding.service.ts");
const { withEnv, withFetchMock } = require("./support/llm-test-helpers.js");

test("resolveEmbeddingRuntimeConfig preserves deterministic fallback defaults", () => {
  const config = resolveEmbeddingRuntimeConfig({});

  assert.equal(config.providers.length, 1);
  assert.deepEqual(config.providers[0], {
    provider: "fallback",
    config: {
      provider: "fallback",
      model: "hash-v1",
      modelName: "fallback:hash-v1",
      dimensions: 256,
      provenance: {
        modelSource: "builtin:fallback",
        dimensionsSource: "builtin:fallback",
        fallback: "local_deterministic"
      }
    }
  });
});

test("resolveEmbeddingRuntimeConfig keeps Ollama first, OpenAI second, and fallback last", () => {
  const config = resolveEmbeddingRuntimeConfig({
    OLLAMA_BASE_URL: "http://localhost:11434/",
    OLLAMA_MODEL: "nomic-embed-text",
    OPENAI_API_KEY: "test-key"
  });

  assert.equal(config.providers.length, 3);
  assert.deepEqual(config.providers.map(provider => provider.provider), ["ollama", "openai", "fallback"]);
  assert.deepEqual(config.providers[0], {
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "nomic-embed-text",
    modelSource: "env:OLLAMA_MODEL",
    expectedDimensions: null
  });
  assert.deepEqual(config.providers[1], {
    provider: "openai",
    apiKey: "test-key",
    apiUrl: "https://api.openai.com/v1/embeddings",
    model: "text-embedding-3-small",
    modelSource: "default:OPENAI_EMBEDDING_MODEL",
    expectedDimensions: 1536
  });
});

test("resolveEmbeddingRuntimeConfig derives OpenAI embedding endpoint from OPENAI_BASE_URL", () => {
  const config = resolveEmbeddingRuntimeConfig({
    OPENAI_API_KEY: "test-key",
    OPENAI_BASE_URL: "https://openai-proxy.local/v1/"
  });

  assert.deepEqual(config.providers[0], {
    provider: "openai",
    apiKey: "test-key",
    apiUrl: "https://openai-proxy.local/v1/embeddings",
    model: "text-embedding-3-small",
    modelSource: "default:OPENAI_EMBEDDING_MODEL",
    expectedDimensions: 1536
  });
});

test("resolveEmbeddingRuntimeConfig keeps explicit Ollama embedding dimensions when configured", () => {
  const config = resolveEmbeddingRuntimeConfig({
    OLLAMA_BASE_URL: "http://localhost:11434",
    OLLAMA_EMBEDDING_MODEL: "nomic-embed-text",
    OLLAMA_EMBEDDING_DIMENSIONS: "768"
  });

  assert.deepEqual(config.providers[0], {
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    model: "nomic-embed-text",
    modelSource: "env:OLLAMA_EMBEDDING_MODEL",
    expectedDimensions: 768
  });
});

test("resolveEmbeddingRuntimeConfig rejects invalid OLLAMA_EMBEDDING_DIMENSIONS", () => {
  assert.throws(
    () =>
      resolveEmbeddingRuntimeConfig({
        OLLAMA_BASE_URL: "http://localhost:11434",
        OLLAMA_EMBEDDING_MODEL: "nomic-embed-text",
        OLLAMA_EMBEDDING_DIMENSIONS: "abc"
      }),
    error => {
      assert.ok(error instanceof EmbeddingRuntimeConfigError);
      assert.match(error.message, /OLLAMA_EMBEDDING_DIMENSIONS/);
      return true;
    }
  );
});

test("resolveEmbeddingRuntimeConfig rejects OLLAMA_EMBEDDING_DIMENSIONS when Ollama provider is not configured", () => {
  assert.throws(
    () =>
      resolveEmbeddingRuntimeConfig({
        OLLAMA_EMBEDDING_DIMENSIONS: "768"
      }),
    error => {
      assert.ok(error instanceof EmbeddingRuntimeConfigError);
      assert.match(error.message, /OLLAMA_EMBEDDING_DIMENSIONS is set but Ollama embedding provider is disabled/);
      return true;
    }
  );
});

test("resolveEmbeddingRuntimeConfig rejects incomplete Ollama config", () => {
  assert.throws(
    () => resolveEmbeddingRuntimeConfig({ OLLAMA_MODEL: "nomic-embed-text" }),
    error => {
      assert.ok(error instanceof EmbeddingRuntimeConfigError);
      assert.match(error.message, /OLLAMA_BASE_URL/);
      return true;
    }
  );
});

test("resolveEmbeddingRuntimeConfig rejects unsupported OpenAI embedding models", () => {
  assert.throws(
    () =>
      resolveEmbeddingRuntimeConfig({
        OPENAI_API_KEY: "test-key",
        OPENAI_EMBEDDING_MODEL: "custom-embedding-model"
      }),
    error => {
      assert.ok(error instanceof EmbeddingRuntimeConfigError);
      assert.match(error.message, /OPENAI_EMBEDDING_MODEL/);
      assert.match(error.message, /text-embedding-3-small/);
      return true;
    }
  );
});

test("EmbeddingService keeps deterministic fallback embeddings when provider requests fail", async () => {
  const service = new EmbeddingService();

  await withEnv(
    {
      OLLAMA_BASE_URL: undefined,
      OLLAMA_MODEL: undefined,
      OLLAMA_EMBEDDING_MODEL: undefined,
      OPENAI_API_KEY: "test-key",
      OPENAI_EMBEDDING_MODEL: undefined
    },
    async () => {
      await withFetchMock(async () => ({ ok: false, status: 503 }), async () => {
        const [embedding] = await service.embedTexts(["fallback text"]);

        assert.equal(embedding.provider, "fallback");
        assert.equal(embedding.modelName, "fallback:hash-v1");
        assert.equal(embedding.dimensions, 256);
        assert.equal(embedding.vector.length, 256);
      });
    }
  );
});

test("EmbeddingService rejects incompatible OpenAI dimensions with an explicit error", async () => {
  const service = new EmbeddingService();

  await withEnv(
    {
      OLLAMA_BASE_URL: undefined,
      OLLAMA_MODEL: undefined,
      OLLAMA_EMBEDDING_MODEL: undefined,
      OPENAI_API_KEY: "test-key",
      OPENAI_EMBEDDING_MODEL: "text-embedding-3-small"
    },
    async () => {
      await withFetchMock(
        async () => ({
          ok: true,
          json: async () => ({
            data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }]
          })
        }),
        async () => {
          await assert.rejects(service.embedTexts(["dimension mismatch"]), error => {
            assert.ok(error instanceof EmbeddingRuntimeConfigError);
            assert.match(error.message, /expects 1536 dimensions/);
            assert.match(error.message, /OPENAI_EMBEDDING_MODEL and OPENAI_BASE_URL compatibility/);
            assert.match(error.message, /Resolved OpenAI embedding endpoint: https:\/\/api\.openai\.com\/v1\/embeddings/);
            return true;
          });
        }
      );
    }
  );
});

test("EmbeddingService dimension mismatch error explains default OpenAI embedding model usage", async () => {
  const service = new EmbeddingService();

  await withEnv(
    {
      OLLAMA_BASE_URL: undefined,
      OLLAMA_MODEL: undefined,
      OLLAMA_EMBEDDING_MODEL: undefined,
      OPENAI_API_KEY: "test-key",
      OPENAI_EMBEDDING_MODEL: undefined
    },
    async () => {
      await withFetchMock(
        async () => ({
          ok: true,
          json: async () => ({
            data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }]
          })
        }),
        async () => {
          await assert.rejects(service.embedTexts(["dimension mismatch"]), error => {
            assert.ok(error instanceof EmbeddingRuntimeConfigError);
            assert.match(error.message, /OPENAI_EMBEDDING_MODEL is unset/);
            assert.match(error.message, /default embedding model "text-embedding-3-small" is currently in use/);
            return true;
          });
        }
      );
    }
  );
});

test("EmbeddingService rejects inconsistent Ollama response dimensions with an explicit error", async () => {
  const service = new EmbeddingService();

  await withEnv(
    {
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL: "nomic-embed-text",
      OLLAMA_EMBEDDING_MODEL: undefined,
      OPENAI_API_KEY: undefined,
      OPENAI_EMBEDDING_MODEL: undefined
    },
    async () => {
      await withFetchMock(
        async () => ({
          ok: true,
          json: async () => ({
            embeddings: [
              [0.1, 0.2, 0.3],
              [0.4, 0.5]
            ]
          })
        }),
        async () => {
          await assert.rejects(service.embedTexts(["one", "two"]), error => {
            assert.ok(error instanceof EmbeddingRuntimeConfigError);
            assert.match(error.message, /inconsistent embedding dimensions/);
            return true;
          });
        }
      );
    }
  );
});

test("EmbeddingService rejects Ollama responses that mismatch OLLAMA_EMBEDDING_DIMENSIONS", async () => {
  const service = new EmbeddingService();

  await withEnv(
    {
      OLLAMA_BASE_URL: "http://localhost:11434",
      OLLAMA_MODEL: "nomic-embed-text",
      OLLAMA_EMBEDDING_MODEL: undefined,
      OLLAMA_EMBEDDING_DIMENSIONS: "1024",
      OPENAI_API_KEY: undefined,
      OPENAI_EMBEDDING_MODEL: undefined
    },
    async () => {
      await withFetchMock(
        async () => ({
          ok: true,
          json: async () => ({
            embeddings: [[0.1, 0.2, 0.3]]
          })
        }),
        async () => {
          await assert.rejects(service.embedTexts(["dimension mismatch"]), error => {
            assert.ok(error instanceof EmbeddingRuntimeConfigError);
            assert.match(error.message, /OLLAMA_EMBEDDING_DIMENSIONS=1024/);
            return true;
          });
        }
      );
    }
  );
});
