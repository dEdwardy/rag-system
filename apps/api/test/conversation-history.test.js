import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  buildConversationHistory,
  shouldForceFollowUpRewrite
} from '../src/modules/assistants/conversation-history.ts';

test('buildConversationHistory keeps recent turns within the budget', () => {
  const history = buildConversationHistory(
    [
      { role: 'user', content: 'old question' },
      { role: 'assistant', content: 'old answer' },
      { role: 'user', content: 'recent question' },
      { role: 'assistant', content: 'recent answer' }
    ],
    { maxMessages: 2, maxChars: 100 }
  );

  assert.deepEqual(history, [
    { role: 'user', content: 'recent question' },
    { role: 'assistant', content: 'recent answer' }
  ]);
});

test('buildConversationHistory truncates long assistant messages', () => {
  const history = buildConversationHistory(
    [{ role: 'assistant', content: 'A'.repeat(1000) }],
    { assistantCharLimit: 20 }
  );

  assert.equal(history.length, 1);
  assert.equal(history[0].content.length, 20);
  assert.ok(history[0].content.endsWith('...'));
});

test('shouldForceFollowUpRewrite detects short and pronoun follow-ups', () => {
  const history = [{ role: 'user', content: 'What is the marker?' }];

  assert.equal(shouldForceFollowUpRewrite('它呢？', history), true);
  assert.equal(
    shouldForceFollowUpRewrite('expand the second point', history),
    true
  );
  assert.equal(
    shouldForceFollowUpRewrite(
      'What are the main goals of space exploration?',
      history
    ),
    false
  );
  assert.equal(shouldForceFollowUpRewrite('它呢？', []), false);
});
