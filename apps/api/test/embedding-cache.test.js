const assert = require("node:assert/strict");
const test = require("node:test");

const { EmbeddingCacheService } = require("../src/infra/embedding/embedding-cache.service.ts");

test("EmbeddingCacheService caches and retrieves single embedding", async () => {
  const cache = new EmbeddingCacheService();
  const testText = "Hello, world!";
  const testEmbedding = {
    vector: [0.1, 0.2, 0.3],
    modelName: "test-model",
    dimensions: 3
  };

  cache.set(testText, testEmbedding);
  const result = cache.get(testText);

  assert.deepEqual(result, testEmbedding);
});

test("EmbeddingCacheService returns null for uncached text", async () => {
  const cache = new EmbeddingCacheService();
  const result = cache.get("This text is not cached");

  assert.equal(result, null);
});

test("EmbeddingCacheService handles batch operations", async () => {
  const cache = new EmbeddingCacheService();
  const text1 = "Text 1";
  const text2 = "Text 2";
  const text3 = "Text 3";
  
  const embedding1 = { vector: [0.1], modelName: "test", dimensions: 1 };
  const embedding2 = { vector: [0.2], modelName: "test", dimensions: 1 };

  cache.set(text1, embedding1);
  cache.set(text2, embedding2);

  const { cached, uncached, indices } = cache.getBatch([text1, text2, text3]);

  assert.equal(cached.size, 2);
  assert.deepEqual(cached.get(0), embedding1);
  assert.deepEqual(cached.get(1), embedding2);
  assert.deepEqual(uncached, [text3]);
  assert.deepEqual(indices, [2]);
});

test("EmbeddingCacheService batch set works correctly", async () => {
  const cache = new EmbeddingCacheService();
  const texts = ["Batch text 1", "Batch text 2"];
  const embeddings = [
    { vector: [0.5], modelName: "test", dimensions: 1 },
    { vector: [0.6], modelName: "test", dimensions: 1 }
  ];

  cache.setBatch(texts, embeddings);

  assert.deepEqual(cache.get(texts[0]), embeddings[0]);
  assert.deepEqual(cache.get(texts[1]), embeddings[1]);
});

test("EmbeddingCacheService clears cache", async () => {
  const cache = new EmbeddingCacheService();
  cache.set("Test text", { vector: [0.1], modelName: "test", dimensions: 1 });
  
  cache.clear();
  
  assert.equal(cache.get("Test text"), null);
});

test("EmbeddingCacheService uses different keys for different texts", async () => {
  const cache = new EmbeddingCacheService();
  const embedding1 = { vector: [0.1], modelName: "test", dimensions: 1 };
  const embedding2 = { vector: [0.2], modelName: "test", dimensions: 1 };

  cache.set("Text A", embedding1);
  cache.set("Text B", embedding2);

  assert.deepEqual(cache.get("Text A"), embedding1);
  assert.deepEqual(cache.get("Text B"), embedding2);
});
