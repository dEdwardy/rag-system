import {
  buildTraceExecutionPlan,
  buildTraceMetadataCanonicalSurface,
  type RetrievalStrategySummary
} from '@rag-system/shared';
import type { AskRouteDecision } from './ask-route-decision';

export type ExternalSourceMetadataView = {
  url: string;
  kind: 'web' | 'feed' | 'sitemap';
  kindLabel: string;
  title: string | null;
  diagnostics: unknown;
};

export function buildRouteMetadataBase(input: {
  question: string;
  retrievedChunkCount: number;
  primaryChunkCount: number;
  strategyMode: RetrievalStrategySummary['strategyMode'];
  retrievalMode: RetrievalStrategySummary['retrievalMode'] | null;
}) {
  return {
    queryRewrite: {
      enabled: false,
      applied: false,
      finalQuerySource: 'original_disabled' as const,
      skippedReason: 'disabled_by_default' as const,
      usedFallback: null,
      modelName: null,
      promptId: null
    },
    strategySummary: {
      retrievalMode: input.retrievalMode,
      strategyMode: input.strategyMode,
      retrievalQuerySource: 'original_disabled' as const,
      rewriteEnabled: false,
      rewriteApplied: false,
      rewriteSkippedReason: 'disabled_by_default' as const,
      rewriteUsedFallback: null,
      rewritePromptId: null,
      rewriteModelName: null,
      fallbackReason: null,
      usedFallback: null
    },
    execution: {
      retrievalQuery: input.question,
      topK: 1,
      scoreThreshold: 0,
      chunkWindow: 0,
      retrievedChunkCount: input.retrievedChunkCount,
      contextGroupCount: 0,
      primaryChunkCount: input.primaryChunkCount,
      neighborChunkCount: 0
    }
  };
}

export function buildPolicyRouteMetadata(input: {
  question: string;
  routeDecision: AskRouteDecision;
}) {
  const executionPlan = buildTraceExecutionPlan({
    routeType: input.routeDecision.routeType,
    routeReason: input.routeDecision.routeReason
  });

  return {
    ...buildTraceMetadataCanonicalSurface({
      routeDecision: input.routeDecision,
      executionPlan
    }),
    ...buildRouteMetadataBase({
      question: input.question,
      retrievedChunkCount: 0,
      primaryChunkCount: 0,
      strategyMode: null,
      retrievalMode: null
    })
  };
}

export function buildExternalSourceRouteMetadata(input: {
  question: string;
  sourceUrl: string;
  sourceKind: 'web' | 'feed' | 'sitemap';
  sourceKindLabel: string;
  sourceTitle: string | null;
  diagnostics: unknown;
  routeDecision: AskRouteDecision;
  externalSources?: ExternalSourceMetadataView[];
}) {
  const executionPlan = buildTraceExecutionPlan({
    routeType: input.routeDecision.routeType,
    routeReason: input.routeDecision.routeReason,
    sourceCount:
      input.externalSources != null && input.externalSources.length > 0
        ? input.externalSources.length
        : 1
  });

  return {
    ...buildTraceMetadataCanonicalSurface({
      routeDecision: input.routeDecision,
      executionPlan
    }),
    externalSource: {
      url: input.sourceUrl,
      kind: input.sourceKind,
      kindLabel: input.sourceKindLabel,
      title: input.sourceTitle,
      diagnostics: input.diagnostics ?? null
    },
    ...(input.externalSources != null
      ? {
          externalSources: input.externalSources
        }
      : {}),
    ...buildRouteMetadataBase({
      question: input.question,
      retrievedChunkCount:
        input.externalSources != null && input.externalSources.length > 0
          ? input.externalSources.length
          : 1,
      primaryChunkCount: 1,
      strategyMode: null,
      retrievalMode: null
    })
  };
}
