# Web Page Source Ingestion Design

## Task Identification

This design covers the current first unchecked task in `docs/current-progress.md`: `网页内容抓取 / 网页知识源接入`.

## Goal

Add a minimal backend/API capability that ingests a single web page by URL into the existing document pipeline so the fetched page can be indexed, retrieved, and answered against like uploaded files.

## Scope

- Backend/API only
- Support one direct HTML page URL per request
- Reuse the existing `Document -> ingestion -> chunking -> indexing` flow
- Keep current client priority aligned to `PC Web`; mobile adaptation remains out of scope
- Update practical docs and progress tracking for the new backend capability

## Non-Goals

- Do not add frontend UI in this round
- Do not add generic external knowledge source connectors
- Do not support authenticated sites, crawlers, sitemaps, or recursive multi-page crawling
- Do not attempt browser-rendered or JavaScript-executed extraction
- Do not expand mobile work

## Current State

The repository already supports:

- uploaded file documents
- local file storage for original source payloads
- async ingestion, parsing, chunking, indexing, and retrieval
- ask flow grounded on stored `Document` and `DocumentChunk` records

What is missing is a first-party way to create a `Document` from a web URL instead of only from an uploaded file.

## Chosen Approach

Add one backend endpoint that accepts a URL, fetches the page server-side, extracts normalized text from HTML, stores the extracted result as a text file under storage, creates a `Document` with `sourceType = "web_page"`, and then enqueues the existing ingestion job.

This keeps the new feature small and aligned with the current document architecture:

1. fetch remote page
2. convert HTML to normalized plain text
3. persist that plain text as a local source artifact
4. create a normal `Document`
5. reuse ingestion/indexing unchanged

## Alternatives Considered

### 1. Fetch and parse inside ingestion only

Pros:

- less work in the documents service
- keeps network access closer to processing

Cons:

- requires ingestion workers to know remote fetch semantics
- reindex behavior becomes ambiguous if the original fetched payload is not persisted
- makes failures less transparent at document creation time

Rejected because this mixes source acquisition into asynchronous ingestion and weakens reproducibility.

### 2. Store raw HTML and extend parsing to understand HTML

Pros:

- preserves the original payload
- keeps parsing format-specific

Cons:

- requires HTML parsing support inside the general parsing service
- increases parser surface area before it is needed for uploads
- still needs a fetch step and text normalization policy

Rejected for the first increment because it broadens the parsing layer more than necessary.

### 3. Fetch, extract text up front, save a text artifact, and reuse ingestion

Pros:

- smallest delta to existing architecture
- reindex can deterministically reuse the saved extracted text
- document lifecycle remains consistent with uploaded files
- backend/API only, easy to validate

Cons:

- stored artifact is normalized text rather than raw HTML
- first version is limited to static HTML extraction

Chosen because it is the smallest reliable increment for the current task.

## Design

### API surface

Add:

- `POST /knowledge-bases/:id/documents/web-page`

Request body:

- `url`: required absolute `http` or `https` URL
- `title`: optional explicit title override

Response:

- the created `Document` record in the same shape returned by existing document creation/upload flows

### Backend flow

1. Validate URL input.
2. Fetch the URL with a server-side HTTP client based on built-in `fetch`.
3. Reject non-OK responses and non-HTML responses.
4. Extract:
   - page title
   - normalized body text
5. Persist the extracted text into storage as a `.txt` artifact.
6. Create a `Document` with:
   - `sourceType = "web_page"`
   - `sourceName = <url>`
   - `title = explicit title or extracted title or hostname/path fallback`
   - `mimeType = "text/plain"`
   - `storageKey = saved text artifact`
7. Enqueue ingestion using the existing document pipeline.

### Extraction rules

The first version should:

- remove `script`, `style`, `noscript`, `svg`, and `iframe` blocks
- strip remaining HTML tags
- normalize HTML entities for common named and numeric forms
- collapse excessive blank lines
- prefer `<title>` for the document title

The first version should not:

- execute JavaScript
- follow pagination
- crawl linked pages
- preserve full page layout fidelity

### Error handling

Return `400` for:

- invalid URLs
- unsupported protocols
- empty extracted text
- unsupported content type

Return `502` for:

- upstream fetch failures
- upstream non-OK responses

Persist no document record when the fetch-and-extract step fails before storage succeeds.

### Reindex behavior

Reindex should keep working without special logic because the extracted page text is stored locally and ingestion already reads from `storageKey`.

### Testing

Add focused backend coverage for:

- schema validation of the web-page request body
- text extraction from representative HTML
- end-to-end API flow using a local HTTP server as the remote page source:
  - create web-page document
  - wait until ready
  - verify chunks contain fetched marker text
  - ask against the fetched content
  - reindex and verify content remains retrievable

### Documentation

Update:

- `docs/current-dev-setup.md`
- `docs/current-progress.md`

Document the new API capability and the focused validation command. Keep `PC Web` as the only client priority; no mobile expansion.

## Files Expected To Change

- Create: `apps/api/src/infra/web-page/web-page.module.ts`
- Create: `apps/api/src/infra/web-page/web-page.service.ts`
- Modify: `apps/api/src/modules/documents/document.schemas.ts`
- Modify: `apps/api/src/modules/documents/documents.controller.ts`
- Modify: `apps/api/src/modules/documents/documents.module.ts`
- Modify: `apps/api/src/modules/documents/documents.service.ts`
- Modify: `apps/api/src/infra/storage/storage.service.ts`
- Create: `apps/api/test/web-page-source-e2e.test.js`
- Modify: `apps/api/test/parsing.test.js`
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

## Validation

- `pnpm --filter @rag-system/api build`
- `node --test apps/api/test/parsing.test.js`
- `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`

## Acceptance Criteria

- Backend accepts a web page URL and creates a document that becomes `ready`
- Extracted page text is chunked and indexed through the existing pipeline
- Ask flow can retrieve fetched page content
- Reindex still works for a fetched web page document
- Docs reflect the new capability and current progress
