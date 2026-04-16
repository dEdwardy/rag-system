export function isCompletedSummary(summary) {
  return summary.totalCount > 0 && summary.pendingCount === 0 && summary.inProgressCount === 0;
}

export function formatStatusLine({ state, summary, pidAlive, relativePath }) {
  if (state && pidAlive(state.pid)) {
    const itemPart = state.currentItemId ? ` item=${state.currentItemId}` : '';
    const sessionPart = state.activeSessionId ? ` session=${state.activeSessionId}` : '';
    return `running pid=${state.pid} wave=${state.activeWave ?? summary.activeWave ?? 'none'} pending=${state.pendingCount ?? summary.pendingCount}${itemPart}${sessionPart} log=${relativePath}`;
  }

  if (state && state.pid && !pidAlive(state.pid)) {
    const wave = summary.activeWave ?? state.activeWave ?? 'none';
    const pending = summary.pendingCount;
    const completed = summary.completedCount;
    const phase = state.phase ?? state.status ?? 'unknown';
    if (state.status === 'stopping' || state.status === 'idle' || state.phase === 'idle' || isCompletedSummary(summary)) {
      return `stopped wave=${wave} pending=${pending} completed=${completed}`;
    }
    return `stale state pid=${state.pid} wave=${wave} pending=${pending} completed=${completed} phase=${phase}`;
  }

  return `stopped wave=${summary.activeWave ?? 'none'} pending=${summary.pendingCount} completed=${summary.completedCount}`;
}
