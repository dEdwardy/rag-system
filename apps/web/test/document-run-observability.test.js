import { test } from 'vitest';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const helperModuleUrl = pathToFileURL(
  resolve(
    __dirname,
    '../src/components/document-runs/document-run-observability.ts'
  )
).href;

async function loadHelpers() {
  return import(helperModuleUrl);
}

test('buildRunDiagnosticsHighlights extracts minimal failure context', async () => {
  const { buildRunDiagnosticsHighlights } = await loadHelpers();

  const highlights = buildRunDiagnosticsHighlights({
    code: 'SOURCE_FETCH_FAILED',
    retryable: true,
    partial: true,
    failedPageCount: 2,
    failedChildSitemapCount: 1,
    message: 'Remote sitemap fetch failed.'
  });

  assert.deepEqual(highlights, [
    { key: 'code', value: 'SOURCE_FETCH_FAILED' },
    { key: 'retryable', value: 'yes' },
    { key: 'partial', value: 'yes' },
    { key: 'failedPages', value: '2' },
    { key: 'failedChildSitemaps', value: '1' }
  ]);
});

test('buildRunDiagnosticsHighlights falls back to failure summary when diagnostics are absent', async () => {
  const { buildRunDiagnosticsHighlights } = await loadHelpers();

  const highlights = buildRunDiagnosticsHighlights(null, {
    code: 'STALE_GUARD_BLOCKED',
    failedStage: 'stale_guard',
    retryable: false,
    message: 'Run was superseded by a newer document version.'
  });

  assert.deepEqual(highlights, [
    { key: 'code', value: 'STALE_GUARD_BLOCKED' },
    { key: 'retryable', value: 'no' }
  ]);
});

test('describeRunMeta normalizes trigger source type and failure message', async () => {
  const { describeRunMeta } = await loadHelpers();

  const meta = describeRunMeta({
    trigger: 'external_resync',
    status: 'failed',
    failedStage: 'source_fetch',
    startedAt: '2026-03-22T08:00:00.000Z',
    finishedAt: '2026-03-22T08:02:00.000Z',
    diagnosticsJson: {
      code: 'INVALID_FEED_ENTRY',
      message: 'Entry summary and link are both missing.',
      retryable: false
    },
    document: {
      sourceType: 'feed',
      sourceName: 'Product feed',
      title: 'Product updates'
    }
  });

  assert.equal(meta.triggerLabel, 'External resync');
  assert.equal(meta.sourceTypeLabel, 'Feed');
  assert.equal(meta.failureMessage, 'Entry summary and link are both missing.');
  assert.equal(meta.failedStageLabel, 'Source fetch');
  assert.equal(meta.finishedAt, '2026-03-22T08:02:00.000Z');
});

test('describeRunMeta falls back to failure summary stage and message', async () => {
  const { describeRunMeta } = await loadHelpers();

  const meta = describeRunMeta({
    trigger: 'reindex',
    status: 'failed',
    failedStage: null,
    startedAt: '2026-03-22T08:00:00.000Z',
    finishedAt: '2026-03-22T08:01:00.000Z',
    diagnosticsJson: null,
    failureSummary: {
      code: 'STALE_GUARD_BLOCKED',
      failedStage: 'stale_guard',
      retryable: false,
      message: 'Run was superseded by a newer document version.'
    }
  });

  assert.equal(meta.failedStageLabel, 'Stale guard');
  assert.equal(
    meta.failureMessage,
    'Run was superseded by a newer document version.'
  );
});

test('buildRunSummaryText provides scan-first status summary', async () => {
  const { buildRunSummaryText } = await loadHelpers();

  assert.equal(
    buildRunSummaryText(
      {
        trigger: 'manual',
        status: 'ready',
        failedStage: null,
        startedAt: '2026-03-22T08:00:00.000Z',
        finishedAt: '2026-03-22T08:02:00.000Z'
      },
      'en'
    ),
    'Run completed successfully.'
  );

  assert.equal(
    buildRunSummaryText(
      {
        trigger: 'manual',
        status: 'failed',
        failedStage: 'source_fetch',
        startedAt: '2026-03-22T08:00:00.000Z',
        finishedAt: '2026-03-22T08:02:00.000Z'
      },
      'zh'
    ),
    '运行失败，阶段：Source fetch。'
  );

  assert.equal(
    buildRunSummaryText(
      {
        trigger: 'manual',
        status: 'processing',
        failedStage: null,
        startedAt: '2026-03-22T08:00:00.000Z',
        finishedAt: null
      },
      'en'
    ),
    'Run is in progress.'
  );

  assert.equal(
    buildRunSummaryText(
      {
        trigger: 'manual',
        status: 'failed',
        failedStage: 'source_fetch',
        startedAt: '2026-03-22T08:00:00.000Z',
        finishedAt: '2026-03-22T08:02:00.000Z'
      },
      'en'
    ),
    'Run failed during Source fetch.'
  );

  assert.equal(
    buildRunSummaryText(
      {
        trigger: 'manual',
        status: 'failed',
        failedStage: null,
        failureSummary: {
          code: 'STALE_GUARD_BLOCKED',
          failedStage: 'stale_guard',
          retryable: false,
          message: 'Run was superseded by a newer document version.'
        },
        startedAt: '2026-03-22T08:00:00.000Z',
        finishedAt: '2026-03-22T08:02:00.000Z'
      },
      'en'
    ),
    'Run failed during Stale guard.'
  );
});
