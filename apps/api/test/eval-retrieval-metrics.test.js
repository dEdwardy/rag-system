import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  computeRetrievalMetrics,
  summarizeRetrievalMetrics
} from '../src/modules/eval-question-sets/eval-retrieval-metrics.ts';

function metricsFor(input) {
  return computeRetrievalMetrics({
    expectation: {
      expectedDocumentIds: input.expectedDocuments ?? [],
      expectedChunkIds: input.expectedChunks ?? []
    },
    observation: {
      retrievedDocumentIds: input.retrievedDocuments ?? [],
      retrievedChunkIds: input.retrievedChunks ?? []
    }
  });
}

test('chunk expectations win over document expectations', () => {
  const metrics = metricsFor({
    expectedChunks: ['chunk-1'],
    expectedDocuments: ['doc-9'],
    retrievedChunks: ['chunk-1'],
    retrievedDocuments: ['doc-1', 'doc-2']
  });

  assert.equal(metrics.scope, 'chunk');
  assert.equal(metrics.expectedCount, 1);
  assert.equal(metrics.recallAtK, 1);
  assert.equal(metrics.reciprocalRank, 1);
});

test('document expectations are used when no chunk expectations exist', () => {
  const metrics = metricsFor({
    expectedDocuments: ['doc-1', 'doc-2'],
    retrievedDocuments: ['doc-3', 'doc-1'],
    retrievedChunks: ['chunk-a']
  });

  assert.equal(metrics.scope, 'document');
  assert.equal(metrics.expectedCount, 2);
  assert.equal(metrics.hitCount, 1);
  assert.equal(metrics.recallAtK, 0.5);
  assert.equal(metrics.reciprocalRank, 0.5);
  assert.equal(metrics.k, 2);
});

test('no expectations means the question is not scored', () => {
  assert.equal(metricsFor({ retrievedDocuments: ['doc-1'] }), null);
});

test('a complete miss scores zero recall and zero reciprocal rank', () => {
  const metrics = metricsFor({
    expectedDocuments: ['doc-1'],
    retrievedDocuments: ['doc-2', 'doc-3']
  });

  assert.equal(metrics.hitCount, 0);
  assert.equal(metrics.recallAtK, 0);
  assert.equal(metrics.reciprocalRank, 0);
});

test('reciprocal rank uses the first relevant hit position', () => {
  const metrics = metricsFor({
    expectedDocuments: ['doc-2'],
    retrievedDocuments: ['doc-1', 'doc-2', 'doc-3']
  });

  assert.equal(metrics.reciprocalRank, 0.5);
  assert.equal(metrics.recallAtK, 1);
});

test('duplicate retrieved ids do not inflate k or recall', () => {
  const metrics = metricsFor({
    expectedDocuments: ['doc-1'],
    retrievedDocuments: ['doc-1', 'doc-1', 'doc-2']
  });

  assert.equal(metrics.k, 2);
  assert.equal(metrics.hitCount, 1);
  assert.equal(metrics.recallAtK, 1);
});

test('recall is rounded to four decimals', () => {
  const metrics = metricsFor({
    expectedDocuments: ['doc-1', 'doc-2', 'doc-3'],
    retrievedDocuments: ['doc-1']
  });

  assert.equal(metrics.recallAtK, 0.3333);
});

test('empty retrieved ids still produce a scored zero', () => {
  const metrics = metricsFor({
    expectedDocuments: ['doc-1'],
    retrievedDocuments: []
  });

  assert.equal(metrics.k, 0);
  assert.equal(metrics.recallAtK, 0);
  assert.equal(metrics.reciprocalRank, 0);
});

test('summarizeRetrievalMetrics averages only the scored questions', () => {
  const summary = summarizeRetrievalMetrics([
    {
      scope: 'document',
      k: 2,
      expectedCount: 1,
      hitCount: 1,
      recallAtK: 1,
      reciprocalRank: 1
    },
    {
      scope: 'chunk',
      k: 3,
      expectedCount: 2,
      hitCount: 1,
      recallAtK: 0.5,
      reciprocalRank: 0.5
    }
  ]);

  assert.deepEqual(summary, {
    evaluatedQuestionCount: 2,
    retrievalRecallAtK: 0.75,
    retrievalMrr: 0.75
  });
});

test('summarizeRetrievalMetrics returns null when nothing was scored', () => {
  assert.equal(summarizeRetrievalMetrics([]), null);
});
