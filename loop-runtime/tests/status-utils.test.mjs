import { describe, expect, it } from 'vitest';
import { formatStatusLine } from '../core/status-utils.mjs';

describe('status-utils', () => {
  it('formatStatusLine reports stopped for completed stale state', () => {
    const line = formatStatusLine({
      state: {
        pid: 123,
        status: 'stopping',
        activeWave: 'wave-a',
        executionBackend: 'opencode'
      },
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

    expect(line).toBe(
      'stopped backend=opencode wave=wave-a pending=0 completed=5'
    );
  });

  it('formatStatusLine keeps stale marker for incomplete dead runner state', () => {
    const line = formatStatusLine({
      state: {
        pid: 123,
        phase: 'executing',
        activeWave: 'wave-a',
        executionBackend: 'opencode'
      },
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

    expect(line).toBe(
      'stale state pid=123 backend=opencode wave=wave-a pending=2 completed=1 phase=executing'
    );
  });

  it('formatStatusLine reports blocked for live blocked runner state', () => {
    const line = formatStatusLine({
      state: {
        pid: 123,
        phase: 'blocked',
        activeWave: 'wave-a',
        pendingCount: 1,
        currentItemId: 'item-b',
        blockedOn: 'item-a',
        executionBackend: 'opencode'
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

    expect(line).toBe(
      'blocked pid=123 backend=opencode wave=wave-a pending=1 item=item-b reason=item-a log=.opencode/loop/loop-run.log'
    );
  });

  it('formatStatusLine reports codex backend from runner heartbeat state', () => {
    const line = formatStatusLine({
      state: {
        pid: 123,
        phase: 'executing',
        activeWave: 'wave-a',
        pendingCount: 1,
        currentItemId: 'item-c',
        currentItemTitle: 'Tighten loop status output',
        executionBackend: 'codex'
      },
      summary: {
        activeWave: 'wave-a',
        pendingCount: 1,
        completedCount: 2,
        inProgressCount: 1,
        totalCount: 4
      },
      pidAlive: () => true,
      relativePath: '.opencode/loop/loop-run.log'
    });

    expect(line).toBe(
      'running pid=123 backend=codex wave=wave-a pending=1 item=item-c title="Tighten loop status output" log=.opencode/loop/loop-run.log'
    );
  });

  it('formatStatusLine reports blocked for dead blocked state without calling it stale', () => {
    const line = formatStatusLine({
      state: {
        pid: 123,
        phase: 'blocked',
        activeWave: 'wave-a',
        blockedOn: 'item-a',
        executionBackend: 'opencode'
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

    expect(line).toBe(
      'blocked backend=opencode wave=wave-a pending=1 completed=3 reason=item-a'
    );
  });

  it('formatStatusLine prefers needs_replan attention state for live runner', () => {
    const line = formatStatusLine({
      state: {
        pid: 123,
        phase: 'needs_replan',
        activeWave: 'wave-a',
        pendingCount: 2,
        currentItemId: 'item-c',
        currentItemStatus: 'needs_replan',
        executionBackend: 'opencode'
      },
      summary: {
        activeWave: 'wave-a',
        pendingCount: 2,
        completedCount: 3,
        inProgressCount: 0,
        totalCount: 6
      },
      pidAlive: () => true,
      relativePath: '.opencode/loop/loop-run.log'
    });

    expect(line).toBe(
      'attention pid=123 backend=opencode wave=wave-a pending=2 item=item-c reason=needs_replan log=.opencode/loop/loop-run.log'
    );
  });

  it('formatStatusLine reports idle timeout reason for stale attention state', () => {
    const line = formatStatusLine({
      state: {
        pid: 123,
        phase: 'needs_replan',
        activeWave: 'wave-a',
        currentItemId: 'item-d',
        currentItemIdleTimedOut: true,
        currentItemStatus: 'needs_replan',
        executionBackend: 'opencode'
      },
      summary: {
        activeWave: 'wave-a',
        pendingCount: 1,
        completedCount: 4,
        inProgressCount: 0,
        totalCount: 6
      },
      pidAlive: () => false,
      relativePath: '.opencode/loop/loop-run.log'
    });

    expect(line).toBe(
      'attention backend=opencode wave=wave-a pending=1 completed=4 item=item-d reason=idle_progress_timeout'
    );
  });

  it('formatStatusLine includes item title for live attention state', () => {
    const line = formatStatusLine({
      state: {
        pid: 123,
        phase: 'needs_replan',
        activeWave: 'wave-a',
        pendingCount: 2,
        currentItemId: 'item-e',
        currentItemTitle: 'Fix quoted "status" line',
        currentItemStatus: 'needs_replan',
        executionBackend: 'opencode'
      },
      summary: {
        activeWave: 'wave-a',
        pendingCount: 2,
        completedCount: 3,
        inProgressCount: 0,
        totalCount: 6
      },
      pidAlive: () => true,
      relativePath: '.opencode/loop/loop-run.log'
    });

    expect(line).toBe(
      'attention pid=123 backend=opencode wave=wave-a pending=2 item=item-e title="Fix quoted \\\"status\\\" line" reason=needs_replan log=.opencode/loop/loop-run.log'
    );
  });
});
