import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  assessEvidenceSufficiency,
  buildRetrievalEvidence,
  buildRetrievalEvidenceFromResults,
  mergeEvidenceChunks,
  mergeEvidenceWithQuota,
  resolveSecondPassDecision
} from '../src/modules/assistants/retrieval-evidence.ts';

function buildSearchResult(input) {
  return {
    query: {
      original: input.question,
      retrieval: input.question,
      rewritten: input.rewritten ?? null
    },
    chunks: input.chunks,
    contextGroups: input.contextGroups,
    diagnostics: {
      execution: {
        actualMode: 'vector',
        usedFallback: false,
        fallbackReason: null
      },
      embedding: null
    }
  };
}

function buildChunk(chunkId, score = 0.9) {
  return {
    chunkId,
    documentId: `doc-${chunkId}`,
    documentTitle: `Doc ${chunkId}`,
    chunkIndex: 0,
    content: `content ${chunkId}`,
    score,
    isPrimary: true,
    pageNo: 1,
    sectionTitle: 'Intro'
  };
}

function buildGroup(chunkId) {
  return {
    documentId: `doc-${chunkId}`,
    documentTitle: `Doc ${chunkId}`,
    startChunkIndex: 0,
    endChunkIndex: 0,
    chunkIds: [chunkId],
    primaryChunkIds: [chunkId],
    mergedContent: `content ${chunkId}`,
    pageNumbers: [1],
    sectionTitles: ['Intro']
  };
}

test('mergeEvidenceChunks keeps first occurrence and evidence is capped', () => {
  assert.deepEqual(
    mergeEvidenceChunks(
      [buildChunk('a')],
      [buildChunk('a'), buildChunk('b')]
    ).map((chunk) => chunk.chunkId),
    ['a', 'b']
  );

  const evidence = buildRetrievalEvidence({
    primary: buildSearchResult({
      question: 'q',
      chunks: [buildChunk('a'), buildChunk('b')],
      contextGroups: [buildGroup('a')]
    }),
    secondary: buildSearchResult({
      question: 'q2',
      chunks: [buildChunk('c'), buildChunk('d')],
      contextGroups: [buildGroup('c')]
    }),
    maxChunks: 2
  });

  assert.deepEqual(
    evidence.retrievedChunks.map((chunk) => chunk.chunkId),
    ['a', 'c']
  );
  assert.deepEqual(evidence.query.sourceQueries, ['q', 'q2']);
});

test('mergeEvidenceWithQuota reserves slots for second-pass evidence', () => {
  const primary = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => buildChunk(id));
  const secondary = [buildChunk('g'), buildChunk('h')];

  const merged = mergeEvidenceWithQuota({
    primary,
    secondary,
    max: 6,
    keyOf: (chunk) => chunk.chunkId
  });

  assert.deepEqual(
    merged.map((chunk) => chunk.chunkId),
    ['a', 'b', 'c', 'd', 'g', 'h']
  );
});

test('assessEvidenceSufficiency flags low-score evidence', () => {
  const primary = buildSearchResult({
    question: 'q',
    chunks: [buildChunk('a', 0.1)],
    contextGroups: [buildGroup('a')]
  });

  const result = assessEvidenceSufficiency(primary);

  assert.equal(result.sufficient, false);
  assert.ok(result.reasons.includes('low_top_score'));
});

test('buildRetrievalEvidenceFromResults merges all searches', () => {
  const evidence = buildRetrievalEvidenceFromResults([
    buildSearchResult({
      question: 'first',
      chunks: [buildChunk('a')],
      contextGroups: [buildGroup('a')]
    }),
    buildSearchResult({
      question: 'second',
      chunks: [buildChunk('a'), buildChunk('b')],
      contextGroups: [buildGroup('b')]
    })
  ]);

  assert.deepEqual(
    evidence.retrievedChunks.map((chunk) => chunk.chunkId),
    ['a', 'b']
  );
  assert.equal(evidence.query.original, 'first');
  assert.deepEqual(evidence.query.sourceQueries, ['first', 'second']);
});

test('resolveSecondPassDecision only runs a distinct requested query', () => {
  const primary = buildSearchResult({
    question: 'original',
    rewritten: 'rewritten',
    chunks: [buildChunk('a')],
    contextGroups: [buildGroup('a')]
  });

  assert.deepEqual(
    resolveSecondPassDecision({
      originalQuestion: 'original',
      boundedMultiStep: { enabled: true, requestSecondPass: true },
      primary
    }),
    {
      shouldRun: true,
      query: 'rewritten',
      reason: 'rewritten_query',
      requested: true,
      evidenceSufficient: false,
      evidenceReasons: ['low_source_diversity']
    }
  );

  assert.deepEqual(
    resolveSecondPassDecision({
      originalQuestion: 'original',
      boundedMultiStep: { enabled: true, rewrittenQuery: 'original' },
      primary
    }),
    {
      shouldRun: false,
      query: null,
      reason: 'requested_without_distinct_query',
      requested: true,
      evidenceSufficient: false,
      evidenceReasons: ['low_source_diversity']
    }
  );
});

test('resolveSecondPassDecision accepts a suggested agent query', () => {
  const primary = buildSearchResult({
    question: 'original',
    chunks: [buildChunk('a', 0.1)],
    contextGroups: [buildGroup('a')]
  });

  const decision = resolveSecondPassDecision({
    originalQuestion: 'original',
    boundedMultiStep: {
      enabled: true,
      suggestedQuery: 'broaden the search'
    },
    primary
  });

  assert.equal(decision.shouldRun, true);
  assert.equal(decision.query, 'broaden the search');
  assert.equal(decision.reason, 'suggested_query');
});
