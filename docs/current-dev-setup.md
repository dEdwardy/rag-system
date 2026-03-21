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
  - `responseStyle`: `concise` or `detailed`
  - `citationMode`: `required` or `optional`
  - `maxCitations`: `1..8`
  - `noAnswerBehavior`: `say_insufficient_context` or `best_effort`
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

## Current working flow

1. Open the web app.
2. Upload a `.md`, `.txt`, `.docx`, or text-based `.pdf` document in `Documents`.
3. Wait until the document becomes `ready`.
4. Open document details to inspect status, metadata, and generated chunks.
5. Ask questions in `Chat`.
6. Inspect citations and open trace details.
7. Jump from citations to linked document chunks.
8. Edit assistant and retrieval configuration in `Assistant`.

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
   - citations are returned
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
- Query rewrite before retrieval, with LLM-first and local fallback behavior
- Minimal ask flow with conversation/message/trace persistence
- Citation-aware answer prompting with inline source markers
- Structured answer metadata with `answerStatus` / `missingInformation`
- Assistant-level `answerPolicyJson` validation and ask-time policy application
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
- Assistant/config editing is available, but still basic
- Web i18n currently uses a local in-repo dictionary and does not yet include ICU-style pluralization
- Trace score breakdown is persisted, but the current trace UI still mainly exposes raw payload plus final score
