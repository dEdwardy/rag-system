# Current Dev Setup

> 文档角色：`current-setup`
> 当前使用方式：当前本地运行、测试、验证命令和环境说明，以本文档为主。

## Local infra

Start local services:

```bash
docker compose up -d
```

This brings up:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

## Install dependencies

```bash
pnpm install
```

## Database

Current local PostgreSQL connection values:

- host: `localhost`
- port: `5432`
- database: `rag_system`
- username: `postgres`
- password: `postgres`
- URL: `postgresql://postgres:postgres@localhost:5432/rag_system`

Current local Redis connection values:

- host: `localhost`
- port: `6379`
- password: none
- URL: `redis://localhost:6379`

Apply migrations:

```bash
pnpm --filter @rag-system/api exec prisma migrate dev
```

Seed default records:

```bash
node apps/api/prisma/seed.js
```

Default seeded IDs:

- tenant: `default-tenant`
- user: `default-user`
- knowledge base: `default-kb`
- retrieval profile: `default-retrieval-profile`
- assistant: `default-assistant`

## Start API

Stable way in the current environment:

```bash
pnpm --filter @rag-system/api build
node apps/api/dist/main.js
```

Health check:

```bash
curl http://localhost:3000/health
```

The API will use Ollama automatically when these environment values are present:

```text
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBEDDING_MODEL=qwen2.5:7b
```

Notes:

- The current API startup path now loads `.env` from the repo root and `apps/api/.env`.
- In the current local environment, `qwen2.5:7b` has been verified to respond to both `/api/generate` and `/api/embed`.
- If you later switch to a dedicated embedding model, only `OLLAMA_EMBEDDING_MODEL` needs to change.
- `PATCH /assistants/:id` now accepts `answerPolicyJson` with:
  - `responseStyle`: `concise`, `balanced`, or `detailed`
  - `tone`: `neutral`, `friendly`, or `direct`
  - `outputFormat`: `paragraph`, `bullets`, or `markdown`
  - `language`: `auto`, `same_as_question`, `zh`, or `en`
  - `citationMode`: `required` or `optional`
  - `maxCitations`: `1..8`
  - `noAnswerBehavior`: `say_insufficient_context` or `best_effort`
  - `includeMissingInformation`: `true` or `false`
  - current backend defaults:
    - `responseStyle`: `concise`
    - `tone`: `neutral`
    - `outputFormat`: `paragraph`
    - `language`: `auto`
    - `citationMode`: `required`
    - `maxCitations`: `3`
    - `noAnswerBehavior`: `say_insufficient_context`
    - `includeMissingInformation`: `true`
- current backend enforcement for `noAnswerBehavior`:
  - `say_insufficient_context`: when the final answer status is `insufficient_context`, the backend now replaces model free-form text with a deterministic insufficient-context reply
  - the fallback reply is localized for `en` / `zh`, and `auto` / `same_as_question` currently resolve by simple question-language detection
  - `best_effort`: the backend preserves the model's returned answer text even when the final answer status is `insufficient_context`
- `PATCH /retrieval-profiles/:id` now accepts:
  - richer `filtersJson` operators:
    - `documentIds.include` / `documentIds.exclude`
    - `sectionTitles.include` / `sectionTitles.exclude` / `sectionTitles.contains`
    - `pageNumbers.include` / `pageNumbers.exclude` / `pageNumbers.min` / `pageNumbers.max`
  - `filtersJson: null` to clear saved retrieval metadata filters
- Local CORS is enabled by default for:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`
  - `http://localhost:3001`
  - `http://127.0.0.1:3001`
- You can override allowed origins with:

```text
CORS_ORIGIN=http://localhost:5173,http://your-other-origin
```

## Start web

```bash
pnpm --filter @rag-system/web dev
```

Current web URL in local development:

- `http://localhost:5173`

Current client focus for this stage:

- `PC Web` only
- current first UX priority is the `Chat` page experience
- mobile adaptation is intentionally deferred until the core feature surface and validation coverage are more mature
- current local execution preference is strict serial execution to avoid workstation stalls during validation

Language behavior in the current web app:

- The web app now supports `zh` and `en`.
- Initial language is chosen from `localStorage` first.
- If no stored language exists, the app falls back to browser language detection.
- The top-right language switch in the app shell can be used to toggle languages.
- Selected language is persisted in `localStorage` under `rag-system-locale`.

## Run tests

Repository-level API test command:

```bash
pnpm test:api
```

API package-level test command:

```bash
pnpm --filter @rag-system/api test
```

Current API test coverage:

- PDF parsing
- DOCX parsing
- chunking
- retrieval chunk window
- hybrid retrieval merge
- rerank behavior
- citation-aware answering
- upload -> ready -> ask -> trace HTTP integration
- web page source ingestion
- feed source ingestion
- sitemap source ingestion
- sitemap index source ingestion
- external source failed-document persistence and recovery cleanup
- external source partial diagnostics normalization and summary consistency

Focused document-chain E2E validation:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js
```

Focused ask-chain E2E validation:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/ask-chain-e2e.test.js
```

Focused web-page source E2E validation:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js
```

Focused feed source E2E validation:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js
```

Focused sitemap source E2E validation:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js
```

Focused ask stream E2E validation:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/ask-stream-e2e.test.js
```

Focused chat stream state validation:

```bash
node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js
```

Focused chat UI polish validation:

```bash
node --experimental-strip-types --test apps/web/test/chat-page-helpers.test.js
```

Focused source run observability UI validation:

```bash
node --experimental-strip-types --test apps/web/test/document-run-observability.test.js
node --test apps/web/test/ui-review-regressions.test.js
```

Focused PC Web smoke validation:

```bash
pnpm --filter @rag-system/api build
pnpm --filter @rag-system/web build
node --test apps/web/test/pc-web-smoke.test.js
```

Notes:

- when running local validation in the current workstation environment, prefer strict serial execution
- do not run multiple heavy builds or node test processes at the same time
- do not overlap heavy validation with AI review
- this smoke test is currently scoped to `PC Web`
- it validates `Knowledge Base -> Assistant` browser rendering against the real local API
- it is intentionally smaller than the later full document-flow and ask-flow browser E2E tasks
- backend now also supports `POST /knowledge-bases/:id/documents/web-page` for one direct `http` / `https` page URL
- the current first version fetches static HTML server-side, extracts normalized text, stores it as a generated local text artifact, and then reuses the existing ingestion/indexing path
- backend now also supports `POST /knowledge-bases/:id/documents/feed` for one direct RSS or Atom feed URL
- the current feed version fetches XML server-side, extracts feed metadata plus bounded entry summaries into one generated local text artifact, and then reuses the existing ingestion/indexing path
- feed source fetch now also tolerates bounded partial invalid-entry failures:
  - when at least one entry remains usable, the source still generates a document and enters ingestion
  - when all selected entries are invalid, the source still fails at `source_fetch`
  - partial success currently persists structured diagnostics on both the document and its run, including:
    - `attemptedEntryCount`
    - `succeededEntryCount`
    - `failedEntryCount`
    - capped `failedEntryRefs`
    - capped `failedEntries` summary objects with:
      - `ref`
      - `code`
      - `message`
      - `retryable`
    - truncation metadata when capped:
      - `failedEntriesTruncated`
      - `failedEntriesOmittedCount`
    - `partial: true`
- backend now also supports `POST /knowledge-bases/:id/documents/sitemap` for one direct sitemap XML URL
- the current sitemap version fetches one sitemap XML URL server-side, supports either one direct `urlset` or one root `sitemapindex`, expands a bounded set of page URLs, aggregates extracted page text into one generated local text artifact, and then reuses the existing ingestion/indexing path
- for sitemap-index expansion, the current backend processes up to `20` child sitemap files and still caps the final fetched page set with request `maxPages`
- sitemap and sitemap-index source fetch now tolerate bounded partial page failures:
  - when at least one fetched page succeeds, the source still generates a document and enters ingestion
  - when all fetched pages fail, the source still fails at `source_fetch`
  - for `sitemapindex`, child sitemap XML fetch now also tolerates partial failures:
    - when at least one child sitemap expands successfully, the source can still continue
    - when all child sitemap fetches fail, the source still fails at `source_fetch`
  - partial success currently persists structured diagnostics on both the document and its run, including:
    - `attemptedPageCount`
    - `succeededPageCount`
    - `failedPageCount`
    - capped `failedPageUrls`
    - capped `failedPages` summary objects with:
      - `url`
      - `code`
      - `message`
      - `retryable`
    - truncation metadata when capped:
      - `failedPagesTruncated`
      - `failedPagesOmittedCount`
    - `partial: true`
    - and for partial `sitemapindex` child expansion:
      - `attemptedChildSitemapCount`
      - `succeededChildSitemapCount`
      - `failedChildSitemapCount`
      - capped `failedChildSitemapUrls`
      - capped `failedChildSitemaps` summary objects with:
        - `url`
        - `code`
        - `message`
        - `retryable`
      - truncation metadata when capped:
        - `failedChildSitemapsTruncated`
        - `failedChildSitemapsOmittedCount`
- posting the same external source URL again now reuses the existing document record for that `kbId + sourceType + normalized URL`, increments `version`, replaces the generated source artifact, and re-runs ingestion instead of creating duplicate documents
- when an external source document is queued into a new `external_resync` version, its document-level `chunkCount` is now reset to `0` immediately, matching the existing upload-document `reindex` behavior while the new version is still pending
- ingestion queue jobs now carry the expected document `version`; stale jobs are skipped before parsing/chunk deletion/index writes so an older reindex or resync run cannot overwrite a newer one
- document failure states now also persist `diagnosticsJson` with a stable `code`, `failedStage`, `retryable`, `documentVersion`, and `message`, so `GET /documents/:id` exposes structured ingestion diagnostics instead of only a flat `errorMessage`
- the ingestion worker now records `chunking` as a real intermediate processing stage between `parsing` and `indexing`
- external source HTTP fetches now share a small retry guard: one automatic retry for transient `429` / `5xx` upstream responses before surfacing the failure
- external source creation now reserves a `Document` record before remote fetch, so when `web page` / `feed` / `sitemap` source fetch fails the failure is still visible later through `GET /knowledge-bases/:id/documents` and `GET /documents/:id`
- external source documents now persist `sourceConfigJson`, and `POST /documents/:id/reindex` for `web_page` / `feed` / `sitemap` performs a true remote re-sync using the stored source config instead of only re-parsing the previous generated text artifact
- if an external source document later loses a valid `sourceConfigJson`, `POST /documents/:id/reindex` now still creates a new `external_resync` run/version and then records a structured non-retryable failure instead of failing before run history is written
- when an external source re-sync does not yield a new source-level title, the backend now preserves the document's current `title` instead of overwriting it with the normalized URL fallback
- the same title-preservation rule now also applies when posting the same external source URL again and the backend reuses the existing document record for a fresh sync
- external source fetch diagnostics now distinguish retryability at the source-fetch boundary:
  - upstream / transient fetch failures remain `retryable: true`
  - invalid payload / unsupported content type style failures now persist as `retryable: false`
- backend now also persists run-level execution history in `DocumentRun` and exposes it through `GET /documents/:id/runs`
- backend now also exposes knowledge-base scoped recent run history through `GET /knowledge-bases/:id/document-runs`
- backend now also exposes one lightweight aggregate summary through `GET /knowledge-bases/:id/document-runs/summary`
- the current PC Web now minimally consumes these run observability endpoints in existing pages:
  - `Knowledge Base` shows recent source/document runs plus a small recent-run summary and latest failure context
  - `Knowledge Base` recent runs now also support a minimal status filter (`all` / `failed` / `processing`), direct jump to the related document, and one-item reindex for failed/skipped runs
  - `Document Detail` shows per-document run history with status, trigger, source timing, and minimal diagnostics expansion
- the knowledge-base scoped run list currently supports minimal query filters:
  - `documentId`
  - `sourceType`
  - `status`
  - `trigger`
  - `sinceHours`
  - `includeDiagnostics`
  - `limit` (default `20`, max `100`)
- the run summary endpoint also supports `sinceHours` so recent-run diagnostics can be scoped to a smaller time window
- `document-runs` list now defaults to a lighter payload and only includes `diagnosticsJson` when `includeDiagnostics=true`
- `document-runs` list now also includes a lightweight `failureSummary` so recent-run consumers can show minimal failure context without requesting full diagnostics:
  - `code`
  - `failedStage`
  - `retryable`
  - `message`
- for partial-ready runs, top-level `failedStage` in list/detail/summary anchors now also falls back to `failureSummary.failedStage`, so consumers do not need to special-case `failedStage: null`
- the summary payload currently includes:
  - `totalRuns`
  - `latestRunAt`
  - `latestFinishedAt`
  - `byStatus`
  - `byTrigger`
  - `bySourceType`
  - `retryableFailures`
  - `nonRetryableFailures`
  - `failureByStage`
  - `latestRetryableFailure`
  - `latestSkipped`
  - `latestFailure`
- `latestRetryableFailure` / `latestSkipped` / `latestFailure` now also expose the same lightweight `failureSummary` shape used by the run list:
  - `code`
  - `failedStage`
  - `retryable`
  - `message`
- these summary anchors now resolve by the latest matching completed run timestamp (`finishedAt`, with `startedAt` fallback only when needed), so overlapping runs do not let a later-started but earlier-finished run override the more recent completed anchor
- summary failure counters and `latestFailure` / `latestRetryableFailure` now collapse to each document's latest completed run, so an older external-source failure or partial result no longer remains in summary once a later resync for that same document completes cleanly
- `latestSkipped` still remains a history-style latest skipped-run anchor across matching runs; a later successful run for the same document does not erase the most recent skipped event from summary
- summary failure stats now count both:
  - terminal `failed` runs
  - `ready` runs that still carry a partial `failureSummary`
- `latestFailure` now resolves from the most recent counted `failureSummary` run, so a newer partial-ready source run can supersede an older terminal failure in the summary anchor
- `pending` / `processing` runs that temporarily carry preserved partial diagnostics are not counted in summary failure stats, and their top-level `failedStage` remains `null`
- `GET /knowledge-bases/:id/document-runs?status=failed` currently remains terminal-only and does not include partial-ready runs
- each document run currently records:
  - `documentId`
  - `version`
  - `trigger`: `upload` / `reindex` / `external_resync`
  - `status`: `pending` / `processing` / `ready` / `failed` / `skipped`
  - `failedStage`
  - `diagnosticsJson`
  - `startedAt` / `finishedAt`
- the knowledge-base scoped run list currently also includes a small `document` summary for each run:
  - `id`
  - `kbId`
  - `sourceType`
  - `sourceName`
  - `title`
  - `status`
  - `processingStage`
  - `version`
- `GET /documents/:id/runs` and `GET /knowledge-bases/:id/document-runs` now both order recent runs by `startedAt desc` first, with `version desc` only as a secondary tie-breaker
- `GET /knowledge-bases/:id/documents` now orders documents by latest `updatedAt desc`, so a reindexed or recovered external source surfaces with the newest current activity instead of its original creation time
- as of `2026-03-23`, the current external-source backend closeout has also been rerun through the full repository API suite with:

```bash
pnpm test:api
```

- latest recorded result for that full API suite:
  - `116 / 116` passing
- stale ingestion jobs now also mark their superseded run as `skipped` with structured diagnostics instead of leaving an older run stuck in a pending state
- backend now also supports `POST /assistants/:id/ask/stream` for NDJSON-based chat streaming
- the current stream path now forwards native answer-generation text deltas from the configured provider during the generation phase
- it still keeps citations, trace ids, and the completed ask payload in the final completion event instead of attempting full structured real-time metadata streaming
- when the ask pipeline fails after the stream starts, the stream emits one structured `error` event that preserves the existing diagnostics shape (`message`, `code`, `traceId`, `details`)

## Current working flow

1. Open the web app.
2. Upload a `.md`, `.txt`, `.docx`, or text-based `.pdf` document in `Documents`.
3. Wait until the document becomes `ready`.
4. Open document details to inspect status, metadata, and generated chunks.
5. Ask questions in `Chat`.
6. Inspect citations and open trace details.
7. Jump from citations to linked document chunks.
8. Edit assistant and retrieval configuration in `Assistant`.
9. In `Assistant`, you can now manage:
   - assistant answer policy controls
   - retrieval tuning controls
   - retrieval metadata filters

## Validated local run

The following path has been validated locally on `2026-03-21`:

1. Start PostgreSQL and Redis with Docker.
2. Start API with `node apps/api/dist/main.js`.
3. Upload a markdown, DOCX, or PDF document to `default-kb`.
4. Wait for the document to reach `ready`.
5. Confirm vectors are written to `storage/vectors/default-kb.json`.
6. Ask `default-assistant` a question and confirm:
   - answer is returned
   - `answerStatus` is `grounded` or `insufficient_context`
   - `missingInformation` is returned as an array
   - `qualityEvaluation` is returned with `overall`, `grounding`, `completeness`, `flags`, and `summary`
   - `retrievalMetadata` is returned with resolved strategy, rewrite execution, and retrieval execution summary
   - `answeringMetadata` is returned with prompt id, normalized answer policy, context mode, and citation count
   - citations are returned
   - citation `snippet` prefers a validated verbatim quote from the cited source when the model provides one
   - `contextGroups` is returned as an array
   - contiguous same-document chunks may be merged into one `contextGroup.mergedContent`
   - answer may include inline source markers like `[1]`
   - `retrievedChunks` include vector similarity scores
   - trace may contain `rewrittenQuery`
   - trace `retrievalScoresJson` may contain `vectorScore`, `lexicalScore`, `hybridScore`, and `rerankScore`
   - trace `retrievalMetadataJson` records the effective retrieval strategy, filters, rewrite execution, and retrieval summary
   - trace `answeringMetadataJson` records the effective answer prompt id and normalized answer-policy execution
   - trace persistence is successful

## Current implementation scope

- Local file storage
- Redis-backed document ingestion queue
- Basic parsing for `.md` / `.txt` / `.docx` / text-based `.pdf`
- Multi-chunk splitting with heading-aware grouping and oversized-paragraph splitting
- Ollama/OpenAI embedding generation with local fallback
- File-backed vector store under `storage/vectors`
- Vector retrieval with lexical fallback when vector search is unavailable
- Hybrid retrieval candidate merge when `enableHybrid` is enabled
- Additional retrieval rerank heuristic when `enableRerank` is enabled
- Retrieval profile `filtersJson` strategy operators with backward-compatible normalization:
  - `documentIds.include` / `documentIds.exclude`
  - `sectionTitles.include` / `sectionTitles.exclude` / `sectionTitles.contains`
  - `pageNumbers.include` / `pageNumbers.exclude` / `pageNumbers.min` / `pageNumbers.max`
- Retrieval profile `strategyJson` with backward-compatible resolution from legacy flat fields:
  - `queryRewrite.enabled`
  - `candidateSelection.mode`: `vector` / `hybrid` / `lexical`
  - `candidateSelection.candidateMultiplier`
  - `candidateSelection.minCandidates`
  - `hybrid.vectorWeight` / `hybrid.lexicalWeight`
  - `rerank.enabled`
- retrieval no-hit behavior is now stricter:
  - if vector retrieval is unavailable, the backend still falls back to lexical scoring
  - but when all candidates still miss the configured retrieval threshold, the backend now returns an empty retrieval result instead of injecting arbitrary first chunks from the knowledge base
  - this keeps `insufficient_context` handling aligned with real retrieval evidence
- Chunk-window context grouping for ask responses:
  - `retrievedChunks` remains unchanged for compatibility
  - `contextGroups` adds contiguous same-document merged context segments
- Query rewrite before retrieval, with LLM-first and local fallback behavior
- Answer and rewrite prompt construction is now managed by backend `PromptManagerService`
  - current prompt ids: `answer.v2`, `rewrite-query.v1`
- Minimal ask flow with conversation/message/trace persistence
- Citation-aware answer prompting with inline source markers
- Structured answer metadata with `answerStatus` / `missingInformation`
- Structured answer quality evaluation with:
  - `overall`: `strong` / `partial` / `weak`
  - `grounding`: `grounded` / `partially_grounded` / `ungrounded`
  - `completeness`: `complete` / `partial` / `insufficient`
  - `flags`: backend-generated warning tags
  - `summary`: deterministic backend explanation
- Structured answer JSON is now schema-validated and normalized before backend consumption
  - constrained fields: `answer`, `status`, `citations`, `missingInformation`
- Citation snippets now prefer structured `citationEvidence` quotes after backend source-local validation, with deterministic fallback snippets when validation fails
- Trace persistence now includes `qualityEvaluationJson`
- Assistant-level `answerPolicyJson` validation and ask-time policy application
  - richer answer-policy prompt controls for tone, output format, and answer language
  - deterministic backend handling for:
    - `citationMode=optional` -> do not fabricate fallback citations when the model provides none
    - `includeMissingInformation=false` -> clear advisory `missingInformation` in final output
- Assistant page config management now includes:
  - full assistant answer-policy editing
  - retrieval profile metadata filter editing
  - clearing persisted retrieval filters through the same page
- Ollama-backed local generation when `OLLAMA_BASE_URL` and `OLLAMA_MODEL` are configured
- OpenAI-backed generation when `OPENAI_API_KEY` is configured
- Local fallback answering when no model provider is configured
- Mantine-based web UI for the main MVP pages
- Lightweight frontend i18n with Chinese/English language switching

## Known limitations

- First-version vector store is file-backed and intended for local development
- Retrieval still falls back to lexical scoring when embeddings/vector lookup fail
- Startup currently uses a lightweight local env loader instead of Nest `ConfigModule`
- Current PDF support is limited to text-based PDFs
- Current automated coverage includes one real HTTP integration flow, but still not full E2E
- Assistant/config editing is now richer, but still limited to the current single Assistant page and does not yet expose `strategyJson`
- Web i18n currently uses a local in-repo dictionary and does not yet include ICU-style pluralization
- Trace score breakdown is persisted, but the current trace UI still mainly exposes raw payload plus final score
