import assert from 'node:assert/strict';
import { test } from 'vitest';
import { MessageFeedbackService } from '../src/modules/messages/message-feedback.service.ts';

const identity = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: 'owner',
  sessionId: null,
  authSource: 'local'
};

test('MessageFeedbackService upserts feedback for an owned assistant message', async () => {
  let upsertInput = null;

  const service = new MessageFeedbackService({
    message: {
      findFirst: async () => ({
        id: 'message-1',
        role: 'assistant',
        conversationId: 'conversation-1',
        traceId: 'trace-1'
      })
    },
    messageFeedback: {
      upsert: async (input) => {
        upsertInput = input;
        return { id: 'feedback-1', ...input.create };
      }
    }
  });

  const result = await service.submitFeedback({
    messageId: 'message-1',
    rating: 'down',
    reason: 'missing_citation',
    comment: 'The second point is unsupported.',
    identity
  });

  assert.equal(result.id, 'feedback-1');
  assert.equal(upsertInput.create.tenantId, 'tenant-1');
  assert.equal(upsertInput.create.ownerId, 'user-1');
  assert.equal(upsertInput.create.rating, 'down');
  assert.equal(upsertInput.update.rating, 'down');
});

test('MessageFeedbackService rejects feedback for user messages', async () => {
  const service = new MessageFeedbackService({
    message: {
      findFirst: async () => ({
        id: 'message-1',
        role: 'user',
        conversationId: 'conversation-1',
        traceId: null
      })
    }
  });

  await assert.rejects(
    () =>
      service.submitFeedback({
        messageId: 'message-1',
        rating: 'up',
        identity
      }),
    /assistant messages/
  );
});

test('MessageFeedbackService hides messages outside the current user scope', async () => {
  const service = new MessageFeedbackService({
    message: {
      findFirst: async () => null
    }
  });

  await assert.rejects(
    () =>
      service.submitFeedback({
        messageId: 'message-1',
        rating: 'up',
        identity
      }),
    /not found/
  );
});
