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

If this is a fresh checkout, copy the example env first:

```bash
cp .env.example .env
```

For clean-checkout or CI-like validation, explicitly generate the Prisma client before API build/typecheck:

```bash
pnpm --filter @rag-system/api prisma:generate
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
pnpm --filter @rag-system/api start:prod
```

This expects the local PostgreSQL and Redis stack to be running.

Health check:

```bash
curl http://localhost:3000/health
```

The API will use Ollama automatically when these environment values are present:

```text
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBEDDING_MODEL=qwen2.5:7b
OLLAMA_EMBEDDING_DIMENSIONS=1536
```

Notes:

- The current API startup path now loads `.env` from the repo root and `apps/api/.env`.
- In the current local environment, `qwen2.5:7b` has been verified to respond to both `/api/generate` and `/api/embed`.
- If you later switch to a dedicated embedding model, only `OLLAMA_EMBEDDING_MODEL` needs to change.
- `OLLAMA_EMBEDDING_DIMENSIONS` is optional and acts as a strict guardrail: when set, the backend rejects Ollama embedding responses whose vector length does not match the configured dimension.
- `OLLAMA_EMBEDDING_DIMENSIONS` now also requires Ollama embedding provider config (`OLLAMA_BASE_URL` + `OLLAMA_EMBEDDING_MODEL` or `OLLAMA_MODEL`); setting it alone now fails fast at startup/config resolution instead of being silently ignored.
- external source fetch runtime now also supports:

```text
SOURCE_FETCH_TIMEOUT_MS=10000
SOURCE_FETCH_RETRY_ATTEMPTS=2
```

- current defaults preserve the existing behavior: `10s` timeout and `2` total fetch attempts for `web page` / `feed` / `sitemap` source HTTP requests
- LLM runtime now also supports a small set of explicit operational overrides:

```text
OPENAI_BASE_URL=https://api.openai.com/v1
LLM_ANSWER_TEMPERATURE=0.2
LLM_REWRITE_TEMPERATURE=0
```

- `OPENAI_CHAT_MODEL` still defaults to `gpt-4.1-mini`
- `OPENAI_BASE_URL` now also applies to the OpenAI embedding path (`<OPENAI_BASE_URL>/embeddings`), so chat/rewrite and embedding calls stay aligned when using a proxy or compatible endpoint
- `LLM_ANSWER_TEMPERATURE` currently applies to both Ollama and OpenAI answer generation
- `LLM_REWRITE_TEMPERATURE` currently applies to both Ollama and OpenAI query-rewrite calls
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
  - for `POST /assistants/:id/ask`, when retrieval returns no chunks and `noAnswerBehavior=say_insufficient_context`, the backend now bypasses answer generation and returns that deterministic reply directly
  - that one-shot bypass now also applies when the assistant leaves `answerPolicyJson` unset, because the backend default `noAnswerBehavior` is normalized before the no-hit branch check
  - that one-shot deterministic no-hit path now reuses the same centralized insufficient-context result shaping, so `missingInformation` and weak quality summaries stay aligned with the localized fallback answer text
  - for `POST /assistants/:id/ask/stream`, when retrieval returns no chunks and `noAnswerBehavior=say_insufficient_context`, the backend now bypasses provider streaming and emits that same deterministic reply directly
  - that stream deterministic no-hit path now also bypasses streamed final-answer normalization and reuses the same centralized insufficient-context result shaping for the final payload
  - `best_effort`: the backend preserves the model's returned answer text even when the final answer status is `insufficient_context`
  - that `best_effort` behavior is now explicitly covered at the ask-service orchestration layer too: one-shot no-hit requests still go through answer generation, and stream no-hit requests still go through streamed generation/finalization instead of reusing the deterministic insufficient-context bypass
  - the local `LlmService` no-model fallback for zero-hit answers now follows the same minimal `en` / `zh` language resolution instead of always returning English
  - that same zero-hit local fallback path now also localizes its deterministic `missingInformation` reason for `en` / `zh`
  - the native stream fallback path for zero-hit `say_insufficient_context` answers now emits that same deterministic insufficient-context reply, so streamed deltas and final payload stay aligned
  - the local `LlmService` grounded fallback for hitful answers now also follows that same minimal `en` / `zh` language resolution instead of using an English-only prefix
- current backend enforcement for `includeMissingInformation`:
  - for grounded answers, `includeMissingInformation=false` still clears advisory gap items from the final response
  - for `insufficient_context` answers, the backend now always preserves `missingInformation`, and fills a deterministic default reason when the model omits one
  - that deterministic default `missingInformation` reason now also follows the same minimal `en` / `zh` language resolution used by the backend fallback answer text
  - the default reason now also distinguishes between `no_retrieval_hits` and `retrieved context was still insufficient`, instead of always implying that retrieval returned nothing
  - both branches of that default reason are now covered for minimal `en` / `zh` localization
  - structured-answer normalization now also trims and de-duplicates `missingInformation` entries while preserving first-seen order
- current answering metadata semantics:
  - `answeringMetadata.usedFallback` now explicitly records whether answer generation resolved through local fallback behavior instead of a provider-backed model path
  - the field is present for both one-shot ask responses and native streaming final payload / trace persistence
- current ask response metadata semantics:
  - `AskResponse.strategySummary` now exposes the same additive resolved retrieval strategy summary used by trace/read-model surfaces
  - the ask response still keeps `retrievalMetadata` and `answeringMetadata` for lower-level inspection, but the top-level summary makes the resolved retrieval provenance easier to read
- current trace read semantics:
  - `GET /traces/:id` and `GET /conversations/:id/traces` now also return additive `traceSummary`
  - `traceSummary` is derived from persisted trace JSON rather than stored separately
  - current `traceSummary` fields are (same order as `TraceSummary` in `packages/shared/src/trace-contracts.ts`):
    - `promptId`
    - `answerStatus`
    - `qualityOverall`
    - `primaryIssue`
    - `retrievalMode`
    - `retrievalQuerySource`
    - `strategyReadabilityLabel` (one-line retrieval/fallback summary)
    - `rewriteReadabilityLabel` (one-line rewrite execution summary)
    - `strategySummary`
      - `retrievalMode`
      - `strategyMode`
      - `retrievalQuerySource`
      - `rewriteEnabled`
      - `rewriteApplied`
      - `rewriteUsedFallback`
      - `rewritePromptId`
      - `rewriteModelName`
      - `fallbackReason`
      - `usedFallback`
    - `generationMode`
    - `contextMode`
    - `rewriteApplied`
    - `fallbackReason`
    - `resolvedLanguage`
    - `answerAttributionSummary`
      - `attribution`
      - `source`
      - `readability`
      - `attributionLabel`
      - `sourceLabel`
      - `readabilityLabel`
      - `readabilityHint`
      - `readabilityResolvedLabel`
      - `readabilitySentence`
    - `answerAttribution`
    - `answerAttributionSource`
    - `answerEvidenceSource` (same source value as `citationSelectionSource`)
    - `answerEvidenceSourceReadabilityLabel` (`<kind> evidence source` readability label)
    - `answerEvidenceSourceReadabilitySentence` (one-line evidence-source provenance sentence)
    - `citationAttribution`
    - `citationSelectionSource`
    - `missingInformationCount`
    - `missingInformationCountReadabilityLabel` (count readability label)
    - `missingInformationSource`
    - `insufficientContextReason`
    - `missingInformationProvenanceSentence` (one-line missing-information provenance)
    - `answerTextSource`
    - `answerTextSourceReadabilityLabel` (answer text source readability label)
    - `answerTextSourceReadabilitySentence` (one-line answer text source provenance)
    - `answerStatusSource`
    - `answerStatusSourceReadabilityLabel` (answer status source readability label)
    - `answerStatusSourceReadabilitySentence` (one-line answer status source provenance)
    - `answerProvenanceReadabilitySentence` (one-line answer provenance with readability labels)
    - `answerProvenanceSentence` (one-line answer provenance)
    - `failedStage`
    - `failedStageReadabilityLabel` (failed-stage readability label)
    - `failureMessage`
    - `failureReadabilitySentence` (one-line failed-stage + message readability summary)
    - `candidateLimit`
    - `vectorCandidateCount`
    - `lexicalCandidateCount`
    - `mergedCandidateCount`
    - `rankedCandidateCount`
    - `candidateCountReadabilityLabel` (candidate-flow count readability label)
    - `candidateCountReadabilitySentence` (one-line candidate-flow readability sentence)
    - `vectorCandidateLimitHit`
    - `lexicalCandidateLimitHit`
    - `rankingTopKHit`
    - `primaryChunkCount`
    - `neighborChunkCount`
    - `retrievedChunkCount`
    - `inputChunkCount`
    - `promptContextCount`
    - `contextGroupCount`
    - `citationCount`
    - `citationCountReadabilityLabel` (citation count readability label)
    - `citationCountBeforeLimit`
    - `citationLimitHit`
    - `usedFallback`
  - current `traceSummary.retrievalQuerySource` values are:
    - `rewritten`
    - `original_disabled`
    - `original_unchanged`
  - current `traceSummary.strategySummary.strategyMode` / `traceSummary.retrievalMode` values are:
    - `vector`
    - `hybrid`
    - `lexical`
  - current `traceSummary.fallbackReason` values are:
    - `vector_error`
    - `no_ranked_candidates`
  - current `traceSummary.answerStatus` values are:
    - `grounded`
    - `insufficient_context`
  - current `traceSummary.qualityOverall` values are:
    - `strong`
    - `partial`
    - `weak`
  - current `traceSummary.primaryIssue` values are:
    - `none`
    - `no_retrieval_hits`
    - `insufficient_context`
    - `missing_information`
    - `low_retrieval_score`
    - `fallback_generation`
    - `other`
  - current `traceSummary.generationMode` values are:
    - `generated`
    - `deterministic_bypass`
  - current `traceSummary.contextMode` values are:
    - `chunks`
    - `context_groups`
  - current `traceSummary.resolvedLanguage` values are:
    - `zh`
    - `en`
  - current `traceSummary.answerAttribution` / `traceSummary.citationAttribution` values are:
    - `explicit`
    - `heuristic`
    - `none`
  - current `traceSummary.answerAttributionSource` / `traceSummary.citationSelectionSource` / `traceSummary.answerEvidenceSource` values are:
    - `structured`
    - `inline_markers`
    - `heuristic`
    - `none`
  - current `traceSummary.answerTextSource` values are:
    - `model`
    - `deterministic_policy`
  - current `traceSummary.answerStatusSource` values are:
    - `model`
    - `inferred_from_retrieval`
    - `deterministic_policy`
  - current `traceSummary.missingInformationSource` values are:
    - `none`
    - `model`
    - `deterministic_default`
    - `suppressed_by_policy`
  - current `traceSummary.insufficientContextReason` values are:
    - `no_retrieval_hits`
    - `retrieved_context_insufficient`
  - current `traceSummary.failedStage` values are:
    - `retrieval`
    - `answering`
  - current `traceSummary` readability field examples (derived from `apps/api/src/modules/traces/traces.service.ts`):
    - `strategyReadabilityLabel` example:
      - `hybrid retrieval via rewritten; fallback: none; fallback used: no.`
    - `rewriteReadabilityLabel` example:
      - `rewrite enabled; rewrite applied: yes; rewrite fallback: no; rewrite prompt: rewrite-query.v1.`
    - `answerAttributionSummary.readability` example values:
      - `explicit:structured`
      - `heuristic:inline_markers`
      - `none:none`
    - `answerAttributionSummary.readabilitySentence` example:
      - `Answer attribution is explicit; source evidence is structured.`
    - `answerProvenanceSentence` example:
      - `Answer text source is model; status source is model; attribution summary is explicit attribution via structured evidence source.`
    - `missingInformationProvenanceSentence` example:
      - `Missing-information source is model; insufficient-context reason is none; missing-information count is 0.`
  - retrieval-stage ask failures now also create a failed trace before the pipeline aborts
  - that failed trace carries minimal retrieval failure metadata so `traceSummary.failedStage` and `traceSummary.failureMessage` remain available even when retrieval fails before any chunks are returned
- current quality-evaluation semantics:
  - `qualityEvaluation.primaryIssue` now exposes a deterministic primary quality driver (`none`, `no_retrieval_hits`, `insufficient_context`, `missing_information`, `low_retrieval_score`, `fallback_generation`, `other`) alongside the existing flags array
  - when `citationMode=optional`, grounded answers without citations no longer receive an automatic `no_citations` penalty
  - in that optional-citation path, quality evaluation can remain `strong` when no other gaps or retrieval-quality issues are present
  - deterministic `qualityEvaluation.summary` now also follows the same minimal `en` / `zh` language resolution used by the backend fallback answer text
  - the strong-summary wording now distinguishes among:
    - answers grounded in explicit cited sources
    - answers grounded in retrieved sources without citations
    - answers where required citations were only heuristically backfilled by the backend rather than explicitly supplied by the model
  - that heuristic-citation strong-summary branch now has its own explicit `en` / `zh` wording instead of collapsing back to the generic retrieved-source summary
  - partial summaries now also combine `missing_information` + `low_retrieval_score` into a dual-cause explanation instead of dropping the retrieval-confidence warning
  - that dual-cause partial summary is now also covered for the minimal `zh` branch
  - low retrieval confidence (`low_retrieval_score`) now degrades `qualityEvaluation.overall` to `partial` and yields a retrieval-confidence-specific summary instead of remaining `strong`
  - weak insufficient-context summaries now distinguish between `no_retrieval_hits` and cases where retrieval produced context but the retrieved evidence was still insufficient
  - when a weak insufficient-context answer also carries `low_retrieval_score`, the summary now explicitly mentions the low retrieval confidence instead of dropping that signal
  - that weak low-confidence insufficient-context summary is now also covered for the minimal `zh` branch
  - the same minimal `zh` coverage now also exists for the weak insufficient-context path where retrieval produced context, `missingInformation` is present, and retrieval confidence was low
  - grounded answers produced through local fallback generation now also degrade `qualityEvaluation.overall` to `partial`, expose `primaryIssue: fallback_generation`, and carry a fallback-specific summary instead of remaining `strong`
  - when grounded fallback-generated answers also carry `low_retrieval_score`, `primaryIssue` now stays anchored on `fallback_generation` while the summary still mentions both signals
  - that same `primaryIssue` anchoring now also applies when grounded fallback-generated answers still report `missingInformation`
- `PATCH /retrieval-profiles/:id` now accepts:
  - richer `filtersJson` operators:
    - `documentIds.include` / `documentIds.exclude`
    - `sectionTitles.include` / `sectionTitles.exclude` / `sectionTitles.contains`
    - `pageNumbers.include` / `pageNumbers.exclude` / `pageNumbers.min` / `pageNumbers.max`
  - `filtersJson: null` to clear saved retrieval metadata filters
  - `strategyJson: null` to clear a previously saved retrieval strategy override and fall back to the legacy flat-field-derived defaults
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
- current local execution preference is to keep heavy validation tasks serial
- small focused tests and static checks may run in parallel when they do not start the full API, worker, or real integration stack
- for browser-based verification or smoke checks, prefer the host-installed Edge/Chrome on this machine first; both are already available locally
- browser download or install steps are fallback-only, not the default first action for local browser testing
- current workspace split preference:
  - main repository checkout: non-pure-frontend work (backend, frontend/backend integration, docs, orchestration)
  - `apps/web` worktree: pure frontend development
  - `apps/api` worktree: currently optional / mostly unused
  - workspace-local OpenCode or plugin state is not shared automatically across these checkouts

### Preflight for longer runs

Before long validation or browser-heavy work, do a quick readiness pass:

- confirm PostgreSQL and Redis are up and reachable
- sanity-check API startup and the health endpoint before deeper validation
- confirm a usable browser is already available locally; prefer host-installed Edge/Chrome first
- watch for contamination from older API workers, queue jobs, or stale services left over from previous runs
- prefer a fresh build when the change touches startup, persistence, or any path that could be affected by stale `dist` output

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

Faster day-to-day API test entrypoint:

```bash
pnpm test:api:fast
```

The fast API lane now runs on `Vitest`, while integration and E2E lanes stay on the current Node test runner plus `dist` startup path.

Current fast-lane test support helpers also include:

- `apps/api/test/support/llm-test-helpers.js` for `LlmService` / prompt-manager / env / fetch test scaffolding
- `apps/api/test/support/ask-assistant-test-helpers.js` for `AskAssistantService` dependency defaults, assistant-record scaffolding, and reusable answer-policy defaults
- the current helper-backed ask-path callers are:
  - `apps/api/test/ask-success.test.js`
  - `apps/api/test/ask-stream-service.test.js`
  - `apps/api/test/ask-failures.test.js`
  - `apps/api/test/ask-stream-retrieval-failure.test.js`
- `ask-success.test.js` and `ask-stream-service.test.js` now also reuse the helper-backed outer `AskAssistantService` service scaffolding across their remaining localized summary cases, so ad-hoc `new AskAssistantService(...)` setup has been cleared from those two fast-lane files

Focused fast API theme entrypoints:

```bash
pnpm test:api:fast:llm
pnpm test:api:fast:retrieval
pnpm test:api:fast:assistants
pnpm test:api:fast:documents
pnpm test:api:fast:infra
```

High-frequency combined API entrypoints:

```bash
pnpm test:api:focus:ask
pnpm test:api:focus:llm-retrieval
pnpm test:api:focus:documents
pnpm test:api:focus:sources
pnpm test:api:focus:api-config
```

Single-file API test entrypoint:

```bash
pnpm test:api:file -- test/prompt-manager.test.js
pnpm test:api:file -- apps/api/test/prompt-manager.test.js
```

`test:api:file` now auto-selects `Vitest` for fast-lane files and keeps the current build-aware runner for heavier integration or E2E files.

Focused API integration entrypoint:

```bash
pnpm test:api:integration
```

Current heavy API lanes now run an on-demand build check first and only rebuild when `src/`, `prisma/`, or key API config files are newer than the built API entry (`dist/apps/api/src/main.js`, with `dist/main.js` as legacy fallback).

Current integration and E2E files also seed default records once per file and then reset mutable test state between individual tests.

Focused API chain E2E entrypoint:

```bash
pnpm test:api:e2e:chains
```

Focused API source E2E entrypoint:

```bash
pnpm test:api:e2e:sources
```

Focused API closeout / heavier E2E entrypoint:

```bash
pnpm test:api:e2e
```

Recommended API test entrypoints by change type:

- prompt / llm / answer parsing / stream shaping:
  - `pnpm test:api:fast:llm`
- retrieval ranking / filters / answer quality shaping:
  - `pnpm test:api:fast:retrieval`
- ask orchestration / assistant ask or stream behavior:
  - `pnpm test:api:fast:assistants`
- ask orchestration plus retrieval behavior together:
  - `pnpm test:api:focus:ask`
- prompt / llm changes that also affect retrieval shaping:
  - `pnpm test:api:focus:llm-retrieval`
- parsing / chunking / ingestion / document run summary / external source sync helpers:
  - `pnpm test:api:fast:documents`
- document-chain backend work with shared infra helpers:
  - `pnpm test:api:focus:documents`
- shared infra utilities and lightweight backend plumbing:
  - `pnpm test:api:fast:infra`
- one touched test file only:
  - `pnpm test:api:file -- test/<name>.test.js`
- assistant API patch / retrieval-profile API behavior:
  - `pnpm test:api:integration`
- assistant API config work plus ask-path regression coverage:
  - `pnpm test:api:focus:api-config`
- document / ask main flow closeout:
  - `pnpm test:api:e2e:chains`
- external source closeout:
  - `pnpm test:api:e2e:sources`
- source backend changes with both local helpers and source E2E:
  - `pnpm test:api:focus:sources`
- cross-module backend closeout:
  - `pnpm test:api`

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

Focused assistant strategy UI validation:

```bash
node --experimental-strip-types --test apps/web/test/assistant-config.test.js
node --test apps/web/test/assistant-strategy-source.test.js
```

Focused PC Web smoke validation:

```bash
pnpm --filter @rag-system/api build
pnpm --filter @rag-system/web build
node --test apps/web/test/pc-web-smoke.test.js
```

## Local development rhythm

For day-to-day backend work in the current repository, prefer a lighter feedback loop instead of rerunning the full API suite after every small edit.

- default local development path:
  - implement one small but complete increment first
  - then run `typecheck` plus only the 1..3 most relevant focused tests
- use stricter TDD mainly for:
  - pure logic
  - schema normalization
  - ranking / metadata / utility behavior
- for service orchestration, controller wiring, queue flow, Prisma persistence, and streaming paths:
  - allow block-wise implementation first
  - then add or adjust focused tests for the changed path
- treat heavier integration / E2E coverage as closeout validation, not the default inner-loop step
- reserve full-suite validation such as `pnpm test:api` for:
  - end-of-increment verification
  - cross-module backend changes
  - pre-commit or pre-push closeout

Notes:

- run at most one heavy validation task at a time in the current workstation environment
- heavy tasks include repository build, `pnpm test:api`, API integration / E2E flows, or any validation that starts the real API, worker, Prisma, Redis, or indexing chain
- small focused tests and static checks may run in parallel when they stay within a light local feedback loop
- do not run multiple heavy builds or node test processes at the same time
- do not overlap heavy validation with AI review
- `pnpm opencode:loop` runs the repo-local development harness in `scripts/opencode-loop.md`; `scripts/opencode-loop/jsonc.mjs` keeps `opencode.jsonc` comment-safe; `node scripts/opencode-loop.mjs --self-test` covers draining, resume recovery, and one guarded refill pass.
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
- external source HTTP fetches now share a small retry guard: one automatic retry for transient `408` / `429` / `5xx` upstream responses before surfacing the failure
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
  - `issueOnly`
  - `sinceHours`
  - `includeDiagnostics`
  - `limit` (default `20`, max `100`)
- `issueOnly=true` currently narrows the run list to completed runs that still represent actionable issues under the existing summary semantics:
  - terminal `failed` runs
  - `ready` runs carrying a partial `failureSummary`
  - it excludes `skipped` runs
  - it also excludes `pending` / `processing` runs that may temporarily preserve diagnostics while still in flight
- the run summary endpoint also supports `sinceHours` so recent-run diagnostics can be scoped to a smaller time window
- `GET /knowledge-bases/:id/document-runs/summary` now also accepts the same narrow observability filters as the run list for summary scoping:
  - `documentId`
  - `sourceType`
  - `status`
  - `trigger`
  - `issueOnly`
  - `sinceHours`
- `document-runs` list now defaults to a lighter payload and only includes `diagnosticsJson` when `includeDiagnostics=true`
- `document-runs` list now also includes a lightweight `failureSummary` so recent-run consumers can show minimal failure context without requesting full diagnostics:
  - `code`
  - `failedStage`
  - `retryable`
  - `message`
- current web API types are now aligned to expose that same `failureSummary` shape on:
  - `GET /documents/:id/runs`
  - `GET /knowledge-bases/:id/document-runs`
  - `GET /knowledge-bases/:id/document-runs/summary` latest anchors
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
  - `boundaryStats`
  - `latestRetryableFailure`
  - `latestPartialSourceFailure`
  - `latestSkipped`
  - `latestFailure`
  - `latestBoundaryHit`
- `latestRetryableFailure` / `latestSkipped` / `latestFailure` now also expose the same lightweight `failureSummary` shape used by the run list:
  - `code`
  - `failedStage`
  - `retryable`
  - `message`
- `latestBoundaryHit` now also exposes a lightweight `boundarySummary` when available:
  - `reasons`
  - `droppedPageUrlCount`
  - `droppedChildSitemapCount`
  - `droppedFeedEntryCount`
- `boundaryStats` currently aggregates bounded source truncation signals across matched runs:
  - `runsWithBoundaryHit`
  - `byReason`
  - `droppedPageUrlCount`
  - `droppedChildSitemapCount`
  - `droppedFeedEntryCount`
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
2. Start API with `pnpm --filter @rag-system/api start:prod`.
3. Upload a markdown, DOCX, or PDF document to `default-kb`.
4. Wait for the document to reach `ready`.
5. Confirm vectors are written to `storage/vectors/default-kb.json`.
6. Ask `default-assistant` a question and confirm:
   - answer is returned
   - `answerStatus` is `grounded` or `insufficient_context`
   - `missingInformation` is returned as an array
   - `qualityEvaluation` is returned with `overall`, `grounding`, `completeness`, `flags`, and `summary`
   - `retrievalMetadata` is returned with resolved strategy, rewrite execution, and retrieval execution summary, including final query source, actual mode, attempted search paths, fallback reason, rerank application, chunk-window application, candidate flow, candidate-budget saturation signals, and neighbor expansion counts
   - `answeringMetadata` is returned with prompt id, normalized answer policy, resolved language, generation mode, context mode, prompt-context count, citation counts before/after truncation, citation attribution/source, missing-information count/source, answer-text source, answer-status source, and insufficient-context reason
   - citations are returned
   - citation `snippet` prefers a validated verbatim quote from the cited source when the model provides one
  - `contextGroups` is returned as an array
  - contiguous same-document chunks may be merged into one `contextGroup.mergedContent`
  - current `contextGroups` item shape includes:
    - `documentId`
    - `documentTitle`
    - `startChunkIndex`
    - `endChunkIndex`
    - `chunkIds`
    - `primaryChunkIds`
    - `mergedContent`
    - `pageNumbers`
    - `sectionTitles`
  - answer may include inline source markers like `[1]`
   - `retrievedChunks` include vector similarity scores
   - trace may contain `rewrittenQuery`
   - trace `retrievalScoresJson` may contain `vectorScore`, `lexicalScore`, `hybridScore`, and `rerankScore`
   - trace `retrievalMetadataJson` records the effective retrieval strategy, filters, rewrite execution, and retrieval summary, including final query source and attempted search paths
   - trace `answeringMetadataJson` records the effective answer prompt id and normalized answer-policy execution, including citation provenance, citation truncation, missing-information provenance, answer-text source, answer-status source, and insufficient-context reason
   - trace persistence is successful

## Current implementation scope

Boundary note for contributors (implementation decision aid):

- **Core:** orchestration pipeline semantics, ask/trace read-model contract outputs, fallback behavior, and regression assertions.
- **Replaceable layers:** LLM/embedding providers, vector backend, chunking/parsing implementation, external source adapters, and eval/diagnostic tooling.
- If a change only swaps a replaceable layer, keep it additive and behavior-preserving for core contracts (`ask` payload shape, `traceSummary` readability/semantics, fallback outcomes).

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
- ask / trace retrieval metadata `execution` now also exposes:
  - `actualMode`: the actual retrieval path used for the final result (`vector` / `hybrid` / `lexical`)
  - `usedFallback`: whether the backend had to fall back away from the requested vector path
  - `candidateLimit`: the resolved retrieval candidate budget after candidate-selection strategy expansion
  - `vectorCandidateCount` / `lexicalCandidateCount`: how many vector and lexical candidates were produced before merge
  - `mergedCandidateCount`: how many candidates remained after hybrid merge or lexical fallback resolution
  - `rankedCandidateCount`: how many candidates survived thresholding and ranking before chunk-window expansion
  - `neighborChunkCount`: how many returned chunks were added by chunk-window expansion rather than selected as direct primary hits
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
- when structured citations are absent and the backend falls back to inline answer markers like `[1]`, repeated markers for the same source are now de-duplicated before final citation expansion
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
- Assistant/config editing is now richer, and the current single Assistant page now also exposes `strategyJson` override editing for retrieval strategy tuning
- Web i18n currently uses a local in-repo dictionary and does not yet include ICU-style pluralization
- Trace score breakdown is persisted, but the current trace UI still mainly exposes raw payload plus final score
