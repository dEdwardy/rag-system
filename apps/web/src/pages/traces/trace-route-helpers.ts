import type { TraceRecord } from '../../types/api';

export function isRouteShortcutTarget(
  value: string
): value is 'knowledge_base' | 'policy_reply' | 'external_source' {
  return (
    value === 'knowledge_base' ||
    value === 'policy_reply' ||
    value === 'external_source'
  );
}

export function matchesTraceRouteFilter(
  trace: TraceRecord,
  routeTypeFilter: string | null,
  routeReasonFilter: string | null
) {
  const routeDecision = trace.traceSummary?.routeDecisionSummary ?? null;
  const routeTypeMatches =
    routeTypeFilter == null || routeTypeFilter.length === 0
      ? true
      : routeDecision?.routeType === routeTypeFilter;
  const routeReasonMatches =
    routeReasonFilter == null || routeReasonFilter.length === 0
      ? true
      : routeDecision?.routeReason === routeReasonFilter;

  return routeTypeMatches && routeReasonMatches;
}

export function formatActiveTraceRouteFilter(
  locale: 'zh' | 'en',
  routeTypeFilter: string | null,
  routeReasonFilter: string | null
) {
  return locale === 'zh'
    ? `当前筛选: ${routeTypeFilter ?? 'all'} / ${routeReasonFilter ?? 'all'}`
    : `Active filter: ${routeTypeFilter ?? 'all'} / ${routeReasonFilter ?? 'all'}`;
}
