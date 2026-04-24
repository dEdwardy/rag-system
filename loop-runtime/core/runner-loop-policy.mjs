export function nextRunnerIteration({
  itemProcessed,
  itemStatus,
  stopRequested
}) {
  if (stopRequested) {
    return {
      shouldStop: true,
      progressed: Boolean(itemProcessed)
    };
  }

  if (!itemProcessed) {
    return {
      shouldStop: false,
      progressed: false
    };
  }

  return {
    shouldStop: false,
    progressed: itemStatus === 'completed' || itemStatus === 'needs_replan'
  };
}

export function shouldStopAfterNoProgress(
  phase,
  blockedRetries = 0,
  maxBlockedRetries = 3
) {
  if (phase === 'idle') return true;
  if (phase === 'blocked') return blockedRetries >= maxBlockedRetries;
  return false;
}
