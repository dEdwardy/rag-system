import assert from 'node:assert/strict';
import { test } from 'vitest';

import { isConversationReuseEnabled } from '../src/modules/assistants/conversation-reuse-flag.ts';

test('conversation reuse is disabled by default', () => {
  assert.equal(isConversationReuseEnabled({}), false);
  assert.equal(isConversationReuseEnabled({ ASK_CONVERSATION_REUSE: '' }), false);
});

test('conversation reuse only turns on for an explicit true', () => {
  assert.equal(isConversationReuseEnabled({ ASK_CONVERSATION_REUSE: 'true' }), true);
  assert.equal(isConversationReuseEnabled({ ASK_CONVERSATION_REUSE: ' TRUE ' }), true);
  assert.equal(isConversationReuseEnabled({ ASK_CONVERSATION_REUSE: 'false' }), false);
  assert.equal(isConversationReuseEnabled({ ASK_CONVERSATION_REUSE: '1' }), false);
});
