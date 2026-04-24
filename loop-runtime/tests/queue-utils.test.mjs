import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dependenciesSatisfied,
  nextRunnableItem
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
