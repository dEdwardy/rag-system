import { describe, expect, it } from 'vitest';
import {
  dependenciesSatisfied,
  nextRunnableItem,
  reconcileQueue,
  sanitizeQueueText,
  summarizeExecutionOutput
} from '../core/queue-utils.mjs';

describe('queue-utils', () => {
  it('nextRunnableItem skips failed item and continues with later runnable work', () => {
    const queue = {
      materializedWaveId: 'wave-a',
      items: [
        { id: 'a', status: 'needs_replan', dependsOn: [] },
        { id: 'b', status: 'pending', dependsOn: [] },
        { id: 'c', status: 'pending', dependsOn: ['a'] }
      ]
    };

    expect(nextRunnableItem(queue)?.id).toBe('b');
  });

  it('dependenciesSatisfied requires upstream completion even after needs_replan', () => {
    const queue = {
      materializedWaveId: 'wave-a',
      items: [
        { id: 'a', status: 'needs_replan', dependsOn: [] },
        { id: 'b', status: 'pending', dependsOn: ['a'] }
      ]
    };

    expect(dependenciesSatisfied(queue, queue.items[1])).toBe(false);
    expect(nextRunnableItem(queue)).toBeNull();
  });

  it('reconcileQueue promotes stale completed queue results', () => {
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

    expect(reconcileQueue(queue)).toBe(true);
    expect(queue.items[0].status).toBe('completed');
    expect(nextRunnableItem(queue)?.id).toBe('b');
  });

  it('reconcileQueue promotes benign missing_queue_result failures', () => {
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

    expect(reconcileQueue(queue)).toBe(true);
    expect(queue.items[0].status).toBe('completed');
    expect(queue.items[0].queueResultStatus).toBe('completed');
    expect(nextRunnableItem(queue)?.id).toBe('b');
  });

  it('reconcileQueue promotes missing_queue_result failures with commit evidence', () => {
    const queue = {
      materializedWaveId: 'wave-a',
      items: [
        {
          id: 'a',
          status: 'needs_replan',
          failureReason: 'missing_queue_result',
          resultExitCode: 1,
          queueResultCommit: '9cf815cb7abb997ffe52f6b61e343cf67cda0e7b',
          finishedAt: '2026-04-25T00:00:00.000Z'
        },
        { id: 'b', status: 'pending', dependsOn: ['a'] }
      ]
    };

    expect(reconcileQueue(queue)).toBe(true);
    expect(queue.items[0].status).toBe('completed');
    expect(queue.items[0].queueResultStatus).toBe('completed');
    expect(nextRunnableItem(queue)?.id).toBe('b');
  });

  it('reconcileQueue promotes completed QUEUE_RESULT captured in lastRunSummary', () => {
    const queue = {
      materializedWaveId: 'wave-a',
      items: [
        {
          id: 'a',
          status: 'needs_replan',
          failureReason: 'missing_queue_result',
          resultExitCode: 0,
          lastRunSummary:
            'QUEUE_RESULT status=completed item=a validation=pnpm_test changed_files=loop-runtime/core/queue-utils.mjs commit=abc123',
          finishedAt: '2026-04-25T00:00:00.000Z'
        },
        { id: 'b', status: 'pending', dependsOn: ['a'] }
      ]
    };

    expect(reconcileQueue(queue)).toBe(true);
    expect(queue.items[0].status).toBe('completed');
    expect(queue.items[0].queueResultStatus).toBe('completed');
    expect(queue.items[0].queueResultCommit).toBe('abc123');
    expect(nextRunnableItem(queue)?.id).toBe('b');
  });

  it('reconcileQueue ignores needs_replan QUEUE_RESULT captured in lastRunSummary', () => {
    const queue = {
      materializedWaveId: 'wave-a',
      items: [
        {
          id: 'a',
          status: 'needs_replan',
          resultExitCode: 0,
          lastRunSummary:
            'QUEUE_RESULT status=needs_replan item=a validation=pnpm_test changed_files=loop-runtime/tests/queue-utils.test.mjs commit=none',
          finishedAt: '2026-04-25T00:00:00.000Z'
        },
        { id: 'b', status: 'pending', dependsOn: ['a'] }
      ]
    };

    expect(reconcileQueue(queue)).toBe(false);
    expect(queue.items[0].status).toBe('needs_replan');
    expect(nextRunnableItem(queue)).toBeNull();
  });

  it('summarizeExecutionOutput keeps only the queue result line from noisy output', () => {
    const stdout = `${'x'.repeat(3000)}\nQUEUE_RESULT status=completed item=a validation=pnpm_exec_vitest changed_files=loop-runtime/core/queue-utils.mjs commit=abc123\n`;

    expect(summarizeExecutionOutput(stdout, '')).toBe(
      'QUEUE_RESULT status=completed item=a validation=pnpm_exec_vitest changed_files=loop-runtime/core/queue-utils.mjs commit=abc123'
    );
  });

  it('sanitizeQueueText removes replacement characters and truncates long values', () => {
    const value = `bad\uFFFDoutput ${'a'.repeat(500)}`;
    const sanitized = sanitizeQueueText(value, 80);

    expect(sanitized).not.toContain('\uFFFD');
    expect(sanitized).toContain('[truncated ');
    expect(sanitized.length).toBeLessThanOrEqual(80);
  });
});
