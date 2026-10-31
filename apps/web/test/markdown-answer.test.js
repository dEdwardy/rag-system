import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  buildCitationMarkdown,
  parseCitationHref
} from '../src/pages/chat/markdown-answer.ts';

test('buildCitationMarkdown turns text markers into citation links', () => {
  assert.equal(
    buildCitationMarkdown('Alpha[1] and **Beta**[2].'),
    'Alpha[1](citation:1) and **Beta**[2](citation:2).'
  );
});

test('buildCitationMarkdown leaves code spans and fenced blocks untouched', () => {
  assert.equal(
    buildCitationMarkdown('Use `arr[1]` here[2].\n\n```ts\nvalue[3]\n```'),
    'Use `arr[1]` here[2](citation:2).\n\n```ts\nvalue[3]\n```'
  );
});

test('parseCitationHref only accepts citation links', () => {
  assert.equal(parseCitationHref('citation:3'), 3);
  assert.equal(parseCitationHref('https://example.com'), null);
  assert.equal(parseCitationHref('citation:0'), null);
});
