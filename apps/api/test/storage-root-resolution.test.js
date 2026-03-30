const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const test = require("node:test");

const { resolveStorageRoot } = require("../src/infra/storage/storage-root.ts");
const { StorageService } = require("../src/infra/storage/storage.service.ts");
const { VectorStoreService } = require("../src/infra/vector-store/vector-store.service.ts");

test("resolveStorageRoot keeps the default storage directory anchored to repo root even when cwd is apps/api", () => {
  const repoRoot = resolve(__dirname, "..", "..", "..");
  const apiRoot = resolve(repoRoot, "apps/api");

  assert.equal(
    resolveStorageRoot({ cwd: apiRoot, moduleDir: resolve(apiRoot, "src/infra/storage"), env: {} }),
    resolve(repoRoot, "storage")
  );
});

test("resolveStorageRoot resolves relative STORAGE_ROOT against repo root instead of cwd", () => {
  const repoRoot = resolve(__dirname, "..", "..", "..");
  const apiRoot = resolve(repoRoot, "apps/api");

  assert.equal(
    resolveStorageRoot({
      cwd: apiRoot,
      moduleDir: resolve(apiRoot, "src/infra/storage"),
      env: { STORAGE_ROOT: "storage/local-dev" }
    }),
    resolve(repoRoot, "storage/local-dev")
  );
});

test("storage-backed services share the same repo-root-relative storage root behavior", async () => {
  const repoRoot = resolve(__dirname, "..", "..", "..");
  const apiRoot = resolve(repoRoot, "apps/api");
  const previousCwd = process.cwd();
  const previousStorageRoot = process.env.STORAGE_ROOT;
  const sandboxStorageRoot = await mkdtemp(join(tmpdir(), "rag-storage-root-"));

  process.chdir(apiRoot);
  try {
    process.env.STORAGE_ROOT = sandboxStorageRoot;
    const storageService = new StorageService();
    const vectorStoreService = new VectorStoreService();
    const storedFile = await storageService.saveGeneratedTextFile({ content: "repo-root-stable" });

    assert.equal(storageService.getStorageRoot(), sandboxStorageRoot);
    await vectorStoreService.replaceDocumentVectors({
      kbId: "kb-storage-root",
      documentId: "doc-storage-root",
      records: [
        {
          id: "chunk-storage-root",
          kbId: "kb-storage-root",
          documentId: "doc-storage-root",
          chunkId: "chunk-storage-root",
          chunkIndex: 0,
          sectionTitle: "Overview",
          pageNo: 1,
          content: "vector content",
          embedding: {
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
          },
          metadata: {}
        }
      ]
    });

    assert.equal(storedFile.storageKey.startsWith("generated/"), true);
    assert.equal(existsSync(resolve(sandboxStorageRoot, storedFile.storageKey)), true);
    assert.equal(existsSync(resolve(repoRoot, "storage", "vectors", "kb-storage-root.json")), false);
    assert.equal(existsSync(resolve(sandboxStorageRoot, "vectors", "kb-storage-root.json")), true);
  } finally {
    if (previousStorageRoot === undefined) {
      delete process.env.STORAGE_ROOT;
    } else {
      process.env.STORAGE_ROOT = previousStorageRoot;
    }
    process.chdir(previousCwd);
    await rm(sandboxStorageRoot, { recursive: true, force: true });
  }
});
