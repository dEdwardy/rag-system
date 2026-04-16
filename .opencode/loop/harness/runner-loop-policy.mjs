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

export function shouldStopAfterNoProgress(phase) {
  return phase === 'blocked' || phase === 'idle';
}
