# External Knowledge Source Expansion Design

> 文档角色：`historical-task-spec`
> 当前使用方式：这是 `external knowledge source expansion` 某一已完成子增量的设计记录；当前阶段方向可参考，但不要把本文档直接当成当前唯一设计依据。

## Task Identification

This design covers the current first unchecked task in `docs/current-progress.md`: `external knowledge source expansion`.

## Goal

Continue the backend-first expansion of external knowledge ingestion beyond the already completed minimum increments (`web page`, `feed`, `direct urlset sitemap`) by adding the next smallest useful source capability: sitemap index support.

## Scope

- Backend/API only
- Continue the same top-level task; do not jump to later tasks
- Add support for sitemap index XML that references child sitemap files
- Reuse the existing direct sitemap ingestion flow after expansion
- Keep `PC Web` as the current client priority
- Keep mobile work deferred

## Non-Goals

- Do not add frontend UI in this round
- Do not add generic connector abstractions
- Do not add scheduled sync, refresh, auth, or tenant features
- Do not add recursive website crawling from page links
- Do not support arbitrarily deep sitemap recursion
- Do not mark the broader `external knowledge source expansion` task as fully done after this increment

## Current State

The repository already supports these external source minimum increments:

- one direct web page URL
- one direct RSS/Atom feed URL
- one direct sitemap `urlset` URL

The current sitemap implementation explicitly rejects sitemap index payloads and only supports direct `<urlset>` documents. That leaves a common external-source shape unsupported while staying inside the same backend ingestion direction.

## Chosen Increment

Extend sitemap ingestion so one submitted sitemap URL may be either:

- a direct `<urlset>` sitemap, or
- a `<sitemapindex>` document that references a bounded number of child sitemap URLs

The service should expand child sitemaps into page URLs, deduplicate them, cap total page fetches with the existing `maxPages` limit, and then reuse the existing combined-text artifact generation path.

## Alternatives Considered

### 1. Add another unrelated source type first

Examples:

- PDF URL fetch
- Git repository ingestion
- generic multi-page crawl seed

Pros:

- broadens the source matrix faster

Cons:

- skips over an obvious gap in the current sitemap path
- adds more design surface than needed
- weakens task continuity inside the same source family

Rejected because the current task should advance in the smallest coherent backend increment.

### 2. Build a generic connector framework now

Pros:

- cleaner future abstraction story

Cons:

- over-scoped for the current increment
- risks refactoring working flows without immediate product value

Rejected because repository guidance prefers targeted changes over broad refactors.

### 3. Extend sitemap ingestion to support sitemap indexes

Pros:

- directly continues the current source family
- backend-only and low-risk
- reuses current `SitemapSourceService` and `WebPageService`
- common real-world sitemap shape

Cons:

- still stores one combined document instead of per-page records
- requires careful bounds to avoid accidental over-expansion

Chosen because it is the next smallest useful step inside the current unchecked task.

## Design

### API behavior

Keep the existing endpoint:

- `POST /knowledge-bases/:id/documents/sitemap`

Keep the existing request shape:

- `url`
- optional `title`
- optional `maxPages`

No API contract change is required for the first sitemap-index increment.

### Backend flow

1. Fetch the submitted sitemap URL.
2. Detect whether the payload is a direct `urlset` or a `sitemapindex`.
3. If it is a direct `urlset`, extract page URLs as today.
4. If it is a `sitemapindex`, extract child sitemap URLs in first-seen order.
5. Fetch child sitemaps sequentially until enough page URLs have been collected to satisfy `maxPages`.
6. Extract direct page URLs from each child sitemap.
7. De-duplicate page URLs across all child sitemaps.
8. Truncate the final page list to `maxPages`.
9. Reuse the existing page fetch and combined text artifact generation path.
10. Create a normal `Document` with `sourceType = "sitemap"` and enqueue ingestion.

### Bounding rules

To keep the increment safe and deterministic:

- support only one root sitemap index level
- support only child sitemaps that are direct `urlset` documents
- do not recursively process nested sitemap indexes
- cap child sitemap processing with a small service-level maximum
- continue to cap fetched pages with the request `maxPages` value
- preserve first-seen order after de-duplication

### Error handling

Return `400` for:

- invalid URLs
- unsupported protocols
- unsupported sitemap content type
- unsupported sitemap XML shape
- empty sitemap index entries
- empty extracted page URL set after expansion
- nested sitemap indexes when encountered as child payloads

Return `502` for:

- upstream root sitemap fetch failures
- upstream child sitemap fetch failures
- upstream page fetch failures
- non-OK upstream responses

As with the current source flows, no document should be persisted if source expansion fails before artifact storage succeeds.

### Testing

Add focused coverage for:

- parsing/service behavior for sitemap index extraction and bounded expansion
- end-to-end API flow where:
  - the submitted URL returns a sitemap index
  - child sitemap URLs return direct `urlset` payloads
  - linked pages return deterministic HTML markers
  - the created document becomes `ready`
  - chunk content and ask retrieval include the marker

### Documentation

Update:

- `docs/current-dev-setup.md`
- `docs/current-progress.md`

Document that sitemap ingestion now supports sitemap indexes in addition to direct `urlset` files, while the broader `external knowledge source expansion` task remains open.

## Files Expected To Change

- Modify: `apps/api/src/infra/sitemap-source/sitemap-source.service.ts`
- Modify: `apps/api/test/parsing.test.js`
- Modify: `apps/api/test/sitemap-source-e2e.test.js`
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

## Validation

- `pnpm --filter @rag-system/api build`
- `node --test apps/api/test/parsing.test.js`
- `node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js`

## Acceptance Criteria

- Existing sitemap endpoint accepts a sitemap index URL without API changes
- Child sitemap URLs are expanded into a bounded deduplicated page list
- Resulting document becomes `ready` through the existing ingestion path
- Ask flow can retrieve marker content originating from a page discovered via sitemap index
- Docs reflect the expanded sitemap behavior
- `external knowledge source expansion` remains the first open top-level task after this increment
