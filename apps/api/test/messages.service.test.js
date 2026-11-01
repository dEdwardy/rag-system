import assert from 'node:assert/strict';
import { test } from 'vitest';

import { MessagesService } from '../src/modules/messages/messages.service.ts';

function createService(options) {
  const messages = options.messages ?? [];
  const traces = options.traces ?? [];
  let requestedTraceIds = [];

  const prisma = {
    message: {
      findMany: async () => messages
    },
    answerTrace: {
      findMany: async (args) => {
        requestedTraceIds = args?.where?.id?.in ?? [];
        return traces.filter((trace) => requestedTraceIds.includes(trace.id));
      }
    }
  };

  return {
    service: new MessagesService(prisma),
    getRequestedTraceIds: () => requestedTraceIds
  };
}

function buildMessage(overrides) {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    role: 'assistant',
    content: 'answer',
    traceId: 'trace-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides
  };
}

test('listConversationMessages attaches citations stored on the answer trace', async () => {
  const { service } = createService({
    messages: [buildMessage({ role: 'user', traceId: null }), buildMessage({})],
    traces: [
      {
        id: 'trace-1',
        citationsJson: [{ chunkId: 'chunk-1', documentTitle: 'doc.md' }]
      }
    ]
  });

  const messages = await service.listConversationMessages('conversation-1');

  assert.equal(
    messages[0].citations,
    undefined,
    'user messages carry no citations'
  );
  assert.deepEqual(messages[1].citations, [
    { chunkId: 'chunk-1', documentTitle: 'doc.md' }
  ]);
});

test('listConversationMessages returns an empty citation list when the trace has none', async () => {
  const { service } = createService({
    messages: [buildMessage({ traceId: 'trace-2' })],
    traces: [{ id: 'trace-2', citationsJson: null }]
  });

  const messages = await service.listConversationMessages('conversation-1');

  assert.deepEqual(messages[0].citations, []);
});

test('listConversationMessages queries each distinct trace once', async () => {
  const { service, getRequestedTraceIds } = createService({
    messages: [
      buildMessage({ id: 'message-1', traceId: 'trace-1' }),
      buildMessage({ id: 'message-2', traceId: 'trace-1' }),
      buildMessage({ id: 'message-3', traceId: 'trace-3' })
    ],
    traces: [
      { id: 'trace-1', citationsJson: [{ chunkId: 'chunk-1' }] },
      { id: 'trace-3', citationsJson: [] }
    ]
  });

  await service.listConversationMessages('conversation-1');

  assert.deepEqual(getRequestedTraceIds().sort(), ['trace-1', 'trace-3']);
});

test('listConversationMessages skips the trace lookup when nothing is traceable', async () => {
  const { service, getRequestedTraceIds } = createService({
    messages: [buildMessage({ role: 'user', traceId: null })]
  });

  const messages = await service.listConversationMessages('conversation-1');

  assert.equal(messages[0].citations, undefined);
  assert.deepEqual(getRequestedTraceIds(), []);
});

test('listConversationMessages returns the newest page in ascending order when paged', async () => {
  const findManyCalls = [];
  const service = new MessagesService({
    message: {
      findMany: async (args) => {
        findManyCalls.push(args);
        return [
          buildMessage({ id: 'message-3' }),
          buildMessage({ id: 'message-2' }),
          buildMessage({ id: 'message-1' })
        ];
      }
    },
    answerTrace: {
      findMany: async () => []
    }
  });

  const messages = await service.listConversationMessages(
    'conversation-1',
    { tenantId: 'tenant-1', userId: 'user-1' },
    { limit: 2, before: 'message-4' }
  );

  assert.deepEqual(
    messages.map((message) => message.id),
    ['message-2', 'message-3']
  );
  assert.equal(findManyCalls.length, 1);
  assert.equal(findManyCalls[0].take, 3);
  assert.deepEqual(findManyCalls[0].cursor, { id: 'message-4' });
  assert.equal(findManyCalls[0].skip, 1);
  assert.deepEqual(findManyCalls[0].orderBy, { createdAt: 'desc' });
});
