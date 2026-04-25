import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextRunnerIteration,
  shouldStopAfterNoProgress
} from '../core/runner-loop-policy.mjs';
import {
  buildHeartbeatSignature,
  shouldWriteHeartbeatLog
} from '../core/heartbeat-log-utils.mjs';

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

test('buildHeartbeatSignature stays stable for repeated identical summaries', () => {
  const summary = {
    activeWave: 'wave-a',
    pendingCount: 1,
    totalCount: 4,
    blockedCount: 0
  };
  const currentRun = {
    phase: 'executing',
    currentItemId: 'item-a',
    lastResult: null,
    blockedOn: null
  };

  assert.equal(
    buildHeartbeatSignature(summary, currentRun, false),
    buildHeartbeatSignature(summary, currentRun, false)
  );
});

test('shouldWriteHeartbeatLog suppresses repeated identical heartbeats', () => {
  const summary = {
    activeWave: 'wave-a',
    pendingCount: 1,
    totalCount: 4,
    blockedCount: 0
  };
  const currentRun = {
    phase: 'executing',
    currentItemId: 'item-a',
    lastResult: null,
    blockedOn: null
  };
  const first = shouldWriteHeartbeatLog({
    summary,
    currentRunState: currentRun,
    isStopping: false,
    previousSignature: null
  });
  const second = shouldWriteHeartbeatLog({
    summary,
    currentRunState: currentRun,
    isStopping: false,
    previousSignature: first.signature
  });

  assert.equal(first.shouldWrite, true);
  assert.equal(second.shouldWrite, false);
});
