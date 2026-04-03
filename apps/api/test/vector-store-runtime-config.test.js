const assert = require("node:assert/strict");

const {
  resolveVectorStoreRuntimeConfig,
  VectorStoreRuntimeConfigError
} = require("../src/infra/vector-store/vector-store-runtime-config.ts");

test("resolveVectorStoreRuntimeConfig defaults to filesystem provider", () => {
  const config = resolveVectorStoreRuntimeConfig({});
  assert.deepEqual(config, { provider: "filesystem" });
});

test("resolveVectorStoreRuntimeConfig resolves pgvector provider with defaults", () => {
  const config = resolveVectorStoreRuntimeConfig({
    VECTOR_STORE_PROVIDER: "pgvector"
  });

  assert.deepEqual(config, {
    provider: "pgvector",
    tableName: "ChunkEmbedding",
    dimensions: 768
  });
});

test("resolveVectorStoreRuntimeConfig rejects invalid provider", () => {
  assert.throws(
    () => resolveVectorStoreRuntimeConfig({ VECTOR_STORE_PROVIDER: "redis" }),
    error => {
      assert.ok(error instanceof VectorStoreRuntimeConfigError);
      assert.match(error.message, /Unsupported vector store provider/);
      return true;
    }
  );
});

test("resolveVectorStoreRuntimeConfig rejects invalid pgvector dimensions", () => {
  assert.throws(
    () =>
      resolveVectorStoreRuntimeConfig({
        VECTOR_STORE_PROVIDER: "pgvector",
        VECTOR_STORE_PGVECTOR_DIMENSIONS: "abc"
      }),
    error => {
      assert.ok(error instanceof VectorStoreRuntimeConfigError);
      assert.match(error.message, /VECTOR_STORE_PGVECTOR_DIMENSIONS/);
      return true;
    }
  );
});
