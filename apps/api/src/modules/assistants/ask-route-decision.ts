import type { TraceRouteReason, TraceRouteType } from '@rag-system/shared';

export type AskRouteDecision = {
  routeType: TraceRouteType;
  routeReason: TraceRouteReason;
};

export type ResolvedExternalSourceRoute = {
  url: string;
  sourceKind: 'web' | 'feed' | 'sitemap';
};

export type ResolvedExternalSourceCandidate = ResolvedExternalSourceRoute & {
  raw: string;
  label: string | null;
};

type ExplicitSourceDescriptor = {
  raw: string;
  url: string;
  label: string | null;
  context: string;
};

/**
 * Patterns that identify questions about the assistant itself: its rules,
 * limits, citation behaviour or refusal behaviour.
 *
 * Keep this list narrow. Bare words like 系统 / 助手 / 引用 used to live here and
 * matched ordinary product questions ("这个系统支持哪些接入方式") that the
 * knowledge base can answer. Those questions must reach retrieval, so the rule
 * set only keeps phrasings that are unambiguously about the assistant.
 *
 * The trade-off is deliberate: when in doubt the router now falls through to
 * `knowledge_base`, which is the safer default — retrieval plus the existing
 * insufficient-context handling can still decline, while a policy short-circuit
 * skips retrieval entirely.
 */
const POLICY_QUESTION_PATTERNS = [
  // English meta vocabulary. `system` is intentionally absent: it also appears
  // in ordinary product questions.
  /\b(policy|policies|citation|citations|refusal|refusals|abstain|hallucination|prompt injection)\b/i,
  // Chinese: explicit boundary / rule / refusal wording.
  /能力边界/,
  /(你的|您的)(能力|边界|规则|限制)/,
  /(助手|你)(本身|自己)的?(规则|限制|边界|能力)/,
  /你(能|可以)(访问|读取|看到)(什么|哪些|到)?/,
  /拒答/,
  /幻觉/,
  /提示词注入/
] as const;

export function resolveAskRouteDecision(question: string): AskRouteDecision {
  const explicitExternalSources = resolveExplicitExternalSourceRoutes(question);
  if (explicitExternalSources.length > 0) {
    return {
      routeType: 'external_source',
      routeReason:
        explicitExternalSources.length > 1
          ? 'explicit_source_urls'
          : 'explicit_source_url'
    };
  }

  if (isPolicyQuestion(question)) {
    return {
      routeType: 'policy_reply',
      routeReason: 'policy_question'
    };
  }

  return {
    routeType: 'knowledge_base',
    routeReason: 'default_kb_ask'
  };
}

export function resolveExplicitExternalSourceRoute(
  question: string
): ResolvedExternalSourceRoute | null {
  return resolveExplicitExternalSourceRoutes(question)[0] ?? null;
}

export function resolveExplicitExternalSourceRoutes(
  question: string
): ResolvedExternalSourceCandidate[] {
  const sources = extractExplicitSourceDescriptors(question);
  if (sources.length === 0) {
    return [];
  }

  return sources.map((source) => {
    try {
      const parsed = new URL(source.url);
      const pathname = parsed.pathname.toLowerCase();
      const search = parsed.search.toLowerCase();
      const normalizedSignalText =
        `${source.label ?? ''} ${source.context}`.toLowerCase();
      const pathSegments = pathname.split('/').filter(Boolean);
      const lastSegment = pathSegments[pathSegments.length - 1] ?? '';

      if (
        /(?:^|\/)(sitemap(?:[-_][\w-]+)?\.xml)$/i.test(pathname) ||
        /(?:^|\b)sitemap(?:\b|[-_])/i.test(normalizedSignalText) ||
        /[?&]type=sitemap\b/i.test(search)
      ) {
        return {
          raw: source.raw,
          url: source.url,
          label: source.label,
          sourceKind: 'sitemap' as const
        };
      }

      if (
        /(?:^|\b)(rss|atom|feed)(?:\b|[-_])/i.test(normalizedSignalText) ||
        /^(?:feed|rss|atom)(?:\.[a-z0-9]+)?$/i.test(lastSegment) ||
        /\.(?:rss|atom)(?:\.xml)?$/i.test(lastSegment) ||
        /[?&](?:format|type)=(?:rss|atom|feed)\b/i.test(search)
      ) {
        return {
          raw: source.raw,
          url: source.url,
          label: source.label,
          sourceKind: 'feed' as const
        };
      }

      return {
        raw: source.raw,
        url: source.url,
        label: source.label,
        sourceKind: 'web' as const
      };
    } catch {
      return {
        raw: source.raw,
        url: source.url,
        label: source.label,
        sourceKind: 'web' as const
      };
    }
  });
}

export function isPolicyQuestion(question: string) {
  return POLICY_QUESTION_PATTERNS.some((pattern) => pattern.test(question));
}

function extractExplicitSourceDescriptors(
  question: string
): ExplicitSourceDescriptor[] {
  const markdownLinks = Array.from(
    question.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi),
    (match) => ({
      raw: match[2].replace(/[.,!?;:]+$/g, ''),
      url: match[2].replace(/[.,!?;:]+$/g, ''),
      label: match[1].trim() || null,
      context: match[0]
    })
  );
  const bareUrls = Array.from(
    question.matchAll(/https?:\/\/[^\s)\]}>,]+/gi),
    (match) => ({
      raw: match[0].replace(/[.,!?;:]+$/g, ''),
      url: match[0].replace(/[.,!?;:]+$/g, ''),
      label: buildReadableExternalSourceLabel(
        match[0].replace(/[.,!?;:]+$/g, ''),
        'web'
      ),
      context: extractSourceContext(question, match.index ?? 0, match[0].length)
    })
  );
  const deduped = new Map<string, ExplicitSourceDescriptor>();
  for (const source of [...markdownLinks, ...bareUrls]) {
    if (!deduped.has(source.url)) {
      deduped.set(source.url, source);
    }
  }
  return Array.from(deduped.values());
}

function extractSourceContext(question: string, start: number, length: number) {
  const contextRadius = 48;
  const contextStart = Math.max(0, start - contextRadius);
  const contextEnd = Math.min(question.length, start + length + contextRadius);
  return question.slice(contextStart, contextEnd);
}

function buildReadableExternalSourceLabel(
  url: string,
  sourceKind: ResolvedExternalSourceRoute['sourceKind']
) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, '');
    const path = parsed.pathname.replace(/\/+$/g, '');
    const tail = path.split('/').filter(Boolean).pop() ?? '';
    const readableTail = tail || (sourceKind === 'web' ? 'page' : sourceKind);
    return `${host}/${readableTail}`;
  } catch {
    return sourceKind === 'web'
      ? 'external web page'
      : sourceKind === 'feed'
        ? 'external feed'
        : 'external sitemap';
  }
}
