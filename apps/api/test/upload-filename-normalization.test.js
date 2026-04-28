import assert from 'node:assert/strict';
import { test } from 'vitest';

import { DocumentsService } from '../src/modules/documents/documents.service.ts';
import { normalizeUploadedFilename } from '../src/common/upload-filename.ts';

test('normalizeUploadedFilename repairs latin1-mojibake Chinese filenames', () => {
  const mojibakeName = Buffer.from('中文资料.md', 'utf8').toString('latin1');

  assert.equal(normalizeUploadedFilename(mojibakeName), '中文资料.md');
});

test('normalizeUploadedFilename leaves regular ASCII filenames unchanged', () => {
  assert.equal(normalizeUploadedFilename('notes.md'), 'notes.md');
});

test('DocumentsService uploadDocument persists normalized uploaded filenames', async () => {
  const savedFiles = [];
  const createdDocuments = [];
  const createdRuns = [];
  const enqueuedDocuments = [];
  const mojibakeName = Buffer.from('中文资料.md', 'utf8').toString('latin1');

  const fakeService = Object.assign(Object.create(DocumentsService.prototype), {
    storageService: {
      saveUploadedFile: async (input) => {
        savedFiles.push(input);
        return {
          storageKey: 'uploads/normalized-name.md',
          absolutePath: null
        };
      }
    },
    createDocument: async (knowledgeBaseId, input, scope) => {
      createdDocuments.push({ knowledgeBaseId, input, scope });
      return {
        id: 'document-upload-1',
        version: 1,
        ...input
      };
    },
    documentRunsService: {
      createRun: async (input) => {
        createdRuns.push(input);
      }
    },
    enqueueIngestionDocumentOrRecordFailure: async (document) => {
      enqueuedDocuments.push(document);
    }
  });

  const document = await DocumentsService.prototype.uploadDocument.call(
    fakeService,
    'default-kb',
    {
      buffer: Buffer.from('# hello', 'utf8'),
      originalname: mojibakeName,
      mimetype: 'text/markdown'
    },
    {
      tenantId: 'tenant-1',
      userId: 'user-1'
    }
  );

  assert.equal(savedFiles[0].originalName, '中文资料.md');
  assert.equal(createdDocuments[0].input.sourceName, '中文资料.md');
  assert.equal(createdDocuments[0].input.title, '中文资料.md');
  assert.deepEqual(createdRuns, [
    {
      documentId: 'document-upload-1',
      version: 1,
      trigger: 'upload'
    }
  ]);
  assert.deepEqual(enqueuedDocuments, [document]);
});
