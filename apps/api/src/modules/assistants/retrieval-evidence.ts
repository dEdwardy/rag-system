import type {
  RetrievalContextGroup,
  RetrievalResult
} from '../retrieval/retrieval.service';

export const MAX_AGENT_EVIDENCE_CHUNKS = 6;
export const MAX_AGENT_EVIDENCE_CONTEXT_GROUPS = 6;
export const MIN_SECOND_PASS_EVIDENCE_SLOTS = 1;
export const DEFAULT_EVIDENCE_SUFFICIENCY_TOP_SCORE = 0.3;

export type RetrievalEvidenceChunk = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  score: number;
  isPrimary?: boolean;
  pageNo?: number | null;
  sectionTitle?: string | null;
  vectorScore?: number;
  lexicalScore?: number;
  hybridScore?: number;
  rerankScore?: number;
};

export type RetrievalEvidenceQuery = {
  original: string;
  retrieval: string;
  rewritten: string | null;
  sourceQueries: string[];
};

export type RetrievalEvidence = {
  retrievedChunks: RetrievalEvidenceChunk[];
  contextGroups: RetrievalContextGroup[];
  execution: RetrievalResult['execution'];
  embedding: RetrievalResult['embedding'];
  query: RetrievalEvidenceQuery;
};

export type SearchEvidenceLike = {
  query?: {
    original?: unknown;
    retrieval?: unknown;
    rewritten?: unknown;
  };
  chunks: RetrievalEvidenceChunk[];
  contextGroups: RetrievalContextGroup[];
  diagnostics?: {
    execution?: unknown;
    embedding?: unknown;
  };
};

type BoundedMultiStepInput = {
  enabled?: boolean;
  rewrittenQuery?: string;
  suggestedQuery?: string;
  requestSecondPass?: boolean;
};

export function mergeEvidenceChunks<T extends { chunkId: string }>(
  first: T[],
  second: T[]
): T[] {
  const seen = new Set<string>();
  return [...first, ...second].filter((chunk) => {
    if (seen.has(chunk.chunkId)) {
      return false;
    }
    seen.add(chunk.chunkId);
    return true;
  });
}

export function mergeEvidenceContextGroups<T extends RetrievalContextGroup>(
  first: T[],
  second: T[]
): T[] {
  const seen = new Set<string>();
  return [...first, ...second].filter((group) => {
    const key = [
      group.documentId,
      group.startChunkIndex,
      group.endChunkIndex,
      ...group.chunkIds
    ].join(':');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function mergeEvidenceWithQuota<T>(input: {
  primary: T[];
  secondary: T[];
  max: number;
  keyOf: (value: T) => string;
  minSecondarySlots?: number;
}): T[] {
  const { primary, secondary, max, keyOf } = input;
  const minSecondarySlots = Math.min(
    input.minSecondarySlots ?? MIN_SECOND_PASS_EVIDENCE_SLOTS,
    max
  );

  const seen = new Set<string>();
  const primaryUnique: T[] = [];
  for (const value of primary) {
    const key = keyOf(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    primaryUnique.push(value);
  }

  const secondaryUnique: T[] = [];
  for (const value of secondary) {
    const key = keyOf(value);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    secondaryUnique.push(value);
  }

  if (secondaryUnique.length === 0) {
    return primaryUnique.slice(0, max);
  }

  const secondaryQuota = Math.min(
    secondaryUnique.length,
    Math.max(minSecondarySlots, Math.floor(max / 3))
  );
  const primaryQuota = Math.max(0, max - secondaryQuota);
  const selectedPrimary = primaryUnique.slice(0, primaryQuota);
  const remaining = max - selectedPrimary.length;
  const selectedSecondary = secondaryUnique.slice(
    0,
    Math.max(secondaryQuota, remaining)
  );

  return [...selectedPrimary, ...selectedSecondary].slice(0, max);
}

export function assessEvidenceSufficiency(
  primary: SearchEvidenceLike | null | undefined,
  options: { minTopScore?: number } = {}
): {
  chunkCount: number;
  sourceCount: number;
  topScore: number | null;
  sufficient: boolean;
  reasons: string[];
} {
  const chunkCount = primary?.chunks.length ?? 0;
  const sourceCount = primary?.contextGroups.length ?? 0;
  const topScore = primary?.chunks[0]?.score ?? null;
  const minTopScore =
    options.minTopScore ?? DEFAULT_EVIDENCE_SUFFICIENCY_TOP_SCORE;
  const reasons: string[] = [];

  if (chunkCount === 0) {
    reasons.push('no_chunks');
  }
  if (topScore != null && topScore < minTopScore) {
    reasons.push('low_top_score');
  }
  if (sourceCount <= 1 && chunkCount < 2) {
    reasons.push('low_source_diversity');
  }

  return {
    chunkCount,
    sourceCount,
    topScore,
    sufficient: reasons.length === 0,
    reasons
  };
}

export function buildRetrievalEvidence(input: {
  primary: SearchEvidenceLike;
  secondary?: SearchEvidenceLike | null;
  maxChunks?: number;
  maxContextGroups?: number;
}): RetrievalEvidence {
  const maxChunks = input.maxChunks ?? MAX_AGENT_EVIDENCE_CHUNKS;
  const maxContextGroups =
    input.maxContextGroups ?? MAX_AGENT_EVIDENCE_CONTEXT_GROUPS;
  const chunks = mergeEvidenceWithQuota({
    primary: input.primary.chunks,
    secondary: input.secondary?.chunks ?? [],
    max: maxChunks,
    keyOf: (chunk) => chunk.chunkId
  });
  const contextGroups = mergeEvidenceWithQuota({
    primary: input.primary.contextGroups,
    secondary: input.secondary?.contextGroups ?? [],
    max: maxContextGroups,
    keyOf: (group) =>
      [
        group.documentId,
        group.startChunkIndex,
        group.endChunkIndex,
        ...group.chunkIds
      ].join(':')
  });
  const sourceQueries = [
    readQueryValue(input.primary.query?.retrieval),
    readQueryValue(input.secondary?.query?.retrieval)
  ].filter((value): value is string => value != null);

  return {
    retrievedChunks: chunks,
    contextGroups,
    execution: resolveExecution(input.primary),
    embedding: resolveEmbedding(input.primary, input.secondary),
    query: {
      original: readQueryValue(input.primary.query?.original) ?? '',
      retrieval:
        readQueryValue(input.primary.query?.retrieval) ??
        readQueryValue(input.primary.query?.original) ??
        '',
      rewritten: readQueryValue(input.primary.query?.rewritten),
      sourceQueries: Array.from(new Set(sourceQueries))
    }
  };
}

export function buildRetrievalResultFromEvidence(
  evidence: RetrievalEvidence
): RetrievalResult {
  return {
    retrievedChunks:
      evidence.retrievedChunks as unknown as RetrievalResult['retrievedChunks'],
    contextGroups: evidence.contextGroups as RetrievalResult['contextGroups'],
    execution: evidence.execution,
    embedding: evidence.embedding
  };
}

export function buildRetrievalEvidenceFromResults(
  results: SearchEvidenceLike[],
  maxChunks = MAX_AGENT_EVIDENCE_CHUNKS,
  maxContextGroups = MAX_AGENT_EVIDENCE_CONTEXT_GROUPS
): RetrievalEvidence | null {
  if (results.length === 0) {
    return null;
  }

  const chunks = mergeEvidenceWithQuota({
    primary: results[0].chunks,
    secondary: results.slice(1).flatMap((result) => result.chunks),
    max: maxChunks,
    keyOf: (chunk) => chunk.chunkId
  });
  const contextGroups = mergeEvidenceWithQuota({
    primary: results[0].contextGroups,
    secondary: results.slice(1).flatMap((result) => result.contextGroups),
    max: maxContextGroups,
    keyOf: (group) =>
      [
        group.documentId,
        group.startChunkIndex,
        group.endChunkIndex,
        ...group.chunkIds
      ].join(':')
  });
  const sourceQueries = results
    .map((result) => readQueryValue(result.query?.retrieval))
    .filter((value): value is string => value != null);

  return {
    retrievedChunks: chunks,
    contextGroups,
    execution: resolveExecution(results[0]),
    embedding: resolveEmbedding(results[0]),
    query: {
      original: readQueryValue(results[0].query?.original) ?? '',
      retrieval:
        readQueryValue(results[0].query?.retrieval) ??
        readQueryValue(results[0].query?.original) ??
        '',
      rewritten: readQueryValue(results[0].query?.rewritten),
      sourceQueries: Array.from(new Set(sourceQueries))
    }
  };
}

export type SecondPassDecision = {
  shouldRun: boolean;
  query: string | null;
  reason:
    | 'explicit_request'
    | 'rewritten_query'
    | 'suggested_query'
    | 'requested_without_distinct_query'
    | 'first_pass_only'
    | 'not_requested';
  requested: boolean;
  evidenceSufficient: boolean;
  evidenceReasons: string[];
};

export function resolveSecondPassDecision(input: {
  originalQuestion: string;
  boundedMultiStep?: BoundedMultiStepInput;
  primary: SearchEvidenceLike | null;
}): SecondPassDecision {
  const evidence = assessEvidenceSufficiency(input.primary);
  const requested = isBoundedMultiStepRequested(input.boundedMultiStep);
  if (!requested) {
    return {
      shouldRun: false,
      query: null,
      reason: 'not_requested',
      requested: false,
      evidenceSufficient: evidence.sufficient,
      evidenceReasons: evidence.reasons
    };
  }

  const rewrittenQuery = readQueryValue(input.boundedMultiStep?.rewrittenQuery);
  const suggestedQuery = readQueryValue(input.boundedMultiStep?.suggestedQuery);
  const explicitQuery = rewrittenQuery ?? suggestedQuery;
  const firstPassRewrittenQuery = readQueryValue(
    input.primary?.query?.rewritten
  );
  const firstPassQuery = readQueryValue(input.primary?.query?.retrieval);
  const candidateQuery = explicitQuery ?? firstPassRewrittenQuery;

  if (
    candidateQuery != null &&
    candidateQuery !== input.originalQuestion &&
    candidateQuery !== firstPassQuery
  ) {
    const reason =
      rewrittenQuery != null
        ? 'explicit_request'
        : suggestedQuery != null
          ? 'suggested_query'
          : 'rewritten_query';
    return {
      shouldRun: true,
      query: candidateQuery,
      reason,
      requested: true,
      evidenceSufficient: evidence.sufficient,
      evidenceReasons: evidence.reasons
    };
  }

  return {
    shouldRun: false,
    query: null,
    reason:
      candidateQuery == null
        ? 'first_pass_only'
        : 'requested_without_distinct_query',
    requested: true,
    evidenceSufficient: evidence.sufficient,
    evidenceReasons: evidence.reasons
  };
}

export function isBoundedMultiStepRequested(
  input?: BoundedMultiStepInput
): boolean {
  return (
    input?.enabled === true ||
    input?.requestSecondPass === true ||
    readQueryValue(input?.rewrittenQuery) != null ||
    readQueryValue(input?.suggestedQuery) != null
  );
}

function resolveExecution(
  primary: SearchEvidenceLike
): RetrievalResult['execution'] {
  const execution = primary.diagnostics?.execution;
  if (isRetrievalExecution(execution)) {
    return execution;
  }

  return {
    actualMode: 'vector',
    usedFallback: false,
    fallbackReason: null,
    rerankApplied: false,
    rerankMode: 'off',
    rerankJudgeSkippedReason: null,
    chunkWindowApplied: false,
    vectorSearchAttempted: false,
    lexicalSearchAttempted: false,
    vectorCandidateLimitHit: false,
    lexicalCandidateLimitHit: false,
    rankingTopKHit: false,
    candidateLimit: 0,
    vectorCandidateCount: 0,
    lexicalCandidateCount: 0,
    mergedCandidateCount: 0,
    rankedCandidateCount: 0,
    timing: undefined
  };
}

function resolveEmbedding(
  primary: SearchEvidenceLike,
  secondary?: SearchEvidenceLike | null
): RetrievalResult['embedding'] {
  const embedding = primary.diagnostics?.embedding;
  if (embedding === null || typeof embedding === 'object') {
    return embedding as RetrievalResult['embedding'];
  }

  return secondary?.diagnostics?.embedding === null ||
    typeof secondary?.diagnostics?.embedding === 'object'
    ? (secondary.diagnostics.embedding as RetrievalResult['embedding'])
    : null;
}

function isRetrievalExecution(
  value: unknown
): value is RetrievalResult['execution'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'actualMode' in value &&
    'usedFallback' in value
  );
}

function readQueryValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
