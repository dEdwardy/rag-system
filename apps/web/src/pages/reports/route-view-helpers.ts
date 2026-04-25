export type RouteShortcutTarget =
  | 'knowledge_base'
  | 'policy_reply'
  | 'external_source';

export const routeShortcutLabels: Record<RouteShortcutTarget, string> = {
  knowledge_base: 'Knowledge base',
  policy_reply: 'Policy reply',
  external_source: 'External source'
};

export const routeShortcutCompactLabels: Record<RouteShortcutTarget, string> = {
  knowledge_base: 'KB',
  policy_reply: 'Policy',
  external_source: 'External'
};

export const routeReasonLabels = {
  default_kb_ask: 'Default KB ask',
  policy_question: 'Policy question',
  explicit_source_url: 'Explicit source URL',
  explicit_source_urls: 'Explicit source URLs'
} as const satisfies Record<string, string>;

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
