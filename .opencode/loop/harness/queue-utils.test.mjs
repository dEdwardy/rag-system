import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRunnableItem } from './queue-utils.mjs';

test('nextRunnableItem skips failed item and continues with later runnable work', () => {
  const queue = {
    materializedWaveId: 'wave-a',
    items: [
      { id: 'a', status: 'needs_replan', dependsOn: [] },
      { id: 'b', status: 'pending', dependsOn: [] },
      { id: 'c', status: 'pending', dependsOn: ['a'] },
    ],
  };

  assert.equal(nextRunnableItem(queue)?.id, 'b');
});
