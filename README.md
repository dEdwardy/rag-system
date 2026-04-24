# RAG System

A local-first RAG system monorepo with an API service, a web app, and shared package code.

The current repository already includes a working MVP flow for document upload, ingestion, chunking, embedding, retrieval, answering, citations, trace persistence, and the default assistant / default-path bootstrap and repair flow.

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
- `deploy-offline-ecs.yml`: offline ECS deployment workflow; on PRs it runs a deploy preflight by building and compressing the app image, and on `master` pushes it uploads the archive to ECS, runs `docker load`, then runs `docker compose up -d app`
- `rollback.yml`: manual rollback that SSHes to the server, checks out the requested stable `tag/commit`, and restarts the app from the prepared image

Server-side deployment assumptions:

- the server already has Docker and Docker Compose installed
- the repository is already checked out on the server at a stable path
- production env stays on the server, for example `apps/api/.env.production`
- the server runs `docker compose` from the repository root
- if you use a separate ECS infra directory such as `/usr/pros/infra`, keep infra lifecycle operations there and let deploy workflows touch only the app checkout such as `/usr/pros/rag-system`

Required GitHub secrets for `deploy.yml`:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `SSH_PORT` (optional; defaults to `22`)
- `DEPLOY_PATH`: absolute repository path on the server, such as `/home/deploy/rag-system`

Required GitHub secrets for `deploy-offline-ecs.yml`:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `SSH_PORT` (optional; defaults to `22`)
- `DEPLOY_PATH`: absolute repository path on the server, such as `/usr/pros/rag-system`
- `REMOTE_IMAGE_DIR` (optional): remote temporary upload directory, default `/tmp/rag-system-deploy`

Keep the required deploy secrets in repository-level GitHub Actions secrets for the simplest setup.

Recommended personal-project release pattern:

- tag each stable release before production deploy
- use `deploy.yml` with `target_ref=master` for normal releases
- if the ECS host cannot pull code or images from the internet, use `deploy-offline-ecs.yml` instead; PRs will preflight the packaging path and `master` pushes will push the compressed image archive to the server for you
- in the current ECS split, routine releases should not redeploy PostgreSQL or Redis; update only the app directory unless infra itself changes
- use `rollback.yml` with a stable tag or commit when rollback is needed

Current release discipline for this private repository:

- work on feature branches, not directly on `master`
- open a PR into `master` for every release-bound change
- wait for PR `CI` and `Deploy Offline ECS` preflight to pass before merge
- treat `master` push / merge as production deploy, because it triggers ECS app rollout
- GitHub branch protection / rulesets may not be enforceable on the current private plan, so follow this flow as an operating rule even when GitHub cannot hard-block bypasses

Recommended branch discipline for this repository:

- keep only two long-lived branches: `dev` and `master`
- treat `dev` as the default integration branch for day-to-day work
- treat `master` as release-ready / production-bound history
- create short-lived task branches from `dev`, not from `master`
- use one branch for one bounded increment; do not mix feature work, cleanup, and unrelated refactors on the same branch
- preferred branch names: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>`, `refactor/<topic>`, `perf/<topic>`, `hotfix/<topic>`
- merge task branches back into `dev` after focused validation, then delete them promptly
- merge `dev` into `master` only when a real release-ready increment is ready; avoid empty "history-sync only" merges unless there is a concrete release reason
- if a branch sits for long enough that its purpose is no longer obvious or its merge cost becomes high, prefer closing it and recreating a fresh branch from current `dev`

Practical branch flow:

1. update local `dev`
2. create a short-lived branch from `dev`
3. implement one bounded change and run the smallest relevant validation
4. open or update a PR into `dev`
5. delete the task branch after merge
6. promote `dev` into `master` only for release-ready changes

The compose file still accepts an optional `APP_IMAGE` override for the GHCR-based path; for the simplest fallback path you can also preload `rag-system:latest` on the server with `docker load` and let `docker compose up -d app` start it directly.

### 7. Optional OpenCode harness

```bash
pnpm loop:start
pnpm loop:status
pnpm loop:stop
```

These scripts now use the repo-local Node runtime under `loop-runtime/`, split into `loop-runtime/core/`, `loop-runtime/adapters/`, and `loop-runtime/tests/`. The runner consumes the active materialized queue sequentially. It is intended to work on both Windows and WSL/Linux shells. The runner reuses one OpenCode session across a compact wave when possible to reduce repeated context cost, invokes the repo's `build` command for queue items, applies a per-item timeout guard (`OPENCODE_LOOP_ITEM_TIMEOUT_MS`, default `20m`), and each spawned session title includes the current task index and remaining task count, for example `[1/4 | left 3] p4-consolidate-documents-surface-copy-and-empty-states`.

The runtime code has moved out of `.opencode`, but `.opencode/loop/` still holds the live queue and state data. That keeps execution code and runtime data separate while preserving the existing queue assets and local operator workflow.

For Codex-backed runs, set `LOOP_EXECUTOR_BACKEND=codex` and choose one of two modes:

- SDK mode: install `@openai/codex-sdk` and let the runtime use `Codex.startThread()` / `thread.run(...)`
- CLI mode: set `CODEX_LOOP_COMMAND` to the Codex CLI binary and optionally pass `CODEX_LOOP_ARGS`

The Codex adapter also accepts `CODEX_SDK_OPTIONS` as JSON when you need to pass SDK configuration through the loop runtime.

If you run frontend and backend OpenCode sessions in parallel, prefer separate Git worktrees so each session has its own checkout and local config. Current working split: main checkout for non-pure-frontend work (backend, frontend/backend integration, docs/orchestration), `apps/web` worktree for pure frontend development, and `apps/api` worktree as optional/mostly unused. Workspace-local OpenCode or plugin state is not shared automatically.

## Common Commands

```bash
pnpm build
pnpm lint
pnpm lint:fast
pnpm typecheck
pnpm format
pnpm test:api:fast
pnpm test:api
```

Local quality gate baseline:

- `husky` now installs Git hooks from the repo root via `pnpm install`
- `pre-commit` runs `lint-staged`, which applies `oxlint --fix` and `prettier --write` only to staged files
- `pre-push` runs focused app typechecks (`api` + `web`) before the branch leaves your machine
- `prettier` is currently used on staged files and targeted local formatting, not yet as a whole-repo CI gate
- PR CI remains the final gate and runs repo install, app lint, app typecheck, builds, and focused API tests

For day-to-day backend work, prefer focused API test entrypoints such as `pnpm test:api:fast`, `pnpm test:api:file -- test/<name>.test.js`, or the themed commands documented in [docs/current-dev-setup.md](docs/current-dev-setup.md). Reserve full `pnpm test:api` runs for broader closeout verification.

## Key Docs

- [Current context](docs/current-context.md)
- [Next steps plan](docs/next_steps_rag_project_plan.md)
- [Current dev setup](docs/current-dev-setup.md)
- [Current progress](docs/current-progress.md)
- [Retrieval / answering next steps](docs/retrieval-answering-next-steps-2026-04-13.md)
- [Local smoke eval](docs/local-smoke-eval-2026-04-13.md)
- [Online UX review](docs/online-ux-review-2026-04-13.md)
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

- The project is still in active development, but the default user path is now in bounded maintenance / hardening mode rather than a new build-out wave.
- The most accurate local run and validation notes are in [docs/current-dev-setup.md](docs/current-dev-setup.md).
- The broader implementation snapshot is in [docs/current-progress.md](docs/current-progress.md).
- The current stage and mainline judgment are tracked in [docs/current-context.md](docs/current-context.md) and [docs/next_steps_rag_project_plan.md](docs/next_steps_rag_project_plan.md).
