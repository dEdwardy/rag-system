# Sitemap Source Ingestion Design

## Task Identification

This design covers the current first unchecked task in `docs/current-progress.md`: `external knowledge source expansion`.

## Goal

Add a backend/API-only sitemap ingestion path so one sitemap URL can be expanded into a bounded set of web pages, normalized into one generated text document, and then indexed through the existing document pipeline.

## Scope

- Backend/API only
- Keep working on the current first unchecked task only
- Add one direct sitemap source type
- Reuse existing storage, ingestion, chunking, indexing, retrieval, and ask flow
- Reuse the existing web-page extraction logic for each discovered page
- Keep `PC Web` as the current client priority; do not expand mobile work

## Non-Goals

- Do not add frontend UI in this round
- Do not build a generic connector platform
- Do not add recursive crawler behavior beyond one sitemap payload
- Do not add scheduling, auth, or sync refresh
- Do not fetch browser-rendered pages
- Do not expand mobile work

## Current State

The repository already supports:

- uploaded files
- one direct web page source
- one direct RSS/Atom feed source
- async ingestion and indexing
- retrieval/ask against stored documents

The current unchecked task remains broader than those two minimum increments. The next smallest backend-first step is a sitemap source that can bootstrap multiple related web pages from one source URL without introducing a full crawler framework.

## Chosen Approach

Add one backend endpoint that accepts a sitemap URL, fetches the XML server-side, extracts a bounded set of page URLs, fetches each page through the existing `WebPageService`, combines the extracted page content into one generated local text artifact, creates a `Document` with `sourceType = "sitemap"`, and then enqueues the existing ingestion job.

This keeps the increment aligned with the current architecture:

1. fetch sitemap XML
2. extract page URLs from one sitemap payload
3. fetch a bounded number of pages with the existing page extractor
4. combine normalized page content into one text artifact
5. create a normal `Document`
6. reuse ingestion/indexing unchanged

## Alternatives Considered

### 1. Build a generic external-source connector abstraction first

Pros:

- cleaner long-term extensibility story
- could unify page/feed/sitemap flows

Cons:

- broadens scope beyond the single current task increment
- forces refactoring of already-working source types
- adds architecture work before another concrete source is proven

Rejected because the repository guidance prefers focused increments over broad refactors.

### 2. Crawl directly from one page instead of using sitemap XML

Pros:

- simpler user input than sitemap
- closer to generic crawling direction

Cons:

- much higher ambiguity around link selection and crawl limits
- easier to over-expand scope
- duplicates some site-discovery concerns that sitemap already solves

Rejected because it becomes crawler design work instead of a bounded source-type increment.

### 3. Ingest one sitemap URL into one combined document

Pros:

- smallest concrete expansion beyond page/feed
- backend-first and testable
- reuses the existing web-page extractor and ingestion flow
- keeps reindex deterministic because the generated text artifact is stored locally

Cons:

- resulting document is a combined snapshot, not per-page document records
- first version is limited to sitemap XML that directly lists page URLs

Chosen because it is the smallest reliable increment for the current task.

## Design

### API surface

Add:

- `POST /knowledge-bases/:id/documents/sitemap`

Request body:

- `url`: required absolute `http` or `https` URL
- `title`: optional explicit title override
- `maxPages`: optional integer limit for fetched page URLs, default `20`, allowed range `1..50`

Response:

- the created `Document` record in the same shape returned by existing document creation/upload flows

### Backend flow

1. Validate request input.
2. Fetch the sitemap XML with server-side `fetch`.
3. Reject non-OK responses and unsupported XML content types.
4. Extract page URLs from a direct `<urlset>` sitemap.
5. Limit to `maxPages`.
6. Fetch each page URL through `WebPageService`.
7. Build one normalized text payload containing:
   - sitemap source URL
   - each page URL
   - each page title when present
   - each page normalized content
8. Persist the combined text into storage as a generated `.txt` artifact.
9. Create a `Document` with:
   - `sourceType = "sitemap"`
   - `sourceName = <sitemap url>`
   - `title = explicit title or hostname/path fallback`
   - `mimeType = "text/plain"`
   - `storageKey = saved generated artifact`
10. Enqueue ingestion using the existing document pipeline.

### Extraction rules

The first version should:

- support one direct XML sitemap with `<urlset><url><loc>...`
- decode common XML entities
- de-duplicate repeated page URLs
- keep first-seen URL order
- fail when no usable page URLs are extracted
- reuse existing HTML normalization through `WebPageService`

The first version should not:

- support sitemap index recursion
- follow discovered page links
- add per-page `Document` records
- persist raw sitemap XML

### Error handling

Return `400` for:

- invalid URLs
- unsupported protocols
- unsupported sitemap content type
- unsupported sitemap XML shape
- empty or unusable extracted URL sets
- no successfully extracted page content

Return `502` for:

- upstream sitemap fetch failures
- upstream sitemap non-OK responses
- upstream page fetch failures for any required page in the bounded set

Persist no document record when sitemap fetch/extraction fails before storage succeeds.

### Reindex behavior

Reindex should keep working without special logic because the combined generated text artifact is stored locally and ingestion already reads from `storageKey`.

### Testing

Add focused backend coverage for:

- sitemap XML extraction from representative content
- end-to-end API flow using a local HTTP server:
  - serve sitemap XML plus linked HTML pages
  - create sitemap document
  - wait until ready
  - verify chunks contain page markers
  - ask against the ingested sitemap content
  - reindex and verify content remains retrievable

### Documentation

Update:

- `docs/current-dev-setup.md`
- `docs/current-progress.md`

Document the new API capability and focused validation command. Keep the broader `external knowledge source expansion` task open because this is another bounded increment, not the entire direction.

## Files Expected To Change

- Create: `apps/api/src/infra/sitemap-source/sitemap-source.module.ts`
- Create: `apps/api/src/infra/sitemap-source/sitemap-source.service.ts`
- Modify: `apps/api/src/modules/documents/document.schemas.ts`
- Modify: `apps/api/src/modules/documents/documents.controller.ts`
- Modify: `apps/api/src/modules/documents/documents.module.ts`
- Modify: `apps/api/src/modules/documents/documents.service.ts`
- Modify: `apps/api/test/parsing.test.js`
- Create: `apps/api/test/sitemap-source-e2e.test.js`
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

## Validation

- `pnpm --filter @rag-system/api build`
- `node --test apps/api/test/parsing.test.js`
- `node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js`

## Acceptance Criteria

- Backend accepts a sitemap URL and creates a document that becomes `ready`
- Sitemap page content is chunked and indexed through the existing pipeline
- Ask flow can retrieve marker content from the fetched sitemap pages
- Reindex still works for a sitemap-backed document
- Docs reflect the new capability and note that the broader external-source expansion task remains ongoing
