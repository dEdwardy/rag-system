export function wasExecutionSuperseded(item, execution) {
  if (!execution) return false;
  if (!item) return true;
  if (item.status !== 'in_progress') return true;
  if (Number(item.attempt ?? 0) !== Number(execution.attempt ?? 0)) return true;
  if ((item.startedAt ?? null) !== (execution.startedAt ?? null)) return true;
  return false;
}
