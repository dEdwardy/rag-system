import test from 'node:test';
import assert from 'node:assert/strict';
import { wasExecutionSuperseded } from './execution-guards.mjs';

test('wasExecutionSuperseded stays false for the active in-progress attempt', () => {
  assert.equal(
    wasExecutionSuperseded(
      {
        status: 'in_progress',
        attempt: 2,
        startedAt: '2026-04-16T16:05:31.072Z'
      },
      { attempt: 2, startedAt: '2026-04-16T16:05:31.072Z' }
    ),
    false
  );
});

test('wasExecutionSuperseded becomes true when queue item was reset externally', () => {
  assert.equal(
    wasExecutionSuperseded(
      { status: 'pending', attempt: 2, startedAt: '2026-04-16T16:05:31.072Z' },
      { attempt: 2, startedAt: '2026-04-16T16:05:31.072Z' }
    ),
    true
  );
});

test('wasExecutionSuperseded becomes true when a newer attempt replaced the current run', () => {
  assert.equal(
    wasExecutionSuperseded(
      {
        status: 'in_progress',
        attempt: 3,
        startedAt: '2026-04-16T16:06:00.000Z'
      },
      { attempt: 2, startedAt: '2026-04-16T16:05:31.072Z' }
    ),
    true
  );
});
