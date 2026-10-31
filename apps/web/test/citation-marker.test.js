import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  resolveCitationMarkerDisplay,
  splitCitationText
} from '../src/pages/chat/citation-marker.ts';

test('splitCitationText separates plain text from numeric markers', () => {
  assert.deepEqual(splitCitationText('Alpha[1] beta[22]'), [
    { type: 'text', text: 'Alpha' },
    { type: 'marker', number: 1 },
    { type: 'text', text: ' beta' },
    { type: 'marker', number: 22 }
  ]);
});

test('splitCitationText keeps bracketed text that is not a numeric marker', () => {
  assert.deepEqual(splitCitationText('see [note] and [3]'), [
    { type: 'text', text: 'see [note] and ' },
    { type: 'marker', number: 3 }
  ]);
});

test('resolveCitationMarkerDisplay prefers real citations when known', () => {
  assert.deepEqual(
    resolveCitationMarkerDisplay({
      number: 2,
      citationCount: 3,
      streaming: true
    }),
    { kind: 'citation', number: 2 }
  );
});

test('resolveCitationMarkerDisplay renders unknown markers as placeholders while streaming', () => {
  assert.deepEqual(
    resolveCitationMarkerDisplay({
      number: 4,
      citationCount: 1,
      streaming: true
    }),
    { kind: 'placeholder', number: 4 }
  );
});

test('resolveCitationMarkerDisplay falls back to literal text once streaming ends', () => {
  assert.deepEqual(
    resolveCitationMarkerDisplay({
      number: 4,
      citationCount: 1,
      streaming: false
    }),
    { kind: 'text', text: '[4]' }
  );
});
