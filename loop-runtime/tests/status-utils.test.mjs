import test from 'node:test';
import assert from 'node:assert/strict';
import { formatStatusLine } from '../core/status-utils.mjs';

test('formatStatusLine reports stopped for completed stale state', () => {
  const line = formatStatusLine({
    state: { pid: 123, status: 'stopping', activeWave: 'wave-a' },
    summary: {
      activeWave: 'wave-a',
      pendingCount: 0,
      completedCount: 5,
      inProgressCount: 0,
      totalCount: 5
    },
    pidAlive: () => false,
    relativePath: '.opencode/loop/loop-run.log'
  });

  assert.equal(
    line,
    'stopped backend=opencode wave=wave-a pending=0 completed=5'
  );
});

test('formatStatusLine keeps stale marker for incomplete dead runner state', () => {
  const line = formatStatusLine({
    state: { pid: 123, phase: 'executing', activeWave: 'wave-a' },
    summary: {
      activeWave: 'wave-a',
      pendingCount: 2,
      completedCount: 1,
      inProgressCount: 0,
      totalCount: 5
    },
    pidAlive: () => false,
    relativePath: '.opencode/loop/loop-run.log'
  });

  assert.equal(
    line,
    'stale state pid=123 backend=opencode wave=wave-a pending=2 completed=1 phase=executing'
  );
});

test('formatStatusLine reports blocked for live blocked runner state', () => {
  const line = formatStatusLine({
    state: {
      pid: 123,
      phase: 'blocked',
      activeWave: 'wave-a',
      pendingCount: 1,
      currentItemId: 'item-b',
      blockedOn: 'item-a'
    },
    summary: {
      activeWave: 'wave-a',
      pendingCount: 1,
      completedCount: 3,
      inProgressCount: 0,
      totalCount: 5
    },
    pidAlive: () => true,
    relativePath: '.opencode/loop/loop-run.log'
  });

  assert.equal(
    line,
    'blocked pid=123 backend=opencode wave=wave-a pending=1 item=item-b blockedOn=item-a log=.opencode/loop/loop-run.log'
  );
});

test('formatStatusLine reports blocked for dead blocked state without calling it stale', () => {
  const line = formatStatusLine({
    state: {
      pid: 123,
      phase: 'blocked',
      activeWave: 'wave-a',
      blockedOn: 'item-a'
    },
    summary: {
      activeWave: 'wave-a',
      pendingCount: 1,
      completedCount: 3,
      inProgressCount: 0,
      totalCount: 5
    },
    pidAlive: () => false,
    relativePath: '.opencode/loop/loop-run.log'
  });

  assert.equal(
    line,
    'blocked backend=opencode wave=wave-a pending=1 completed=3 blockedOn=item-a'
  );
});
