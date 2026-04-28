import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  resolveVectorStoreRuntimeConfig,
  VectorStoreRuntimeConfigError
} from '../src/infra/vector-store/vector-store-runtime-config.ts';

test('resolveVectorStoreRuntimeConfig defaults to pgvector provider', () => {
  const config = resolveVectorStoreRuntimeConfig({});
  assert.deepEqual(config, {
    provider: 'pgvector',
    tableName: 'ChunkEmbedding',
    dimensions: 1024
  });
});

test('resolveVectorStoreRuntimeConfig resolves pgvector provider with defaults', () => {
  const config = resolveVectorStoreRuntimeConfig({
    VECTOR_STORE_PROVIDER: 'pgvector'
  });

  assert.deepEqual(config, {
    provider: 'pgvector',
    tableName: 'ChunkEmbedding',
    dimensions: 1024
  });
});

test('resolveVectorStoreRuntimeConfig rejects invalid provider', () => {
  assert.throws(
    () => resolveVectorStoreRuntimeConfig({ VECTOR_STORE_PROVIDER: 'redis' }),
    (error) => {
      assert.ok(error instanceof VectorStoreRuntimeConfigError);
      assert.match(error.message, /Unsupported vector store provider/);
      return true;
    }
  );
});

test('resolveVectorStoreRuntimeConfig rejects invalid pgvector dimensions', () => {
  assert.throws(
    () =>
      resolveVectorStoreRuntimeConfig({
        VECTOR_STORE_PROVIDER: 'pgvector',
        VECTOR_STORE_PGVECTOR_DIMENSIONS: 'abc'
      }),
    (error) => {
      assert.ok(error instanceof VectorStoreRuntimeConfigError);
      assert.match(error.message, /VECTOR_STORE_PGVECTOR_DIMENSIONS/);
      return true;
    }
  );
});
