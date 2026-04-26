export function buildHeartbeatSignature(summary, currentRunState, isStopping) {
  return JSON.stringify({
    wave: summary?.activeWave ?? null,
    pending: summary?.pendingCount ?? 0,
    total: summary?.totalCount ?? 0,
    blocked: summary?.blockedCount ?? 0,
    phase: currentRunState?.phase ?? (isStopping ? 'stopping' : 'running'),
    item: currentRunState?.currentItemId ?? null,
    result: currentRunState?.lastResult ?? null,
    blockedOn: currentRunState?.blockedOn ?? null
  });
}

export function shouldWriteHeartbeatLog({
  summary,
  currentRunState,
  isStopping,
  previousSignature
}) {
  const nextSignature = buildHeartbeatSignature(
    summary,
    currentRunState,
    isStopping
  );
  return {
    shouldWrite: nextSignature !== previousSignature,
    signature: nextSignature
  };
}
