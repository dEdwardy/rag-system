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

### 3. Create local env file

```bash
cp .env.example .env
```

### 4. Apply database migrations

```bash
pnpm --filter @rag-system/api exec prisma migrate dev
```

### 5. Seed default records

```bash
node apps/api/prisma/seed.js
```

### 6. Start the API

```bash
pnpm --filter @rag-system/api build
pnpm --filter @rag-system/api start:prod
```

Health check:

```bash
curl http://localhost:3000/health
```

The API expects PostgreSQL and Redis from the local dev stack to be available before startup.

### 7. Start the web app

```bash
pnpm --filter @rag-system/web dev
```

Default local web URL: `http://localhost:5173`

## Production Container

The production deployment uses a single container that bundles:

- the built `apps/web` static assets
- the built `apps/api` Nest application
- Nginx serving the web app and proxying `/api/*` to the API on `127.0.0.1:3000`

Production runtime env is currently sourced from `apps/api/.env`.

The current production build is configured for a subpath deployment at `/ragora`, so the public app URL is expected to be `https://<your-domain>/ragora/` and the OAuth callback path is expected to be `https://<your-domain>/ragora/api/auth/oauth/github/callback`.

Start the production container from the repository root:

```bash
docker compose up -d --build
```

The app is exposed on `http://localhost:8080` by default.

Notes:

- `docker-compose.yml` is now scoped to the app container only; PostgreSQL, queue runtime, storage, and vector store are expected to use the external Supabase-backed production configuration from `apps/api/.env`
- the API validates critical env from the container process environment at startup, so production deployment should inject env into the container instead of relying on a root-level `.env`
- if you change production secrets or provider settings, update `apps/api/.env` before rebuilding/restarting the container

## GitHub Actions Deploy

The repository now includes GitHub Actions workflows for CI plus manual production deployment:

- `ci.yml`: install, build, typecheck, and fast API validation
- `docker-image.yml`: optional workflow that builds the production image and pushes it to `ghcr.io/<owner>/<repo>`
- `deploy.yml`: manual deployment that SSHes to the server, checks out the requested `branch/tag/commit`, and runs `docker compose up -d app`
- `rollback.yml`: manual rollback that SSHes to the server, checks out the requested stable `tag/commit`, and restarts the app from the prepared image

Server-side deployment assumptions:

- the server already has Docker and Docker Compose installed
- the repository is already checked out on the server at a stable path
- production env stays on the server, for example `apps/api/.env.production`
- the server runs `docker compose` from the repository root

Required GitHub secrets for `deploy.yml`:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `SSH_PORT` (optional; defaults to `22`)
- `DEPLOY_PATH`: absolute repository path on the server, such as `/home/deploy/rag-system`

Keep the required deploy secrets in repository-level GitHub Actions secrets for the simplest setup.

Recommended personal-project release pattern:

- tag each stable release before production deploy
- use `deploy.yml` with `target_ref=master` for normal releases
- use `rollback.yml` with a stable tag or commit when rollback is needed

The compose file still accepts an optional `APP_IMAGE` override for the GHCR-based path; for the simplest fallback path you can also preload `rag-system:latest` on the server with `docker load` and let `docker compose up -d app` start it directly.

### 7. Optional OpenCode harness

```bash
pnpm loop:start
pnpm loop:status
pnpm loop:stop
```

These scripts now use the repo-local Node harness under `.opencode/loop/harness/`, and the runner consumes the active materialized queue sequentially. It is intended to work on both Windows and WSL/Linux shells. The runner reuses one OpenCode session across a compact wave when possible to reduce repeated context cost, invokes the repo's `build` command for queue items, applies a per-item timeout guard (`OPENCODE_LOOP_ITEM_TIMEOUT_MS`, default `20m`), and each spawned session title includes the current task index and remaining task count, for example `[1/4 | left 3] p4-consolidate-documents-surface-copy-and-empty-states`.

If you run frontend and backend OpenCode sessions in parallel, prefer separate Git worktrees so each session has its own checkout and local config. Current working split: main checkout for non-pure-frontend work (backend, frontend/backend integration, docs/orchestration), `apps/web` worktree for pure frontend development, and `apps/api` worktree as optional/mostly unused. Workspace-local OpenCode or plugin state is not shared automatically.

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
- embedding generation with Ollama or OpenAI providers
- pgvector-backed retrieval with lexical fallback
- ask flow with citations, conversations, messages, and traces
- a web MVP for chat, documents, knowledge base, and assistant configuration

## Product core vs replaceable integrations

- **Product core (keep stable and regression-guarded):** orchestration across ingestion/retrieval/answering, traceability/read-model outputs, fallback behavior, and regression contracts/tests.
- **Replaceable integration layers (can be swapped without redefining product value):** model provider runtime (Ollama/OpenAI-compatible), vector/embedding backend, chunking/parsing adapters, external source connectors (`web page`/`feed`/`sitemap`), and evaluation/diagnostic helpers.
- Practical rule: when changing third-party integrations, preserve ask/trace contracts and fallback semantics first; do not treat provider replacement as a core-architecture rewrite.

## Notes

- The project is still in active development.
- The most accurate local run and validation notes are in [docs/current-dev-setup.md](docs/current-dev-setup.md).
- The broader implementation snapshot is in [docs/current-progress.md](docs/current-progress.md).
