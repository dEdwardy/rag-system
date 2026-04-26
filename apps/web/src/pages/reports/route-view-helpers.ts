import {
  TRACE_EXECUTION_MODE_LABELS,
  TRACE_EXECUTION_TOOL_LABELS,
  TRACE_ROUTE_REASON_LABELS,
  TRACE_ROUTE_TYPE_LABELS,
  type TraceExecutionMode,
  type TraceExecutionToolName,
  type TraceRouteReason,
  type TraceRouteType
} from '@rag-system/shared';

export type RouteShortcutTarget =
  | 'knowledge_base'
  | 'policy_reply'
  | 'external_source';

export const routeShortcutLabels: Record<RouteShortcutTarget, string> = {
  knowledge_base: TRACE_ROUTE_TYPE_LABELS.knowledge_base,
  policy_reply: TRACE_ROUTE_TYPE_LABELS.policy_reply,
  external_source: TRACE_ROUTE_TYPE_LABELS.external_source
};

export const routeShortcutCompactLabels: Record<RouteShortcutTarget, string> = {
  knowledge_base: 'KB',
  policy_reply: 'Policy',
  external_source: 'External'
};

export const routeReasonLabels = {
  default_kb_ask: TRACE_ROUTE_REASON_LABELS.default_kb_ask,
  policy_question: TRACE_ROUTE_REASON_LABELS.policy_question,
  explicit_source_url: TRACE_ROUTE_REASON_LABELS.explicit_source_url,
  explicit_source_urls: TRACE_ROUTE_REASON_LABELS.explicit_source_urls
} as const satisfies Record<TraceRouteReason, string>;

function lowerCaseFirstLabel(value: string) {
  return value.length > 0 ? value[0].toLowerCase() + value.slice(1) : value;
}

export function buildEnglishInspectionSurfaceExamples() {
  const routeExamples = (
    [
      'knowledge_base',
      'policy_reply',
      'external_source'
    ] as const satisfies TraceRouteType[]
  )
    .map((routeType) => lowerCaseFirstLabel(TRACE_ROUTE_TYPE_LABELS[routeType]))
    .join(' / ');
  const modeExamples = (
    ['manual', 'workflow'] as const satisfies TraceExecutionMode[]
  )
    .map((executionMode) => TRACE_EXECUTION_MODE_LABELS[executionMode])
    .join(' / ');
  const toolExamples = (
    [
      'knowledge_base_search',
      'external_source_fetch',
      'policy_reply'
    ] as const satisfies TraceExecutionToolName[]
  )
    .map((toolName) =>
      lowerCaseFirstLabel(TRACE_EXECUTION_TOOL_LABELS[toolName])
    )
    .join(' / ');

  return {
    routeExamples,
    modeExamples,
    toolExamples
  };
}

export function buildRouteReasonLabel(routeReason: string) {
  return (
    routeReasonLabels[routeReason as keyof typeof routeReasonLabels] ??
    routeReason
  );
}

export function buildRouteDecisionLabel(
  routeType: string,
  routeReason: string
) {
  const typeLabel =
    routeShortcutLabels[routeType as RouteShortcutTarget] ?? routeType;
  const reasonLabel = buildRouteReasonLabel(routeReason);

  return `${typeLabel} - ${reasonLabel}`;
}

export function buildTraceRouteListLink(routeType: RouteShortcutTarget) {
  return `/traces?routeType=${routeType}`;
}

export function buildAllTracesLink() {
  return '/traces';
}

export function buildChatConversationLink(
  conversationId: string | null | undefined
) {
  if (!conversationId) {
    return '/';
  }

  return `/?conversationId=${encodeURIComponent(conversationId)}`;
}

export function buildChatTraceDetailLink(args: {
  traceId: string;
  conversationId?: string | null;
}) {
  const searchParams = new URLSearchParams({ from: 'chat' });

  if (args.conversationId) {
    searchParams.set('conversationId', args.conversationId);
  }

  return `/traces/${args.traceId}?${searchParams.toString()}`;
}
