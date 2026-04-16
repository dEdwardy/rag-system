import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRunnerIteration } from './runner-loop-policy.mjs';

test('nextRunnerIteration keeps loop running after needs_replan item', () => {
  assert.deepEqual(
    nextRunnerIteration({
      itemProcessed: true,
      itemStatus: 'needs_replan',
      stopRequested: false,
    }),
    {
      shouldStop: false,
      progressed: true,
    },
  );
});

test('nextRunnerIteration only stops when stop was explicitly requested', () => {
  assert.deepEqual(
    nextRunnerIteration({
      itemProcessed: true,
      itemStatus: 'completed',
      stopRequested: true,
    }),
    {
      shouldStop: true,
      progressed: true,
    },
  );
});
