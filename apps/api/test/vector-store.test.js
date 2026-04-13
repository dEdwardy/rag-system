const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const {
  VectorStoreService
} = require('../src/infra/vector-store/vector-store.service.ts');
const {
  LocalStorageProviderService
} = require('../src/infra/storage/storage-provider.service.ts');
const {
  VectorStoreCompatibilityError
} = require('../src/infra/vector-store/vector-store.types.ts');

test('VectorStoreService exposes active and indexed embedding diagnostics for compatible searches', async () => {
  await withTemporaryStorageRoot(async () => {
    const service = new VectorStoreService(new LocalStorageProviderService());
    const embedding = createEmbedding({
      provider: 'ollama',
      model: 'nomic-embed-text',
      modelName: 'ollama:nomic-embed-text',
      dimensions: 3,
      provenance: {
        modelSource: 'env:OLLAMA_EMBEDDING_MODEL',
        dimensionsSource: 'provider_response',
        fallback: 'none'
      },
      vector: [1, 0, 0]
    });

    await service.replaceDocumentVectors({
      kbId: 'kb-1',
      documentId: 'doc-1',
      records: [
        {
          id: 'chunk-1',
          kbId: 'kb-1',
          documentId: 'doc-1',
          chunkId: 'chunk-1',
          chunkIndex: 0,
          sectionTitle: 'Overview',
          pageNo: 1,
          content: 'compatible vector content',
          embedding,
          metadata: {}
        }
      ]
    });

    const result = await service.search({
      kbId: 'kb-1',
      queryEmbedding: embedding,
      topK: 3,
      scoreThreshold: 0
    });

    assert.equal(result.matches.length, 1);
    assert.deepEqual(result.embedding, {
      active: {
        provider: 'ollama',
        model: 'nomic-embed-text',
        modelName: 'ollama:nomic-embed-text',
        dimensions: 3,
        modelSource: 'env:OLLAMA_EMBEDDING_MODEL',
        dimensionsSource: 'provider_response',
        fallbackState: 'none'
      },
      indexed: {
        provider: 'ollama',
        model: 'nomic-embed-text',
        modelName: 'ollama:nomic-embed-text',
        dimensions: 3,
        fallbackState: 'none',
        recordCount: 1,
        documentCount: 1
      }
    });
  });
});

test('VectorStoreService rejects indexing a second embedding config into the same knowledge base', async () => {
  await withTemporaryStorageRoot(async () => {
    const service = new VectorStoreService(new LocalStorageProviderService());

    await service.replaceDocumentVectors({
      kbId: 'kb-1',
      documentId: 'doc-1',
      records: [
        {
          id: 'chunk-1',
          kbId: 'kb-1',
          documentId: 'doc-1',
          chunkId: 'chunk-1',
          chunkIndex: 0,
          sectionTitle: 'Overview',
          pageNo: 1,
          content: 'first config',
          embedding: createEmbedding({
            provider: 'openai',
            model: 'text-embedding-3-small',
            modelName: 'openai:text-embedding-3-small',
            dimensions: 1536,
            provenance: {
              modelSource: 'env:OPENAI_EMBEDDING_MODEL',
              dimensionsSource: 'provider_response',
              fallback: 'none'
            },
            vector: new Array(1536).fill(0)
          }),
          metadata: {}
        }
      ]
    });

    await assert.rejects(
      service.replaceDocumentVectors({
        kbId: 'kb-1',
        documentId: 'doc-2',
        records: [
          {
            id: 'chunk-2',
            kbId: 'kb-1',
            documentId: 'doc-2',
            chunkId: 'chunk-2',
            chunkIndex: 0,
            sectionTitle: 'Overview',
            pageNo: 2,
            content: 'second config',
            embedding: createEmbedding({
              provider: 'ollama',
              model: 'nomic-embed-text',
              modelName: 'ollama:nomic-embed-text',
              dimensions: 768,
              provenance: {
                modelSource: 'env:OLLAMA_EMBEDDING_MODEL',
                dimensionsSource: 'provider_response',
                fallback: 'none'
              },
              vector: new Array(768).fill(0)
            }),
            metadata: {}
          }
        ]
      }),
      (error) => {
        assert.ok(error instanceof VectorStoreCompatibilityError);
        assert.match(error.message, /Active indexing embedding config/);
        assert.match(error.message, /openai:text-embedding-3-small/);
        assert.match(error.message, /ollama:nomic-embed-text/);
        return true;
      }
    );
  });
});

test('VectorStoreService replaces legacy fallback vectors when indexing with a dedicated embedding config', async () => {
  await withTemporaryStorageRoot(async () => {
    const service = new VectorStoreService(new LocalStorageProviderService());

    await service.replaceDocumentVectors({
      kbId: 'kb-1',
      documentId: 'doc-1',
      records: [
        {
          id: 'chunk-1',
          kbId: 'kb-1',
          documentId: 'doc-1',
          chunkId: 'chunk-1',
          chunkIndex: 0,
          sectionTitle: 'Overview',
          pageNo: 1,
          content: 'legacy fallback content',
          embedding: createEmbedding({
            provider: 'fallback',
            model: 'hash-v1',
            modelName: 'fallback:hash-v1',
            dimensions: 256,
            provenance: {
              modelSource: 'builtin:fallback',
              dimensionsSource: 'builtin:fallback',
              fallback: 'local_deterministic'
            },
            vector: [1, 0, 0, 0]
          }),
          metadata: {}
        }
      ]
    });

    await service.replaceDocumentVectors({
      kbId: 'kb-1',
      documentId: 'doc-2',
      records: [
        {
          id: 'chunk-2',
          kbId: 'kb-1',
          documentId: 'doc-2',
          chunkId: 'chunk-2',
          chunkIndex: 0,
          sectionTitle: 'Overview',
          pageNo: 2,
          content: 'dedicated embedding content',
          embedding: createEmbedding({
            provider: 'openai',
            model: 'text-embedding-3-small',
            modelName: 'openai:text-embedding-3-small',
            dimensions: 4,
            provenance: {
              modelSource: 'env:OPENAI_EMBEDDING_MODEL',
              dimensionsSource: 'provider_response',
              fallback: 'none'
            },
            vector: [0, 1, 0, 0]
          }),
          metadata: {}
        }
      ]
    });

    const result = await service.search({
      kbId: 'kb-1',
      queryEmbedding: createEmbedding({
        provider: 'openai',
        model: 'text-embedding-3-small',
        modelName: 'openai:text-embedding-3-small',
        dimensions: 4,
        provenance: {
          modelSource: 'env:OPENAI_EMBEDDING_MODEL',
          dimensionsSource: 'provider_response',
          fallback: 'none'
        },
        vector: [0, 1, 0, 0]
      }),
      topK: 5,
      scoreThreshold: 0
    });

    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].documentId, 'doc-2');
    assert.deepEqual(result.embedding?.indexed, {
      provider: 'openai',
      model: 'text-embedding-3-small',
      modelName: 'openai:text-embedding-3-small',
      dimensions: 4,
      fallbackState: 'none',
      recordCount: 1,
      documentCount: 1
    });
  });
});

function createEmbedding(input) {
  return input;
}

async function withTemporaryStorageRoot(callback) {
  const originalStorageRoot = process.env.STORAGE_ROOT;
  const storageRoot = await mkdtemp(join(tmpdir(), 'rag-vector-store-'));
  process.env.STORAGE_ROOT = storageRoot;

  try {
    await callback(storageRoot);
  } finally {
    if (originalStorageRoot === undefined) {
      delete process.env.STORAGE_ROOT;
    } else {
      process.env.STORAGE_ROOT = originalStorageRoot;
    }

    await rm(storageRoot, { recursive: true, force: true });
  }
}
