import { Prisma } from '@prisma/client';
import { expect, test } from 'vitest';
import { DocumentsService } from '../src/modules/documents/documents.service.ts';

test('DocumentsService records a failed local reindex run when enqueueing ingestion fails', async () => {
  const documentUpdates = [];
  const createdRuns = [];
  const failedRuns = [];
  const skippedRuns = [];

  const existingDocument = {
    id: 'local-reindex-enqueue-failure-1',
    kbId: 'default-kb',
    sourceType: 'upload',
    sourceName: 'guide.md',
    title: 'guide.md',
    mimeType: 'text/markdown',
    storageKey: 'uploads/guide.md',
    status: 'ready',
    processingStage: 'completed',
    version: 2,
    chunkCount: 5,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    getDocument: async (documentId) => {
      expect(documentId).toBe(existingDocument.id);
      return existingDocument;
    },
    prisma: {
      document: {
        findUnique: async ({ where }) => {
          expect(where).toStrictEqual({ id: existingDocument.id });
          return {
            version: existingDocument.version + 1
          };
        },
        update: async (args) => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === 'object' &&
              args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version + 1
          };
        }
      }
    },
    documentRunsService: {
      createRun: async (input) => {
        createdRuns.push(input);
      },
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      },
      markRunSkipped: async (documentId, version, input) => {
        skippedRuns.push({ documentId, version, ...input });
      }
    },
    ingestionService: {
      enqueueDocument: async () => {
        throw new Error('Redis refused queue add.');
      }
    }
  });

  await expect(
    DocumentsService.prototype.reindexDocument.call(
      fakeService,
      existingDocument.id
    )
  ).rejects.toThrow(/Redis refused queue add/);

  expect(createdRuns).toStrictEqual([
    {
      documentId: existingDocument.id,
      version: 3,
      trigger: 'reindex'
    }
  ]);
  expect(documentUpdates).toStrictEqual([
    {
      where: { id: existingDocument.id },
      data: {
        status: 'pending',
        processingStage: 'uploaded',
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    },
    {
      where: { id: existingDocument.id },
      data: {
        status: 'failed',
        processingStage: 'failed',
        errorMessage: 'Redis refused queue add.',
        diagnosticsJson: {
          code: 'INGESTION_ENQUEUE_FAILED',
          failedStage: 'parsing',
          retryable: true,
          documentVersion: 3,
          message: 'Redis refused queue add.'
        }
      }
    }
  ]);
  expect(failedRuns).toStrictEqual([
    {
      documentId: existingDocument.id,
      version: 3,
      failedStage: 'parsing',
      diagnosticsJson: {
        code: 'INGESTION_ENQUEUE_FAILED',
        failedStage: 'parsing',
        retryable: true,
        documentVersion: 3,
        message: 'Redis refused queue add.'
      }
    }
  ]);
  expect(skippedRuns).toStrictEqual([]);
});

test('DocumentsService skips stale local enqueue failure handling when a newer document version is already active', async () => {
  const documentUpdates = [];
  const createdRuns = [];
  const failedRuns = [];
  const skippedRuns = [];

  const existingDocument = {
    id: 'local-reindex-enqueue-stale-1',
    kbId: 'default-kb',
    sourceType: 'upload',
    sourceName: 'guide.md',
    title: 'guide.md',
    mimeType: 'text/markdown',
    storageKey: 'uploads/guide.md',
    status: 'ready',
    processingStage: 'completed',
    version: 2,
    chunkCount: 5,
    errorMessage: null,
    diagnosticsJson: Prisma.JsonNull
  };

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    getDocument: async (documentId) => {
      expect(documentId).toBe(existingDocument.id);
      return existingDocument;
    },
    prisma: {
      document: {
        findUnique: async ({ where }) => {
          expect(where).toStrictEqual({ id: existingDocument.id });
          return {
            version: existingDocument.version + 2
          };
        },
        update: async (args) => {
          documentUpdates.push(args);
          return {
            ...existingDocument,
            ...args.data,
            version:
              typeof args.data.version === 'object' &&
              args.data.version.increment === 1
                ? existingDocument.version + 1
                : existingDocument.version + 1
          };
        }
      }
    },
    documentRunsService: {
      createRun: async (input) => {
        createdRuns.push(input);
      },
      markRunFailed: async (documentId, version, input) => {
        failedRuns.push({ documentId, version, ...input });
      },
      markRunSkipped: async (documentId, version, input) => {
        skippedRuns.push({ documentId, version, ...input });
      }
    },
    ingestionService: {
      enqueueDocument: async () => {
        throw new Error('Redis refused queue add.');
      }
    }
  });

  await expect(
    DocumentsService.prototype.reindexDocument.call(
      fakeService,
      existingDocument.id
    )
  ).rejects.toThrow(/Redis refused queue add/);

  expect(createdRuns).toStrictEqual([
    {
      documentId: existingDocument.id,
      version: 3,
      trigger: 'reindex'
    }
  ]);
  expect(documentUpdates).toStrictEqual([
    {
      where: { id: existingDocument.id },
      data: {
        status: 'pending',
        processingStage: 'uploaded',
        chunkCount: 0,
        errorMessage: null,
        diagnosticsJson: Prisma.JsonNull,
        version: {
          increment: 1
        }
      }
    }
  ]);
  expect(failedRuns).toStrictEqual([]);
  expect(skippedRuns).toStrictEqual([
    {
      documentId: existingDocument.id,
      version: 3,
      failedStage: 'stale_guard',
      diagnosticsJson: {
        code: 'INGESTION_RUN_SUPERSEDED',
        failedStage: 'stale_guard',
        retryable: false,
        documentVersion: 3,
        message:
          'Skipped stale ingestion enqueue failure handling because a newer document version is already active.',
        currentDocumentVersion: 4
      }
    }
  ]);
});
