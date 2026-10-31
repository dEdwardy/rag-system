/**
 * Retrieval-level evaluation metrics.
 *
 * The existing eval summary only measured the answer layer (success rate,
 * grounded rate, citation count). Those cannot tell you whether *retrieval*
 * got better or worse, because a wrong answer and a wrong retrieval look the
 * same from the outside. These helpers score the retrieval step on its own.
 *
 * Kept as pure functions so the scoring rules are unit-testable without a
 * database, a model, or a full eval run.
 */

export type RetrievalExpectation = {
  expectedDocumentIds: string[];
  expectedChunkIds: string[];
};

export type RetrievalObservation = {
  retrievedDocumentIds: string[];
  retrievedChunkIds: string[];
};

export type RetrievalMetrics = {
  scope: 'document' | 'chunk';
  /** Number of retrieved items considered, which is the `k` in recall@k. */
  k: number;
  expectedCount: number;
  hitCount: number;
  recallAtK: number;
  reciprocalRank: number;
};

export type RetrievalMetricSummary = {
  evaluatedQuestionCount: number;
  retrievalRecallAtK: number;
  retrievalMrr: number;
};

/**
 * Chunk-level scoring wins when chunk expectations exist, because it is the
 * stricter signal. Document-level is the fallback for question sets that only
 * know which documents should be hit.
 */
export function computeRetrievalMetrics(input: {
  expectation: RetrievalExpectation;
  observation: RetrievalObservation;
}): RetrievalMetrics | null {
  const expectedChunkIds = unique(input.expectation.expectedChunkIds);
  const expectedDocumentIds = unique(input.expectation.expectedDocumentIds);

  if (expectedChunkIds.length > 0) {
    return buildMetrics({
      scope: 'chunk',
      expectedIds: expectedChunkIds,
      retrievedIds: unique(input.observation.retrievedChunkIds)
    });
  }

  if (expectedDocumentIds.length > 0) {
    return buildMetrics({
      scope: 'document',
      expectedIds: expectedDocumentIds,
      retrievedIds: unique(input.observation.retrievedDocumentIds)
    });
  }

  return null;
}

export function summarizeRetrievalMetrics(
  metrics: RetrievalMetrics[]
): RetrievalMetricSummary | null {
  if (metrics.length === 0) {
    return null;
  }

  const totalRecall = metrics.reduce(
    (accumulator, metric) => accumulator + metric.recallAtK,
    0
  );
  const totalReciprocalRank = metrics.reduce(
    (accumulator, metric) => accumulator + metric.reciprocalRank,
    0
  );

  return {
    evaluatedQuestionCount: metrics.length,
    retrievalRecallAtK: roundMetric(totalRecall / metrics.length),
    retrievalMrr: roundMetric(totalReciprocalRank / metrics.length)
  };
}

function buildMetrics(input: {
  scope: RetrievalMetrics['scope'];
  expectedIds: string[];
  retrievedIds: string[];
}): RetrievalMetrics {
  const expected = new Set(input.expectedIds);
  let hitCount = 0;
  let reciprocalRank = 0;

  input.retrievedIds.forEach((retrievedId, index) => {
    if (!expected.has(retrievedId)) {
      return;
    }

    hitCount += 1;

    if (reciprocalRank === 0) {
      reciprocalRank = 1 / (index + 1);
    }
  });

  return {
    scope: input.scope,
    k: input.retrievedIds.length,
    expectedCount: input.expectedIds.length,
    hitCount,
    recallAtK: roundMetric(hitCount / input.expectedIds.length),
    reciprocalRank: roundMetric(reciprocalRank)
  };
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string' || value.length === 0 || seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }

  return result;
}

function roundMetric(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
