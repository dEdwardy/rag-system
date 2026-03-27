# RAG System

A local-first RAG system monorepo with an API service, a web app, and shared package code.

The current repository already includes a working MVP flow for document upload, ingestion, chunking, embedding, retrieval, answering, citations, and trace persistence.

## Project Structure

- `apps/api`: NestJS API, ingestion pipeline, retrieval, answering, persistence
- `apps/web`: React web app for chat, documents, knowledge base, and assistant settings
- `packages/shared`: shared types and common code
- `docs`: setup notes, progress snapshots, architecture notes, and implementation references
- `storage`: local runtime storage such as file-backed vectors

## Quick Start

### 1. Start local infrastructure

```bash
docker compose up -d
```

This starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

More detail: [docs/local-dev-infra.md](docs/local-dev-infra.md)

### 2. Install dependencies

```bash
pnpm install
```

### 3. Apply database migrations

```bash
pnpm --filter @rag-system/api exec prisma migrate dev
```

### 4. Seed default records

```bash
node apps/api/prisma/seed.js
```

### 5. Start the API

```bash
pnpm --filter @rag-system/api build
node apps/api/dist/main.js
```

Health check:

```bash
curl http://localhost:3000/health
```

### 6. Start the web app

```bash
pnpm --filter @rag-system/web dev
```

Default local web URL: `http://localhost:5173`

### 7. Nightly loop helper

```bash
pnpm loop:start
pnpm loop:status
pnpm loop:stop
```

These commands wrap `scripts/opencode-loop/control.sh`, auto-link the `systemd --user` units, and manage the loop setup for unattended night runs.

If you run frontend and backend OpenCode sessions in parallel, prefer separate Git worktrees so each session has its own checkout and local config.

## Common Commands

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test:api:fast
pnpm test:api
```

For day-to-day backend work, prefer focused API test entrypoints such as `pnpm test:api:fast`, `pnpm test:api:file -- test/<name>.test.js`, or the themed commands documented in [docs/current-dev-setup.md](docs/current-dev-setup.md). Reserve full `pnpm test:api` runs for broader closeout verification.

## Key Docs

- [Docs guide](docs/README.md)
- [Next steps plan](docs/next_steps_rag_project_plan.md)
- [Current dev setup](docs/current-dev-setup.md)
- [Current progress](docs/current-progress.md)
- [Local dev infra](docs/local-dev-infra.md)
- [Phase 1 RAG blueprint](docs/phase-1-rag-blueprint.md)
- [Retrieval trace notes](docs/retrieval-trace.md)
- [Web i18n notes](docs/web-i18n.md)

## Current Scope

The current codebase supports:

- document upload and async ingestion
- chunking for Markdown, TXT, DOCX, and text-based PDF files
- embedding generation with Ollama or OpenAI paths plus local fallback behavior
- file-backed vector retrieval with lexical fallback
- ask flow with citations, conversations, messages, and traces
- a web MVP for chat, documents, knowledge base, and assistant configuration

## Notes

- The project is still in active development.
- The most accurate local run and validation notes are in [docs/current-dev-setup.md](docs/current-dev-setup.md).
- The broader implementation snapshot is in [docs/current-progress.md](docs/current-progress.md).
