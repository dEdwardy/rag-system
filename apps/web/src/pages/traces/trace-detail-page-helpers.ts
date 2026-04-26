export type FailureTaxonomyKey =
  | 'no_hit'
  | 'fallback'
  | 'slow_path'
  | 'timeout'
  | 'source_failure';

export type RetrievalInternalsSummary = {
  candidateFlowLabel: string | null;
  chunkWindowLabel: string | null;
  stageTimingLabel: string | null;
  slowestStageLabel: string | null;
};

const SLOW_PATH_LATENCY_MS = 10_000;

function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function formatCount(value: number | null) {
  return value == null ? '-' : String(value);
}

function formatMs(value: number | null) {
  return value == null ? null : `${value} ms`;
}

export function buildRetrievalInternalsSummary(
  retrievalMetadata: unknown,
  locale: 'zh' | 'en'
): RetrievalInternalsSummary | null {
  const metadata = readObject(retrievalMetadata);
  const execution = readObject(metadata?.execution);
  const timing = readObject(execution?.timing);

  if (execution == null) {
    return null;
  }

  const vectorCandidateCount = readNumber(execution.vectorCandidateCount);
  const lexicalCandidateCount = readNumber(execution.lexicalCandidateCount);
  const mergedCandidateCount = readNumber(execution.mergedCandidateCount);
  const rankedCandidateCount = readNumber(execution.rankedCandidateCount);
  const candidateLimit = readNumber(execution.candidateLimit);
  const chunkWindow = readNumber(execution.chunkWindow);
  const chunkWindowApplied = readBoolean(execution.chunkWindowApplied);
  const primaryChunkCount = readNumber(execution.primaryChunkCount);
  const neighborChunkCount = readNumber(execution.neighborChunkCount);
  const retrievedChunkCount = readNumber(execution.retrievedChunkCount);

  const candidateFlowLabel =
    vectorCandidateCount != null ||
    lexicalCandidateCount != null ||
    mergedCandidateCount != null ||
    rankedCandidateCount != null ||
    candidateLimit != null
      ? locale === 'zh'
        ? `向量 ${formatCount(vectorCandidateCount)} / 词法 ${formatCount(lexicalCandidateCount)} / 合并 ${formatCount(mergedCandidateCount)} / 排序 ${formatCount(rankedCandidateCount)}${candidateLimit != null ? ` / 上限 ${candidateLimit}` : ''}`
        : `Vector ${formatCount(vectorCandidateCount)} / Lexical ${formatCount(lexicalCandidateCount)} / Merged ${formatCount(mergedCandidateCount)} / Ranked ${formatCount(rankedCandidateCount)}${candidateLimit != null ? ` / Limit ${candidateLimit}` : ''}`
      : null;

  const chunkWindowLabel =
    chunkWindow != null ||
    chunkWindowApplied != null ||
    primaryChunkCount != null ||
    neighborChunkCount != null ||
    retrievedChunkCount != null
      ? locale === 'zh'
        ? `窗口 ${formatCount(chunkWindow)}${chunkWindowApplied === true ? '（已展开）' : chunkWindowApplied === false ? '（未展开）' : ''} · 主块 ${formatCount(primaryChunkCount)} / 邻块 ${formatCount(neighborChunkCount)} / 命中 ${formatCount(retrievedChunkCount)}`
        : `Window ${formatCount(chunkWindow)}${chunkWindowApplied === true ? ' (applied)' : chunkWindowApplied === false ? ' (not applied)' : ''} · Primary ${formatCount(primaryChunkCount)} / Neighbor ${formatCount(neighborChunkCount)} / Retrieved ${formatCount(retrievedChunkCount)}`
      : null;

  const timingCandidates = [
    {
      label: locale === 'zh' ? '向量检索' : 'Vector search',
      value: readNumber(timing?.vectorSearchMs)
    },
    {
      label: locale === 'zh' ? '候选拉取' : 'Candidate fetch',
      value: readNumber(timing?.vectorCandidateFetchMs)
    },
    {
      label: locale === 'zh' ? '词法检索' : 'Lexical search',
      value: readNumber(timing?.lexicalSearchMs)
    },
    {
      label: locale === 'zh' ? '窗口扩展' : 'Chunk window',
      value: readNumber(timing?.chunkWindowMs)
    }
  ].filter(
    (item): item is { label: string; value: number } =>
      typeof item.value === 'number'
  );

  const stageTimingLabel =
    timingCandidates.length > 0
      ? timingCandidates
          .map((item) => `${item.label} ${item.value} ms`)
          .join(' · ')
      : null;

  const slowestStage = timingCandidates.reduce<{
    label: string;
    value: number;
  } | null>((current, item) => {
    if (current == null || item.value > current.value) {
      return item;
    }

    return current;
  }, null);

  return {
    candidateFlowLabel,
    chunkWindowLabel,
    stageTimingLabel,
    slowestStageLabel:
      slowestStage == null
        ? null
        : `${slowestStage.label} ${formatMs(slowestStage.value)}`
  };
}

export function buildFailureTaxonomy(trace: {
  status: 'success' | 'failed';
  latencyMs: number | null;
  errorMessage: string | null;
  traceSummary?: {
    primaryIssue: string | null;
    insufficientContextReason: string | null;
    usedFallback: boolean;
    strategySummary: {
      usedFallback: boolean | null;
    };
    retrievedChunkCount: number;
    failureMessage: string | null;
    failureReadabilitySentence: string;
  } | null;
}): FailureTaxonomyKey[] {
  const taxonomy: FailureTaxonomyKey[] = [];
  const summary = trace.traceSummary ?? null;
  const diagnosticsText = [
    trace.errorMessage,
    summary?.failureMessage,
    summary?.failureReadabilitySentence
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();

  const noHitDetected =
    summary?.primaryIssue === 'no_retrieval_hits' ||
    summary?.insufficientContextReason === 'no_retrieval_hits' ||
    summary?.retrievedChunkCount === 0;
  if (noHitDetected) {
    taxonomy.push('no_hit');
  }

  const fallbackDetected = Boolean(
    summary?.usedFallback ||
    summary?.strategySummary.usedFallback ||
    summary?.primaryIssue === 'fallback_generation'
  );
  if (fallbackDetected) {
    taxonomy.push('fallback');
  }

  const slowPathDetected = (trace.latencyMs ?? 0) >= SLOW_PATH_LATENCY_MS;
  if (slowPathDetected) {
    taxonomy.push('slow_path');
  }

  const timeoutDetected =
    trace.status === 'failed' &&
    ['timeout', 'timed out', 'abort', 'aborted', 'deadline exceeded'].some(
      (keyword) => diagnosticsText.includes(keyword)
    );
  if (timeoutDetected) {
    taxonomy.push('timeout');
  }

  const sourceFailureDetected =
    trace.status === 'failed' &&
    [
      'source',
      'fetch',
      'web page',
      'feed',
      'sitemap',
      'content-type',
      'redirect',
      'external'
    ].some((keyword) => diagnosticsText.includes(keyword));
  if (sourceFailureDetected) {
    taxonomy.push('source_failure');
  }

  return taxonomy;
}

export function getFailureTaxonomyLabel(
  key: FailureTaxonomyKey,
  locale: 'zh' | 'en'
) {
  if (key === 'no_hit') {
    return locale === 'zh' ? '无命中检索（no-hit）' : 'No-hit retrieval';
  }
  if (key === 'fallback') {
    return locale === 'zh' ? '回退路径（fallback）' : 'Fallback path';
  }
  if (key === 'slow_path') {
    return locale === 'zh' ? '慢路径（slow-path）' : 'Slow path';
  }
  if (key === 'timeout') {
    return locale === 'zh' ? '超时（timeout）' : 'Timeout';
  }

  return locale === 'zh' ? '来源失败（source-failure）' : 'Source failure';
}

export function getFailureTaxonomyColor(key: FailureTaxonomyKey) {
  if (key === 'no_hit') {
    return 'gray';
  }
  if (key === 'fallback') {
    return 'yellow';
  }
  if (key === 'slow_path') {
    return 'orange';
  }
  if (key === 'timeout') {
    return 'red';
  }

  return 'pink';
}

export function buildRawPayload(trace: {
  retrievedChunkIdsJson: unknown;
  retrievalScoresJson: unknown;
  citationsJson: unknown;
}): Record<string, unknown> {
  return {
    retrievedChunkIdsJson: trace.retrievedChunkIdsJson,
    retrievalScoresJson: trace.retrievalScoresJson,
    citationsJson: trace.citationsJson
  };
}

export function buildDocumentChunkLink(
  documentId: string,
  chunkId: string,
  context?: {
    traceId?: string;
    rank?: number;
    isPrimary?: boolean | null;
    isCited?: boolean;
    score?: number | null;
  }
) {
  const searchParams = new URLSearchParams({
    chunkId
  });

  if (context?.traceId) {
    searchParams.set('fromTrace', context.traceId);
  }
  if (context?.rank != null) {
    searchParams.set('rank', String(context.rank));
  }
  if (context?.isPrimary != null) {
    searchParams.set('isPrimary', context.isPrimary ? '1' : '0');
  }
  if (context?.isCited) {
    searchParams.set('isCited', '1');
  }
  if (context?.score != null) {
    searchParams.set('score', context.score.toFixed(4));
  }

  return `/documents/${documentId}?${searchParams.toString()}`;
}
