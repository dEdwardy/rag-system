# Current Dev Setup

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
- mobile adaptation is intentionally deferred until the core feature surface and validation coverage are more mature

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

Focused PC Web smoke validation:

```bash
pnpm --filter @rag-system/api build
pnpm --filter @rag-system/web build
node --test apps/web/test/pc-web-smoke.test.js
```

Notes:

- this smoke test is currently scoped to `PC Web`
- it validates `Knowledge Base -> Assistant` browser rendering against the real local API
- it is intentionally smaller than the later full document-flow and ask-flow browser E2E tasks

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
   - citations are returned
   - citation `snippet` prefers a validated verbatim quote from the cited source when the model provides one
   - `contextGroups` is returned as an array
   - contiguous same-document chunks may be merged into one `contextGroup.mergedContent`
   - answer may include inline source markers like `[1]`
   - `retrievedChunks` include vector similarity scores
   - trace may contain `rewrittenQuery`
   - trace `retrievalScoresJson` may contain `vectorScore`, `lexicalScore`, `hybridScore`, and `rerankScore`
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
