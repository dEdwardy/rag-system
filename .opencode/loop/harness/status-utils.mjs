export function isCompletedSummary(summary) {
  return (
    summary.totalCount > 0 &&
    summary.pendingCount === 0 &&
    summary.inProgressCount === 0
  );
}

export function formatStatusLine({ state, summary, pidAlive, relativePath }) {
  if (state && pidAlive(state.pid)) {
    const wave = state.activeWave ?? summary.activeWave ?? 'none';
    const pending = state.pendingCount ?? summary.pendingCount;
    const itemPart = state.currentItemId ? ` item=${state.currentItemId}` : '';
    const sessionPart = state.activeSessionId
      ? ` session=${state.activeSessionId}`
      : '';
    const blockedOnPart = state.blockedOn
      ? ` blockedOn=${state.blockedOn}`
      : '';

    if (state.phase === 'blocked' || state.status === 'blocked') {
      return `blocked pid=${state.pid} wave=${wave} pending=${pending}${itemPart}${blockedOnPart} log=${relativePath}`;
    }

    if (state.phase === 'idle' || state.status === 'idle') {
      return `stopped wave=${wave} pending=${summary.pendingCount} completed=${summary.completedCount}`;
    }

    return `running pid=${state.pid} wave=${wave} pending=${pending}${itemPart}${sessionPart} log=${relativePath}`;
  }

  if (state && state.pid && !pidAlive(state.pid)) {
    const wave = summary.activeWave ?? state.activeWave ?? 'none';
    const pending = summary.pendingCount;
    const completed = summary.completedCount;
    const phase = state.phase ?? state.status ?? 'unknown';
    if (
      state.status === 'stopping' ||
      state.status === 'idle' ||
      state.phase === 'idle' ||
      isCompletedSummary(summary)
    ) {
      return `stopped wave=${wave} pending=${pending} completed=${completed}`;
    }
    if (state.phase === 'blocked' || state.status === 'blocked') {
      const blockedOnPart = state.blockedOn
        ? ` blockedOn=${state.blockedOn}`
        : '';
      return `blocked wave=${wave} pending=${pending} completed=${completed}${blockedOnPart}`;
    }
    return `stale state pid=${state.pid} wave=${wave} pending=${pending} completed=${completed} phase=${phase}`;
  }

  return `stopped wave=${summary.activeWave ?? 'none'} pending=${summary.pendingCount} completed=${summary.completedCount}`;
}
