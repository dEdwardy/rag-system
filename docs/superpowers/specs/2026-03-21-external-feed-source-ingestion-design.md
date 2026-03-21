# External Feed Source Ingestion Design

## Task Identification

This design covers the current first unchecked task in `docs/current-progress.md`: `外部知识源接入`.

## Goal

Add a minimal backend/API capability that ingests one external RSS or Atom feed URL into the existing document pipeline so feed summaries can be indexed, retrieved, and answered against like other documents.

## Scope

- Backend/API only
- Support one direct RSS or Atom feed URL per request
- Convert feed metadata and entry summaries into one generated text document
- Reuse the existing `Document -> ingestion -> chunking -> indexing` flow
- Keep current client priority aligned to `PC Web`; mobile adaptation remains out of scope
- Update practical docs and progress tracking for the new backend capability

## Non-Goals

- Do not add frontend UI in this round
- Do not add a generic external-source connector framework
- Do not fetch linked article pages recursively
- Do not support authenticated feeds or sync scheduling
- Do not expand mobile work

## Current State

The repository already supports:

- uploaded file documents
- single static web-page ingestion by URL
- async ingestion, chunking, indexing, retrieval, and ask

What is still missing is another concrete external knowledge source beyond a single HTML page. A feed connector is the next smallest increment because it adds a real remote source type without requiring a broader connector platform.

## Chosen Approach

Add one backend endpoint that accepts a feed URL, fetches the XML server-side, extracts the feed title/description plus a bounded number of item or entry summaries, stores the normalized result as a generated local text artifact, creates a `Document` with `sourceType = "feed"`, and then enqueues the existing ingestion job.

This keeps the feature small and aligned with the current architecture:

1. fetch remote feed XML
2. validate it looks like RSS or Atom
3. extract normalized feed text
4. persist that text as a local source artifact
5. create a normal `Document`
6. reuse ingestion/indexing unchanged

## Alternatives Considered

### 1. Build a generic external connector abstraction first

Pros:

- cleaner long-term expansion path
- could unify future source types

Cons:

- broadens scope before there is a second concrete connector
- adds abstractions without validated usage
- conflicts with the repository preference for small, targeted increments

Rejected because the current task should advance one concrete source type, not a platform rewrite.

### 2. Fetch each feed entry's linked page recursively

Pros:

- richer content than feed summaries alone
- closer to eventual crawler behavior

Cons:

- becomes multi-page crawling
- duplicates concerns already handled by `web_page`
- makes failure and rate-limit behavior much broader

Rejected because it expands past the smallest safe increment.

### 3. Ingest feed XML as one generated text document

Pros:

- smallest delta to the existing architecture
- deterministic reindex behavior because the generated text artifact is stored locally
- adds a real external-source type beyond single-page HTML
- easy to validate with a local HTTP test server

Cons:

- indexes feed summaries instead of full linked-page content
- first version does not preserve a per-entry document model

Chosen because it is the smallest reliable increment for the current task.

## Design

### API surface

Add:

- `POST /knowledge-bases/:id/documents/feed`

Request body:

- `url`: required absolute `http` or `https` URL
- `title`: optional explicit title override
- `maxItems`: optional integer limit for extracted feed entries, default `20`, allowed range `1..50`

Response:

- the created `Document` record in the same shape returned by existing document creation/upload flows

### Backend flow

1. Validate URL and `maxItems`.
2. Fetch the URL with a server-side HTTP client based on built-in `fetch`.
3. Reject non-OK responses and non-feed XML responses.
4. Extract:
   - feed title
   - feed description or subtitle when present
   - up to `maxItems` RSS `<item>` or Atom `<entry>` records
   - per-entry title, link, publish time, and summary/content text when present
5. Persist the extracted result into storage as a `.txt` artifact.
6. Create a `Document` with:
   - `sourceType = "feed"`
   - `sourceName = <url>`
   - `title = explicit title or extracted feed title or hostname/path fallback`
   - `mimeType = "text/plain"`
   - `storageKey = saved text artifact`
7. Enqueue ingestion using the existing document pipeline.

### Extraction rules

The first version should:

- accept `application/rss+xml`, `application/atom+xml`, `application/xml`, and `text/xml`
- support common RSS `<channel><item>` and Atom `<feed><entry>` shapes
- remove CDATA wrappers
- decode common HTML/XML entities
- strip embedded HTML from descriptions and summaries
- normalize whitespace and blank lines
- include source links in the generated text when present

The first version should not:

- execute JavaScript
- fetch linked pages
- preserve full XML fidelity
- support arbitrary XML dialects outside practical RSS/Atom parsing

### Error handling

Return `400` for:

- invalid URLs
- unsupported protocols
- unsupported content types
- XML that does not parse as a practical RSS/Atom feed
- extracted feed content that is empty

Return `502` for:

- upstream fetch failures
- upstream non-OK responses

Persist no document record when the fetch-and-extract step fails before storage succeeds.

### Reindex behavior

Reindex should keep working without special logic because the extracted feed text is stored locally and ingestion already reads from `storageKey`.

### Testing

Add focused backend coverage for:

- feed extraction from representative RSS and Atom content
- end-to-end API flow using a local HTTP server as the remote feed source:
  - create feed document
  - wait until ready
  - verify chunks contain a unique feed marker
  - ask against the ingested feed content
  - reindex and verify content remains retrievable

### Documentation

Update:

- `docs/current-dev-setup.md`
- `docs/current-progress.md`

Document the new API capability and the focused validation command. Keep `PC Web` as the only client priority; no mobile expansion.

## Files Expected To Change

- Create: `apps/api/src/infra/feed-source/feed-source.module.ts`
- Create: `apps/api/src/infra/feed-source/feed-source.service.ts`
- Modify: `apps/api/src/modules/documents/document.schemas.ts`
- Modify: `apps/api/src/modules/documents/documents.controller.ts`
- Modify: `apps/api/src/modules/documents/documents.module.ts`
- Modify: `apps/api/src/modules/documents/documents.service.ts`
- Create: `apps/api/test/feed-source-e2e.test.js`
- Modify: `apps/api/test/parsing.test.js`
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

## Validation

- `pnpm --filter @rag-system/api build`
- `node --test apps/api/test/parsing.test.js`
- `node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js`

## Acceptance Criteria

- Backend accepts an RSS or Atom feed URL and creates a document that becomes `ready`
- Extracted feed text is chunked and indexed through the existing pipeline
- Ask flow can retrieve feed marker content
- Reindex still works for a fetched feed document
- Docs reflect the new capability and current progress
