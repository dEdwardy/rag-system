import test from 'node:test';
import assert from 'node:assert/strict';
import { formatStatusLine } from './status-utils.mjs';

test('formatStatusLine reports stopped for completed stale state', () => {
  const line = formatStatusLine({
    state: { pid: 123, status: 'stopping', activeWave: 'wave-a' },
    summary: { activeWave: 'wave-a', pendingCount: 0, completedCount: 5, inProgressCount: 0, totalCount: 5 },
    pidAlive: () => false,
    relativePath: '.opencode/loop/loop-run.log',
  });

  assert.equal(line, 'stopped wave=wave-a pending=0 completed=5');
});

test('formatStatusLine keeps stale marker for incomplete dead runner state', () => {
  const line = formatStatusLine({
    state: { pid: 123, phase: 'executing', activeWave: 'wave-a' },
    summary: { activeWave: 'wave-a', pendingCount: 2, completedCount: 1, inProgressCount: 0, totalCount: 5 },
    pidAlive: () => false,
    relativePath: '.opencode/loop/loop-run.log',
  });

  assert.equal(line, 'stale state pid=123 wave=wave-a pending=2 completed=1 phase=executing');
});
