export function isCompletedSummary(summary) {
  return (
    summary.totalCount > 0 &&
    summary.pendingCount === 0 &&
    summary.inProgressCount === 0
  );
}

function buildReasonPart(state) {
  if (!state) return '';
  if (state.blockedOn) {
    return ` reason=${state.blockedOn}`;
  }
  if (state.currentItemIdleTimedOut) {
    return ' reason=idle_progress_timeout';
  }
  if (state.currentItemTimedOut) {
    return ' reason=item_timeout';
  }
  if (
    state.lastResult === 'needs_replan' ||
    state.currentItemStatus === 'needs_replan'
  ) {
    return ' reason=needs_replan';
  }
  return '';
}

export function formatStatusLine({ state, summary, pidAlive, relativePath }) {
  if (state && pidAlive(state.pid)) {
    const wave = state.activeWave ?? summary.activeWave ?? 'none';
    const backend = state.executionBackend ?? 'opencode';
    const pending = state.pendingCount ?? summary.pendingCount;
    const itemPart = state.currentItemId ? ` item=${state.currentItemId}` : '';
    const sessionPart = state.activeSessionId
      ? ` session=${state.activeSessionId}`
      : '';
    const reasonPart = buildReasonPart(state);

    if (state.phase === 'blocked' || state.status === 'blocked') {
      return `blocked pid=${state.pid} backend=${backend} wave=${wave} pending=${pending}${itemPart}${reasonPart} log=${relativePath}`;
    }

    if (state.phase === 'idle' || state.status === 'idle') {
      return `stopped backend=${backend} wave=${wave} pending=${summary.pendingCount} completed=${summary.completedCount}${reasonPart}`;
    }

    if (
      state.phase === 'needs_replan' ||
      state.status === 'needs_replan' ||
      state.currentItemStatus === 'needs_replan' ||
      state.lastResult === 'needs_replan'
    ) {
      return `attention pid=${state.pid} backend=${backend} wave=${wave} pending=${pending}${itemPart}${reasonPart} log=${relativePath}`;
    }

    return `running pid=${state.pid} backend=${backend} wave=${wave} pending=${pending}${itemPart}${sessionPart} log=${relativePath}`;
  }

  if (state && state.pid && !pidAlive(state.pid)) {
    const wave = summary.activeWave ?? state.activeWave ?? 'none';
    const pending = summary.pendingCount;
    const completed = summary.completedCount;
    const phase = state.phase ?? state.status ?? 'unknown';
    const backend = state.executionBackend ?? 'opencode';
    if (
      state.status === 'stopping' ||
      state.status === 'idle' ||
      state.phase === 'idle' ||
      isCompletedSummary(summary)
    ) {
      return `stopped backend=${backend} wave=${wave} pending=${pending} completed=${completed}${buildReasonPart(state)}`;
    }
    if (state.phase === 'blocked' || state.status === 'blocked') {
      return `blocked backend=${backend} wave=${wave} pending=${pending} completed=${completed}${buildReasonPart(state)}`;
    }
    if (
      state.phase === 'needs_replan' ||
      state.status === 'needs_replan' ||
      state.currentItemStatus === 'needs_replan' ||
      state.lastResult === 'needs_replan'
    ) {
      const itemPart = state.currentItemId
        ? ` item=${state.currentItemId}`
        : '';
      return `attention backend=${backend} wave=${wave} pending=${pending} completed=${completed}${itemPart}${buildReasonPart(state)}`;
    }
    return `stale state pid=${state.pid} backend=${backend} wave=${wave} pending=${pending} completed=${completed} phase=${phase}`;
  }

  return `stopped backend=${state?.executionBackend ?? 'opencode'} wave=${summary.activeWave ?? 'none'} pending=${summary.pendingCount} completed=${summary.completedCount}`;
}
