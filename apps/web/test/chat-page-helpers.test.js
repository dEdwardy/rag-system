import { test } from 'vitest';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const helperModuleUrl = pathToFileURL(
  resolve(__dirname, '../src/pages/chat/chat-page-helpers.ts')
).href;

async function loadChatPageHelpers() {
  return import(helperModuleUrl);
}

test('chat page helpers format conversation updated time for english locale', async () => {
  const { formatConversationUpdatedAt } = await loadChatPageHelpers();

  const result = formatConversationUpdatedAt('2026-03-21T09:30:00.000Z', 'en');

  assert.match(result, /Mar/);
  assert.match(result, /21/);
});

test('chat page helpers format message time for english locale', async () => {
  const { formatMessageTime } = await loadChatPageHelpers();

  const result = formatMessageTime('2026-03-21T09:30:00.000Z', 'en');

  assert.match(result, /:30/);
});

test('chat page helpers build citation context with page and section', async () => {
  const { buildCitationContext } = await loadChatPageHelpers();

  const result = buildCitationContext(
    {
      chunkId: 'chunk-1',
      documentId: 'document-1',
      documentTitle: 'Spec',
      pageNo: 4,
      sectionTitle: 'Streaming',
      snippet: '...'
    },
    {
      pageLabel: (pageNo) => `page ${pageNo}`
    }
  );

  assert.equal(result, 'Spec • page 4 • Streaming');
});

test('chat page helpers omit empty citation context parts', async () => {
  const { buildCitationContext } = await loadChatPageHelpers();

  const result = buildCitationContext(
    {
      chunkId: 'chunk-2',
      documentId: 'document-1',
      documentTitle: 'Spec',
      pageNo: null,
      sectionTitle: null,
      snippet: '...'
    },
    {
      pageLabel: (pageNo) => `page ${pageNo}`
    }
  );

  assert.equal(result, 'Spec');
});

test('chat page helpers trim citation section title readability text', async () => {
  const { buildCitationContext } = await loadChatPageHelpers();

  const result = buildCitationContext(
    {
      chunkId: 'chunk-3',
      documentId: 'document-1',
      documentTitle: 'Spec',
      pageNo: null,
      sectionTitle: '  Streaming  ',
      snippet: '...'
    },
    {
      pageLabel: (pageNo) => `page ${pageNo}`
    }
  );

  assert.equal(result, 'Spec • Streaming');
});

test('chat page helpers skip whitespace-only citation section title', async () => {
  const { buildCitationContext } = await loadChatPageHelpers();

  const result = buildCitationContext(
    {
      chunkId: 'chunk-4',
      documentId: 'document-1',
      documentTitle: 'Spec',
      pageNo: 7,
      sectionTitle: '   ',
      snippet: '...'
    },
    {
      pageLabel: (pageNo) => `page ${pageNo}`
    }
  );

  assert.equal(result, 'Spec • page 7');
});

test('chat page helpers strip markdown heading marker from citation section title', async () => {
  const { buildCitationContext } = await loadChatPageHelpers();

  const result = buildCitationContext(
    {
      chunkId: 'chunk-4a',
      documentId: 'document-1',
      documentTitle: 'Spec',
      pageNo: 7,
      sectionTitle: '### Streaming Details',
      snippet: '...'
    },
    {
      pageLabel: (pageNo) => `page ${pageNo}`
    }
  );

  assert.equal(result, 'Spec • page 7 • Streaming Details');
});

test('chat page helpers skip duplicate citation section title when it matches source title', async () => {
  const { buildCitationContext } = await loadChatPageHelpers();

  const result = buildCitationContext(
    {
      chunkId: 'chunk-4b',
      documentId: 'document-1',
      documentTitle: 'Spec',
      pageNo: 7,
      sectionTitle: ' spec ',
      snippet: '...'
    },
    {
      pageLabel: (pageNo) => `page ${pageNo}`
    }
  );

  assert.equal(result, 'Spec • page 7');
});

test('chat page helpers skip whitespace-only citation source title', async () => {
  const { buildCitationContext } = await loadChatPageHelpers();

  const result = buildCitationContext(
    {
      chunkId: 'chunk-5',
      documentId: 'document-1',
      documentTitle: '   ',
      pageNo: 7,
      sectionTitle: 'Overview',
      snippet: '...'
    },
    {
      pageLabel: (pageNo) => `page ${pageNo}`
    }
  );

  assert.equal(result, 'page 7 • Overview');
});

test('chat page helpers resolve no active knowledge base readiness', async () => {
  const { buildChatReadinessState } = await loadChatPageHelpers();

  const result = buildChatReadinessState(null, false);

  assert.deepEqual(result, { kind: 'no_active_knowledge_base' });
});

test('chat page helpers resolve no-documents readiness', async () => {
  const { buildChatReadinessState } = await loadChatPageHelpers();

  const result = buildChatReadinessState(
    {
      totalDocuments: 0,
      readyDocuments: 0,
      processingDocuments: 0,
      failedDocuments: 0,
      totalChunks: 0
    },
    true
  );

  assert.deepEqual(result, { kind: 'no_documents' });
});

test('chat page helpers keep library ready when some documents are already ready', async () => {
  const { buildChatReadinessState } = await loadChatPageHelpers();

  const result = buildChatReadinessState(
    {
      totalDocuments: 4,
      readyDocuments: 1,
      processingDocuments: 2,
      failedDocuments: 1,
      totalChunks: 12
    },
    true
  );

  assert.deepEqual(result, { kind: 'ready' });
});

test('chat page helpers show failed readiness when no document is ready yet', async () => {
  const { buildChatReadinessState } = await loadChatPageHelpers();

  const result = buildChatReadinessState(
    {
      totalDocuments: 4,
      readyDocuments: 0,
      processingDocuments: 2,
      failedDocuments: 1,
      totalChunks: 12
    },
    true
  );

  assert.deepEqual(result, { kind: 'failed_documents', count: 1 });
});

test('chat page helpers resolve processing readiness', async () => {
  const { buildChatReadinessState } = await loadChatPageHelpers();

  const result = buildChatReadinessState(
    {
      totalDocuments: 3,
      readyDocuments: 0,
      processingDocuments: 2,
      failedDocuments: 0,
      totalChunks: 8
    },
    true
  );

  assert.deepEqual(result, { kind: 'processing_documents', count: 2 });
});

test('chat page helpers treat library as ready when some documents are already ready', async () => {
  const { buildChatReadinessState } = await loadChatPageHelpers();

  const result = buildChatReadinessState(
    {
      totalDocuments: 3,
      readyDocuments: 1,
      processingDocuments: 2,
      failedDocuments: 0,
      totalChunks: 8
    },
    true
  );

  assert.deepEqual(result, { kind: 'ready' });
});

test('chat page helpers resolve ready state', async () => {
  const { buildChatReadinessState } = await loadChatPageHelpers();

  const result = buildChatReadinessState(
    {
      totalDocuments: 2,
      readyDocuments: 2,
      processingDocuments: 0,
      failedDocuments: 0,
      totalChunks: 10
    },
    true
  );

  assert.deepEqual(result, { kind: 'ready' });
});

test('chat page helpers build starter questions for chinese chat context', async () => {
  const { buildStarterQuestions } = await loadChatPageHelpers();

  const result = buildStarterQuestions('zh', 'chat');

  assert.equal(result.length, 3);
  assert.equal(result[0], '这份资料主要讲了什么？');
});

test('chat page helpers build starter questions for english chat context', async () => {
  const { buildStarterQuestions } = await loadChatPageHelpers();

  const result = buildStarterQuestions('en', 'chat');

  assert.equal(result.length, 3);
  assert.equal(result[0], 'What is this library mainly about?');
});

test('chat page helpers build starter questions for documents context', async () => {
  const { buildStarterQuestions } = await loadChatPageHelpers();

  const zhResult = buildStarterQuestions('zh', 'documents');
  const enResult = buildStarterQuestions('en', 'documents');

  assert.equal(zhResult[0], '这批资料主要讲了什么？');
  assert.equal(enResult[0], 'What are these library items mainly about?');
});

test('chat page helpers build chat starter question href', async () => {
  const { buildChatStarterQuestionHref } = await loadChatPageHelpers();

  const result = buildChatStarterQuestionHref(
    '  What are these items about?  '
  );

  assert.equal(result, '/?starterQuestion=What+are+these+items+about%3F');
});

test('chat page helpers parse chat starter question from search', async () => {
  const { parseChatStarterQuestionFromSearch } = await loadChatPageHelpers();

  assert.equal(
    parseChatStarterQuestionFromSearch(
      '?starterQuestion=What+are+these+items+about%3F'
    ),
    'What are these items about?'
  );
  assert.equal(parseChatStarterQuestionFromSearch('?starterQuestion=+'), null);
  assert.equal(parseChatStarterQuestionFromSearch(''), null);
});
