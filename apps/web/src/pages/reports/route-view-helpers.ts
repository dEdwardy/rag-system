export type RouteShortcutTarget =
  | 'knowledge_base'
  | 'policy_reply'
  | 'external_source';

export const routeShortcutLabels: Record<RouteShortcutTarget, string> = {
  knowledge_base: 'KB',
  policy_reply: 'Policy',
  external_source: 'External'
};

export function buildTraceRouteListLink(routeType: RouteShortcutTarget) {
  return `/traces?routeType=${routeType}`;
}

export function buildAllTracesLink() {
  return '/traces';
}
