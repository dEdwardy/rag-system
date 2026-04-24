import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dependenciesSatisfied,
  nextRunnableItem,
  reconcileQueue
} from '../core/queue-utils.mjs';

test('nextRunnableItem skips failed item and continues with later runnable work', () => {
  const queue = {
    materializedWaveId: 'wave-a',
    items: [
      { id: 'a', status: 'needs_replan', dependsOn: [] },
      { id: 'b', status: 'pending', dependsOn: [] },
      { id: 'c', status: 'pending', dependsOn: ['a'] }
    ]
  };

  assert.equal(nextRunnableItem(queue)?.id, 'b');
});

test('dependenciesSatisfied requires upstream completion even after needs_replan', () => {
  const queue = {
    materializedWaveId: 'wave-a',
    items: [
      { id: 'a', status: 'needs_replan', dependsOn: [] },
      { id: 'b', status: 'pending', dependsOn: ['a'] }
    ]
  };

  assert.equal(dependenciesSatisfied(queue, queue.items[1]), false);
  assert.equal(nextRunnableItem(queue), null);
});

test('reconcileQueue promotes stale completed queue results', () => {
  const queue = {
    materializedWaveId: 'wave-a',
    items: [
      {
        id: 'a',
        status: 'needs_replan',
        queueResultStatus: 'completed',
        finishedAt: '2026-04-25T00:00:00.000Z'
      },
      { id: 'b', status: 'pending', dependsOn: ['a'] }
    ]
  };

  assert.equal(reconcileQueue(queue), true);
  assert.equal(queue.items[0].status, 'completed');
  assert.equal(nextRunnableItem(queue)?.id, 'b');
});

test('reconcileQueue promotes benign missing_queue_result failures', () => {
  const queue = {
    materializedWaveId: 'wave-a',
    items: [
      {
        id: 'a',
        status: 'needs_replan',
        failureReason: 'missing_queue_result',
        resultExitCode: 0,
        finishedAt: '2026-04-25T00:00:00.000Z'
      },
      { id: 'b', status: 'pending', dependsOn: ['a'] }
    ]
  };

  assert.equal(reconcileQueue(queue), true);
  assert.equal(queue.items[0].status, 'completed');
  assert.equal(queue.items[0].queueResultStatus, 'completed');
  assert.equal(nextRunnableItem(queue)?.id, 'b');
});
