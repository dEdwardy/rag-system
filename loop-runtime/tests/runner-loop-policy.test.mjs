import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextRunnerIteration,
  shouldStopAfterNoProgress
} from '../core/runner-loop-policy.mjs';

test('nextRunnerIteration keeps loop running after needs_replan item', () => {
  assert.deepEqual(
    nextRunnerIteration({
      itemProcessed: true,
      itemStatus: 'needs_replan',
      stopRequested: false
    }),
    {
      shouldStop: false,
      progressed: true
    }
  );
});

test('nextRunnerIteration only stops when stop was explicitly requested', () => {
  assert.deepEqual(
    nextRunnerIteration({
      itemProcessed: true,
      itemStatus: 'completed',
      stopRequested: true
    }),
    {
      shouldStop: true,
      progressed: true
    }
  );
});

test('shouldStopAfterNoProgress stops blocked runner loops only after maxBlockedRetries', () => {
  assert.equal(shouldStopAfterNoProgress('blocked', 0), false);
  assert.equal(shouldStopAfterNoProgress('blocked', 2), false);
  assert.equal(shouldStopAfterNoProgress('blocked', 3), true);
  assert.equal(shouldStopAfterNoProgress('idle', 0), true);
  assert.equal(shouldStopAfterNoProgress('executing', 0), false);
});
