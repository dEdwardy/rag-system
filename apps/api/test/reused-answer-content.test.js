import assert from 'node:assert/strict';
import { test } from 'vitest';

import { resolveReusableAnswerContent } from '../src/modules/assistants/reused-answer-content.ts';

test('resolveReusableAnswerContent unwraps a stored structured payload', () => {
  const content = JSON.stringify({
    answer: '冷链运输途中温度应维持在2℃至8℃。',
    status: 'grounded',
    citations: [1]
  });

  assert.equal(
    resolveReusableAnswerContent(content),
    '冷链运输途中温度应维持在2℃至8℃。'
  );
});

test('resolveReusableAnswerContent keeps plain answers untouched', () => {
  assert.equal(
    resolveReusableAnswerContent('信息不足，无法回答该问题'),
    '信息不足，无法回答该问题'
  );
});

test('resolveReusableAnswerContent keeps a payload with an empty answer', () => {
  const content = JSON.stringify({ answer: '   ', status: 'grounded' });

  assert.equal(resolveReusableAnswerContent(content), content);
});

test('resolveReusableAnswerContent keeps unparsable json-looking text', () => {
  assert.equal(resolveReusableAnswerContent('{not json'), '{not json');
});

test('resolveReusableAnswerContent keeps json without an answer field', () => {
  const content = JSON.stringify({ status: 'grounded' });

  assert.equal(resolveReusableAnswerContent(content), content);
});

test('resolveReusableAnswerContent ignores non-string answer values', () => {
  const content = JSON.stringify({ answer: { nested: true } });

  assert.equal(resolveReusableAnswerContent(content), content);
});
