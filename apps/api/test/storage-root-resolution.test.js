import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test, vi } from 'vitest';

import { LocalStorageProviderService } from '../src/infra/storage/storage-provider.service.ts';
import { resolveStorageRoot } from '../src/infra/storage/storage-root.ts';
import { StorageService } from '../src/infra/storage/storage.service.ts';
import { VectorStoreService } from '../src/infra/vector-store/vector-store.service.ts';

test('resolveStorageRoot keeps the default storage directory anchored to repo root even when cwd is apps/api', () => {
  const repoRoot = resolve(__dirname, '..', '..', '..');
  const apiRoot = resolve(repoRoot, 'apps/api');

  expect(
    resolveStorageRoot({
      cwd: apiRoot,
      moduleDir: resolve(apiRoot, 'src/infra/storage'),
      env: {}
    })
  ).toBe(resolve(repoRoot, 'storage'));
});

test('resolveStorageRoot resolves relative STORAGE_ROOT against repo root instead of cwd', () => {
  const repoRoot = resolve(__dirname, '..', '..', '..');
  const apiRoot = resolve(repoRoot, 'apps/api');

  expect(
    resolveStorageRoot({
      cwd: apiRoot,
      moduleDir: resolve(apiRoot, 'src/infra/storage'),
      env: { STORAGE_ROOT: 'storage/local-dev' }
    })
  ).toBe(resolve(repoRoot, 'storage/local-dev'));
});

test('storage-backed services share the same repo-root-relative storage root behavior', async () => {
  const repoRoot = resolve(__dirname, '..', '..', '..');
  const apiRoot = resolve(repoRoot, 'apps/api');
  const previousStorageRoot = process.env.STORAGE_ROOT;
  const sandboxStorageRoot = await mkdtemp(join(tmpdir(), 'rag-storage-root-'));
  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(apiRoot);

  try {
    process.env.STORAGE_ROOT = sandboxStorageRoot;
    const storageProvider = new LocalStorageProviderService();
    const storageService = new StorageService(storageProvider);
    const vectorStoreService = new VectorStoreService(storageProvider);
    const storedFile = await storageService.saveGeneratedTextFile({
      content: 'repo-root-stable'
    });

    expect(storageService.getStorageRoot()).toBe(sandboxStorageRoot);
    await vectorStoreService.replaceDocumentVectors({
      kbId: 'kb-storage-root',
      documentId: 'doc-storage-root',
      records: [
        {
          id: 'chunk-storage-root',
          kbId: 'kb-storage-root',
          documentId: 'doc-storage-root',
          chunkId: 'chunk-storage-root',
          chunkIndex: 0,
          sectionTitle: 'Overview',
          pageNo: 1,
          content: 'vector content',
          embedding: {
            provider: 'fallback',
            model: 'hash-v1',
            modelName: 'fallback:hash-v1',
            dimensions: 3,
            provenance: {
              modelSource: 'builtin:fallback',
              dimensionsSource: 'builtin:fallback',
              fallback: 'local_deterministic'
            },
            vector: [1, 0, 0]
          },
          metadata: {}
        }
      ]
    });

    expect(storedFile.storageKey.startsWith('generated/')).toBe(true);
    expect(existsSync(resolve(sandboxStorageRoot, storedFile.storageKey))).toBe(
      true
    );
    expect(
      existsSync(
        resolve(repoRoot, 'storage', 'vectors', 'kb-storage-root.json')
      )
    ).toBe(false);
    expect(
      existsSync(resolve(sandboxStorageRoot, 'vectors', 'kb-storage-root.json'))
    ).toBe(true);
  } finally {
    cwdSpy.mockRestore();
    if (previousStorageRoot === undefined) {
      delete process.env.STORAGE_ROOT;
    } else {
      process.env.STORAGE_ROOT = previousStorageRoot;
    }
    await rm(sandboxStorageRoot, { recursive: true, force: true });
  }
});
