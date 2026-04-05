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

If this is a fresh checkout, copy the example env into the API app first:

```bash
cp .env.example apps/api/.env
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

Queue runtime now runs in two supported modes:

- `QUEUE_PROVIDER=pgmq` (default): Supabase Queues / `pgmq`-backed ingestion queue
- `QUEUE_PROVIDER=database`: PostgreSQL-backed ingestion queue fallback

Database queue runtime settings:

```text
QUEUE_PROVIDER=database
QUEUE_DATABASE_POLL_INTERVAL_MS=1000
QUEUE_DATABASE_RETRY_DELAY_MS=5000
QUEUE_DATABASE_MAX_ATTEMPTS=3
```

- the database queue stores durable ingestion jobs in `IngestionQueueJob`
- retries are handled by the API worker poll loop using the configured delay/max-attempt settings above

Supabase Queues / `pgmq` runtime settings:

```text
QUEUE_PROVIDER=pgmq
QUEUE_DATABASE_POLL_INTERVAL_MS=1000
QUEUE_DATABASE_RETRY_DELAY_MS=5000
QUEUE_DATABASE_MAX_ATTEMPTS=3
QUEUE_PGMQ_VISIBILITY_TIMEOUT_SECONDS=300
```

- `pgmq` requires the `pgmq` extension to exist on the target database; apply the approved migration rollout before switching runtime traffic
- the API ensures the configured ingestion queue exists at runtime using the current `QUEUE_PREFIX`
- message retry delay still uses `QUEUE_DATABASE_RETRY_DELAY_MS`, while `QUEUE_PGMQ_VISIBILITY_TIMEOUT_SECONDS` controls how long an in-flight message stays invisible before it can be delivered again

Apply migrations:

```bash
pnpm --filter @rag-system/api exec prisma migrate dev
```

Remote / Supabase database safety:

- use `prisma migrate dev` only for local development databases
- do not run `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` against Supabase or any shared remote database
- for approved remote rollout, use:

```bash
pnpm --filter @rag-system/api exec prisma migrate deploy
```

- before changing a remote schema, validate the migration locally or against a separate dev/staging database first

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

Test-data cleanup reminder:

- keep the default seeded baseline minimal and stable; if extra smoke/demo `KB`, `assistant`, or `document` records are retained for backend verification, make sure they do not become the default frontend path by accident
- this matters more now that the frontend is temporarily aligned to a `single primary KB`: leftover test data can silently become the first visible KB and make chat/documents look broken or point at the wrong corpus
- after any manual smoke run against a shared/dev database, either clean up the temporary records you added or explicitly isolate them so they do not hijack the default user flow

## Start API

Stable way in the current environment:

```bash
pnpm --filter @rag-system/api build
pnpm --filter @rag-system/api start:prod
```

For stable local API startup in the current Windows/WSL-compatible path:

```bash
pnpm --filter @rag-system/api start:dev
```

This expects the local PostgreSQL stack to be running.

- when `QUEUE_PROVIDER=database`, the ingestion queue runs from PostgreSQL
- when `QUEUE_PROVIDER=pgmq`, the ingestion queue runs through the Supabase `pgmq` extension

Health check:

```bash
curl http://localhost:3000/health
```

Knowledge-base-wide rebuild endpoint:

```bash
curl -X POST http://localhost:3000/knowledge-bases/<kbId>/reindex
```

- this requests reindex for every document currently in the KB
- if the KB only contains legacy local `fallback:hash-v1` vectors, the first successful dedicated-provider reindex will replace those old fallback vectors for that KB

The API will use Ollama automatically when these environment values are present:

```text
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_EMBEDDING_DIMENSIONS=768
```

Notes:

- The current API startup path now uses Nest `ConfigModule` and resolves env files only from the API app in this order:
  - `apps/api/.env.local`
  - `apps/api/.env`
- Repository-root `.env` is not part of the runtime path for the API.
- production container startup should inject env at runtime (for example via `docker compose` `env_file` or container platform secrets); do not rely on baking `apps/api/.env.production` into the image
- CORS behavior now differs by runtime mode:
  - development / non-production: allow request origins dynamically so local multi-port frontend work is not blocked by fixed origin lists
- production: do not enable application-level CORS; handle cross-origin policy at the reverse proxy / gateway layer such as Nginx
- current production web build target is the `/ragora` subpath, so reverse-proxy routing and OAuth callback config should use `/ragora/...` paths instead of assuming a dedicated subdomain
- The API build/start scripts now clear `apps/api/dist` and `apps/api/tsconfig.tsbuildinfo` before rebuilding.
- This cleanup is intentional for cross-environment compatibility: after switching between Ubuntu/WSL and Windows, stale incremental output can leave mixed `dist` layouts behind and cause missing routes or missing runtime modules.
- Root cause summary for the April 1, 2026 Windows issue:
  - the API compiler output can include shared-package files under `dist/packages/...`, which pushes the effective runtime entry to `dist/apps/api/src/main.js`
  - older flat output such as `dist/main.js` or partial stale `dist/apps/api/src/*` files can remain when `dist` is not cleaned first
  - that stale mix caused `start:prod` / `start:dev` to pick inconsistent runtime artifacts, which surfaced as `GET /auth/me` returning `404` and one prod boot failing with `Cannot find module '../../infra/storage/storage.module'`
- Current prevention baseline:
  - `pnpm --filter @rag-system/api build` always runs a clean rebuild first
  - `pnpm --filter @rag-system/api start:dev` now cleans stale `dist` / `tsconfig.tsbuildinfo`, runs `prisma generate`, then starts `tsx watch src/main.ts`
  - `pnpm --filter @rag-system/api start:prod` resolves the built entry through the same nested-layout-aware helper
  - the build finalize step now writes a minimal `dist/packages/shared/package.json` with `"type": "module"` so Node does not reparse emitted shared files with runtime warnings
- Current tradeoff:
  - `start:dev` has returned to a real hot-reload watch path for day-to-day backend work
  - `.env` / `.env.local` changes are still process-level config changes, so they continue to require a manual restart
  - the startup cleanup remains in place so Windows / WSL switches do not reuse stale build artifacts
- Prisma CLI config is now sourced from `apps/api/prisma.config.ts` instead of deprecated `package.json#prisma`.
- If you manually run Nest/Node commands outside the package scripts after changing OS/runtime environment, prefer a clean rebuild first instead of reusing old `dist/`.
- In the current local environment, `qwen2.5:7b` has been verified for `/api/generate`, and `nomic-embed-text` has been verified for `/api/embed`.
- If you switch to a different dedicated embedding model later, update `OLLAMA_EMBEDDING_MODEL` and re-check `OLLAMA_EMBEDDING_DIMENSIONS` against the actual Ollama response length.
- `OLLAMA_EMBEDDING_DIMENSIONS` is optional and acts as a strict guardrail: when set, the backend rejects Ollama embedding responses whose vector length does not match the configured dimension.
- `OLLAMA_EMBEDDING_DIMENSIONS` now also requires Ollama embedding provider config (`OLLAMA_BASE_URL` + `OLLAMA_EMBEDDING_MODEL` or `OLLAMA_MODEL`); setting it alone now fails fast at startup/config resolution instead of being silently ignored.
- For OpenAI-compatible hosted providers such as Volcengine Ark, the current API also supports two embedding request modes:

```text
OPENAI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
OPENAI_CHAT_MODEL=<chat-endpoint-id>
OPENAI_EMBEDDING_MODEL=<embedding-endpoint-id>
OPENAI_EMBEDDING_DIMENSIONS=1024
OPENAI_EMBEDDING_API_MODE=multimodal_text
VECTOR_STORE_PROVIDER=pgvector
VECTOR_STORE_PGVECTOR_DIMENSIONS=1024
```

- `OPENAI_EMBEDDING_API_MODE=standard` keeps the normal `/embeddings` request shape with string input.
- `OPENAI_EMBEDDING_API_MODE=multimodal_text` switches to `/embeddings/multimodal` and sends text as `{ type: "text", text: ... }` items.
- `VECTOR_STORE_PGVECTOR_DIMENSIONS` must match the active embedding output size. With pgvector, this is part of the database column type, so changing embedding size also requires a schema migration and a fresh reindex.
- If a KB still contains old local `fallback:hash-v1` vectors, the first successful reindex with a dedicated embedding provider now replaces those legacy fallback vectors for that KB so reindex can recover without manual vector cleanup.
- external source fetch runtime now also supports:

```text
SOURCE_FETCH_TIMEOUT_MS=10000
SOURCE_FETCH_RETRY_ATTEMPTS=2
SOURCE_FETCH_DOMAIN_MIN_INTERVAL_MS=80
SOURCE_FETCH_CRAWL_BUDGET_WINDOW_MS=10000
SOURCE_FETCH_CRAWL_BUDGET_MAX_REQUESTS=40
SOURCE_FETCH_RETRY_BACKOFF_BASE_MS=250
SOURCE_FETCH_RETRY_BACKOFF_MAX_MS=2000
SOURCE_FETCH_RETRY_JITTER_MS=120
SOURCE_FETCH_BREAKER_PAUSE_MS=15000
SOURCE_FETCH_BREAKER_REPEATED_5XX_THRESHOLD=2
SOURCE_FETCH_BREAKER_CHALLENGE_PAUSE_MS=30000
```

- current defaults preserve the existing behavior: `10s` timeout and `2` total fetch attempts for `web page` / `feed` / `sitemap` source HTTP requests
- source fetch now also applies a narrow domain-level courtesy pacing baseline:
  - same-domain minimum interval pacing (`SOURCE_FETCH_DOMAIN_MIN_INTERVAL_MS`)
  - bounded rolling crawl budget pacing (`SOURCE_FETCH_CRAWL_BUDGET_WINDOW_MS` + `SOURCE_FETCH_CRAWL_BUDGET_MAX_REQUESTS`)
  - retry exponential backoff + jitter (`SOURCE_FETCH_RETRY_BACKOFF_BASE_MS` / `SOURCE_FETCH_RETRY_BACKOFF_MAX_MS` / `SOURCE_FETCH_RETRY_JITTER_MS`)
- source fetch now also applies a narrow breaker pause on domain pressure signals to avoid hammering target sites:
  - immediate pause on `429`
  - pause after repeated `5xx` responses on the same domain (`threshold=2` by default)
  - pause on obvious anti-bot/challenge HTML responses (`403/503` with challenge markers)
- external-source legality + crawl-courtesy baseline (for existing `web page` / `feed` / `sitemap` / `sitemapindex` families):
  - ingest only publicly accessible sources (`no-login` / `no-paywall`)
  - do not attempt access-control bypass (login walls, paywalls, anti-bot challenges, or other restricted-access bypass)
  - treat `sitemap` / `sitemapindex` only as URL index hints, not as authorization grants
  - users are responsible for confirming rights-to-use before ingestion
  - external resync remains incremental-first: in-flight resync is not duplicated, and very recent `ready/completed` external docs are skipped for immediate repeat broad refetch
- storage runtime now also supports:

```text
STORAGE_PROVIDER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET_UPLOADS=uploads
SUPABASE_STORAGE_BUCKET_GENERATED=generated
VECTOR_STORE_PROVIDER=filesystem
VECTOR_STORE_PGVECTOR_TABLE=ChunkEmbedding
VECTOR_STORE_PGVECTOR_DIMENSIONS=768
```

- storage path resolution for the remaining local test/dev fallback is repo-root-stable instead of `process.cwd()`-relative:
  - when unset, the default remains the repo-local `storage/` directory
  - when set to a relative path such as `storage` or `storage/local-dev`, it resolves relative to the repository root, not the shell working directory
  - when set to an absolute path, the absolute path wins as before
- the normal runtime path is now explicit Supabase Storage: keep `STORAGE_PROVIDER=supabase` plus all `SUPABASE_*` storage variables configured in normal development and shared environments
- local filesystem storage no longer activates as a silent default; keep it only as a temporary fallback for tests / narrow local debugging via `STORAGE_PROVIDER=local` or an explicit `STORAGE_ROOT`
- the backend keeps the same logical `storageKey` prefixes (`uploads/...`, `generated/...`), so document records do not need a different path shape when switching between local and Supabase storage
- `SUPABASE_SERVICE_ROLE_KEY` is intended for backend-only use; keep the buckets private and do not expose that key to the web app
- vector storage still defaults to the local filesystem; set `VECTOR_STORE_PROVIDER=pgvector` to switch vector persistence/search to PostgreSQL `pgvector`
- current pgvector support is intentionally scoped to the verified `nomic-embed-text` setup and expects `VECTOR_STORE_PGVECTOR_DIMENSIONS=768`

## GitHub Actions production image and deploy

- `.github/workflows/ci.yml` remains the code-validation workflow: install, Prisma generate, build, typecheck, and fast API tests
- `.github/workflows/docker-image.yml` remains available as an optional GHCR image build path on `main` pushes or manual runs
- `.github/workflows/deploy-dev.yml` is the manual dev deploy entrypoint: it SSHes to the dev target server, checks out the requested `branch/tag/commit`, then runs `docker compose build app` plus `docker compose up -d app`
- `.github/workflows/deploy.yml` is the default manual production deploy entrypoint: it SSHes to the target server, checks out the requested `branch/tag/commit`, then runs `docker compose build app` plus `docker compose up -d app`
- `.github/workflows/rollback.yml` is the matching manual rollback entrypoint: it SSHes to the target server, checks out the requested stable `tag/commit`, then rebuilds/restarts the app
- the production compose path still accepts `APP_IMAGE`; local default stays `rag-system:latest`, but the current recommended personal-project deployment path is server-local build from the checked-out repository
- expected server baseline for `deploy-dev.yml` and `deploy.yml`:
  - Docker and Docker Compose already installed
  - repository already checked out on the server
  - production env file kept on the server, for example `apps/api/.env.production`
  - deploy command executed from the repository root
- required GitHub secrets for `deploy-dev.yml` and `deploy.yml`:
  - `SSH_HOST`
  - `SSH_USER`
  - `SSH_PRIVATE_KEY`
  - `DEPLOY_PATH`
  - optional `SSH_PORT` (defaults to `22`)
- recommended GitHub Environments layout:
  - `dev` environment for `deploy-dev.yml`
  - `production` environment for `deploy.yml`
  - keep identical secret names in each environment so both workflows can keep using `secrets.SSH_*` and `secrets.DEPLOY_PATH`
- recommended release discipline for rollback safety:
  - use `deploy-dev.yml` for manual dev refreshes before promoting a ref toward production
  - create a git tag before each production release
  - deploy from an explicit `target_ref` instead of relying on an implicit floating working tree state
  - use `rollback.yml` with the previous stable tag when application code must be reverted
- applying the pgvector migration to a remote/shared database is a schema write: validate locally first, then use the approved remote rollout path (`prisma migrate deploy`), not `migrate dev` or `db push`
- this avoids write/read drift when the API is started from different directories (for example repo root vs `apps/api`) while still allowing environment-specific absolute paths on Windows/WSL/Linux
- optional OpenCode harness note: root `package.json` now points `loop:*` / `opencode:loop` scripts at the repo-local Node harness under `.opencode/loop/harness/`; the runner consumes the current materialized queue in order, reuses the same OpenCode session across a compact wave when possible, and uses `opencode run --agent build` / `opencode run --continue --agent build` for each pending item; spawned session titles include the current task index and remaining task count such as `[1/4 | left 3] ...`; each item is also protected by `OPENCODE_LOOP_ITEM_TIMEOUT_MS` (default `1200000`) so a stuck task is killed and marked `needs_replan`; structured JSON error events are also treated as queue failures instead of false `completed` results; use those commands directly on Windows or WSL/Linux
- `pnpm loop:stop` now waits briefly for the current runner pid to fully exit before returning, which reduces restart races that could otherwise interrupt an in-flight child run during immediate stop/start cycles
- auth/session runtime now also supports:

```text
AUTH_SESSION_COOKIE_NAME=rag_session
AUTH_LOGIN_PROVENANCE_COOKIE_NAME=rag_login_provenance
AUTH_SESSION_TTL_HOURS=168
```

- current auth cookie/session defaults:
  - cookie name default is `rag_session`
  - login session TTL default is `168` hours (`7` days)
  - route policy baseline now distinguishes public and authenticated API routes:
    - public: `GET /health`, `GET /auth/providers`, `POST /auth/login`, `POST /auth/logout`
    - authenticated: `GET /auth/me`, `POST /auth/permissions/check`, plus the owner-scoped business controllers for `knowledge-bases`, `documents`, `assistants`, `conversations`, `traces`, `audit`, and `retrieval-profiles`
    - `GET /auth/me` and the owner-scoped business routes require an authenticated session cookie and return `401` when unauthenticated
  - backend now exposes minimal auth loop endpoints:
    - `POST /auth/login` (Phase 1 local-account baseline: accepts `{ email, password }`, sets session cookie, returns identity)
    - `POST /auth/logout` (revokes current session when present, clears cookie)
    - `GET /auth/providers` (returns local-login dev helper info plus OAuth provider configuration readiness for the login UI)
    - `GET /auth/me` (returns `{ identity, currentIdentity, loginProvenance }`)
      - `loginProvenance.type`: `local_session` or `oauth_session`
      - `loginProvenance.oauthProvider`: `github` / `google` / `oidc` / `null` (null for local session)
  - current local-account login baseline (`Phase 1`) scope:
    - pre-created users only (seed/admin/manual bootstrap); no public signup in this wave
    - local seed defaults are now explicit for local development: `AUTH_DEV_DEFAULT_USER_EMAIL` (default `default-user@example.com`) and `AUTH_DEV_DEFAULT_USER_PASSWORD` (default `local-password-1`)
    - no password reset / forgot-password / email verification in this wave
    - session model remains local `AuthSession` + cookie-based auth (`rag_session`), with `/auth/me` as the frontend auth anchor
    - ACL boundary is preserved as owner-only (`owner_only_v1 + deny_by_default`), with no role/share expansion in this phase
  - auth `Phase 2/3/4 + real OIDC` current landed snapshot (queue wave sync):
    - `Phase 2` baseline is landed:
      - `AuthIdentityLink` skeleton is in Prisma (`provider + subject` unique boundary, plus `emailSnapshot` / `profileSnapshot` / `lastLoginAt`)
      - `authSource` contract reserves `local` / `github` / `google` / `oidc` / `session` / `dev_seed`
      - reserved provider route shape remains `GET /auth/oauth/:provider/start` + `GET /auth/oauth/:provider/callback`
    - `Phase 3` GitHub flow is landed in backend runtime:
      - `/auth/oauth/github/start` builds redirect URL + state cookie
      - `/auth/oauth/github/callback` validates state, exchanges code, links/creates local user through `AuthIdentityLink(provider, subject)`, then creates local `AuthSession`, writes `rag_session`, and redirects back to the web app success URL
      - local GitHub app setups may also point the callback URL at `/auth/github/callback`; the backend now accepts that alias and runs the same callback flow
    - `Phase 4` Google flow is landed with the same backend pattern:
      - `/auth/oauth/google/start` and `/auth/oauth/google/callback` follow the same state + identity-link + local-session bridge semantics
    - real `oidc` flow is now landed with the same backend identity-link/session bridge pattern:
      - `/auth/oauth/oidc/start` resolves OIDC discovery metadata (`authorization_endpoint`) and redirects with the existing state-cookie guard
      - `/auth/oauth/oidc/callback` resolves discovery metadata (`token_endpoint` + `userinfo_endpoint`), exchanges code, reads stable `sub`, then links/creates local user via `AuthIdentityLink(provider, subject)` and creates local `AuthSession`
    - runtime env requirements currently used by code paths above:
      - shared OAuth state controls: `AUTH_OAUTH_STATE_COOKIE_NAME` (default `rag_oauth_state`), `AUTH_OAUTH_STATE_TTL_SECONDS` (default `600`)
      - shared post-login redirect control: `AUTH_OAUTH_SUCCESS_REDIRECT_URI` (fallbacks: `AUTH_WEB_SUCCESS_REDIRECT_URI`, then first `CORS_ORIGIN`, then `http://localhost:5173`)
      - GitHub start/callback config: `AUTH_GITHUB_CLIENT_ID`, `AUTH_GITHUB_CLIENT_SECRET`, `AUTH_GITHUB_REDIRECT_URI` (optional overrides: `AUTH_GITHUB_AUTHORIZE_URL`, `AUTH_GITHUB_TOKEN_URL`, `AUTH_GITHUB_USER_URL`, `AUTH_GITHUB_SCOPE`)
      - Google start/callback config: `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET`, `AUTH_GOOGLE_REDIRECT_URI` (optional overrides: `AUTH_GOOGLE_AUTHORIZE_URL`, `AUTH_GOOGLE_TOKEN_URL`, `AUTH_GOOGLE_USER_URL`, `AUTH_GOOGLE_SCOPE`)
      - OIDC start/callback config: `AUTH_OIDC_ISSUER`, `AUTH_OIDC_CLIENT_ID`, `AUTH_OIDC_CLIENT_SECRET`, `AUTH_OIDC_REDIRECT_URI` (optional: `AUTH_OIDC_SCOPE`, default `openid email profile`)
      - optional default tenant for first-time OAuth auto-create path: `AUTH_DEFAULT_TENANT_ID` (fallback `default-tenant`)
    - behavior boundary kept unchanged:
      - `/auth/me` contract remains `{ identity, currentIdentity, loginProvenance }`; this wave does not change identity/session payload shape
      - local login + session-cookie flow remains active (`POST /auth/login` + `rag_session` + `GET /auth/me`)
      - OAuth/OIDC callback still bridges into local persisted session (`AuthSession` + `rag_session`), not provider token session state on frontend
      - owner-only ACL behavior remains unchanged; this auth increment does not reopen ACL expansion
  - current ACL baseline (`owner_only_v1`) default stance is **deny by default**:
    - allow only when `tenantId` matches and `ownerId === userId`
    - deny when tenant mismatches, owner mismatches, or owner is unassigned
    - conservative fallback: unsupported access action or unsupported resource kind is denied explicitly (`unsupported_action` / `unsupported_resource_kind`)
    - default resource visibility stance in this ACL wave:
      - private-by-default resources: `knowledge_base`, `document`, `assistant`, `conversation`, `trace`
      - public surface remains route-level only (`/health`, `/auth/login`, `/auth/logout`), not business-resource visibility
      - new-resource visibility inheritance baseline:
        - `knowledge_base` / `conversation`: `explicit_private`
        - `document` / `assistant`: inherit from parent knowledge-base visibility
        - `trace`: inherit from parent conversation visibility
      - because current parent resources are private in `owner_only_v1`, effective visibility for newly created resources currently stays private
    - ACL owner-based wave (`owner_only_v1`) implemented boundaries snapshot:
      - route boundary: business routes are authenticated (`knowledge-bases`, `documents`, `assistants`, `conversations`, `traces`, `audit`, `retrieval-profiles`)
      - policy boundary: service-layer owner check uses `evaluateOwnerResourceAccess` with explicit deny reasons (`tenant_mismatch`, `owner_mismatch`, `owner_unassigned`, plus unsupported action/resource guards)
      - resource boundary (implemented):
        - `knowledge_base`: owner-scoped list/get/update
        - `document`: owner-scoped access via parent knowledge-base ownership checks (list/detail/write/reindex/delete)
        - `assistant`: owner-scoped list/get/update and ask/ask-stream assistant resolution
        - `conversation`: owner-scoped list/detail/messages/traces via `tenantId + userId`
        - `trace`: owner-scoped `/traces` list and direct `/traces/:id` read via conversation ownership
      - default visibility boundary: all five resources remain private-by-default in this wave
      - validated denial-path baseline (current closeout snapshot):
        - unauthenticated requests to authenticated routes return `401` (including `GET /auth/me`, owner-scoped business routes, and assistant ask/ask-stream)
        - owner-mismatch requests are denied by owner policy (`403`), including assistant ask + ask-stream pre-stream denial paths
        - knowledge-base/document owner-mismatch denial regressions are covered for list/detail/write boundaries (no implicit cross-owner read/write fallback)
        - trace reads remain owner-scoped in both direct `/traces/:id` and conversation-linked `/conversations/:id/traces` paths
    - intentionally unsupported ACL expansions in the current owner-based wave:
      - no member/viewer allow rules (both stay planned-deny)
      - no share/public business-resource visibility expansion
      - no RBAC/ABAC matrix or role-derived policy branching in service decisions
      - no cross-tenant collaboration semantics
    - focused ACL/access-control closeout validation command (repro baseline):
      - `pnpm test:api:focus:acl`
  - web auth bootstrap now calls `GET /auth/me` at app-shell entry and redirects unauthenticated users to `/login`
  - web app shell now exposes a minimal `Logout` action that calls `POST /auth/logout`, clears auth-scoped cached query state, and returns to `/login`
  - web API requests now include credentials by default so the auth session cookie is sent for protected API routes
  - when the web app runs on the local Vite dev server, Vite proxies `/api` to `http://localhost:3000` so browser requests stay same-origin and still reach the backend instead of Vite returning `index.html`
  - the current web client now prefers that local `/api` proxy by default in dev unless `VITE_API_BASE_URL` is explicitly set, which avoids the extra browser CORS preflight cost on the common local path
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
  - ask one-shot responses and ask-stream `final` payloads now also expose additive top-level readability/provenance fields derived from existing metadata:
    - `strategyReadabilityLabel`
    - `retrievalModeProvenanceSentence`
    - `rewriteReadabilityLabel`
    - `answerAttributionSummary`
    - `answerAttributionReadabilitySentence`
    - `answerAttribution` / `answerAttributionSource`
    - `answerEvidenceSource` / `answerEvidenceSourceReadabilityLabel`
    - `answerEvidenceSourceReadabilitySentence`
    - `answerTextSource` / `answerTextSourceReadabilityLabel` / `answerTextSourceReadabilitySentence`
    - `answerStatusSource` / `answerStatusSourceReadabilityLabel` / `answerStatusSourceReadabilitySentence`
    - `answerProvenanceSentence` / `answerProvenanceReadabilitySentence`
    - `missingInformationProvenanceSentence`
    - `missingInformationSource` / `missingInformationSourceReadabilityLabel`
  - this top-level ask metadata list is intentionally kept aligned with the web contract guard in `apps/web/test/ask-answering-metadata-contract.test.js`
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
    - `retrievalModeProvenanceSentence` (one-line resolved retrieval-mode + fallback-usage provenance)
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
    - `missingInformationSourceReadabilityLabel` (missing-information source readability label)
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
    - `contextReadabilitySentence` (one-line prompt-context composition sentence)
    - `citationCount`
    - `citationCountReadabilityLabel` (citation count readability label)
    - `citationCountReadabilitySentence` (one-line citation count readability sentence)
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
    - `retrievalModeProvenanceSentence` example:
      - `Resolved retrieval mode is hybrid; fallback was not used.`
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

- local API `start:prod` now loads app-scoped env files automatically when present:
  - `apps/api/.env.local`
  - `apps/api/.env`

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

P5 v1 fixed-question eval runner (automation-first baseline capture):

```bash
pnpm --filter @rag-system/api eval:runner:p5-v1
```

- current caution:
  - `apps/api/scripts/run-p5-v1-eval-runner.mjs` currently logs in through `POST /auth/login`
  - `POST /auth/login` now validates the local-account payload shape (`{ email, password }`)
  - re-verify or update the runner login path before treating this command as the default reproducible baseline entry

- default target: `http://127.0.0.1:3000`
- output artifacts:
  - `storage/evals/p5-v1/p5-v1-retrieval-regression-<timestamp>.json`
  - `storage/evals/p5-v1/p5-v1-retrieval-regression-<timestamp>.md`
  - `storage/evals/p5-v1/p5-v1-retrieval-regression-<timestamp>.html`
- practical latest-artifact lookup convention (timestamped triplet):
  - latest JSON: `ls -1t storage/evals/p5-v1/p5-v1-retrieval-regression-*.json | sed -n '1p'`
  - latest Markdown/HTML: use the same basename and swap extension to `.md` / `.html`
- report summarizes retrieval regression signals from existing eval item metadata + `traceSummary`, including: `no-hit`, `fallback`, `low-score`, `citation-limit-hit`, and `source-family-failure` (with source-family breakdown)
- boundary note (P5 v1): timestamped files under `storage/evals/p5-v1` are **offline regression artifacts** for replay-proof/archive/diff workflows; they are not a web runtime contract surface
- baseline source-of-truth note (P5 v1 engineering baseline):
  - canonical manifest path: `apps/api/scripts/p5-baseline-manifest.v1.json`
  - this manifest is the approved **engineering baseline v1** source of truth (question set + replay binding), not a broad benchmark framework contract
  - approved baseline question set currently stays pinned to the 3 manifest IDs:
    - `p5-v1-q1-capability-summary`
    - `p5-v1-q2-source-family-support`
    - `p5-v1-q3-no-hit-guardrail`
  - approved dataset pin stays on `baselineSource.sourceVersion = p5-v1-demo-replay.questions.v1` with snapshot ref `apps/api/src/modules/eval-question-sets/eval-question-sets.service.ts#P5_V1_DEMO_REPLAY_QUESTIONS`
  - approved annotation layering stays on default fields `intent / expectedAnswerPoints / mustNotMiss / acceptableExpressionRange`, with `criticalEvidenceExpectation` as the optional critical layer (required only for `q1`/`q2`; `q3` remains non-critical evidence)
  - runner consumption path: `eval:runner:p5-v1` (`apps/api/scripts/run-p5-v1-eval-runner.mjs`) loads `runnerReplayBinding` from this manifest first, then validates the shortlist pin via `apps/api/scripts/p5-demo-shortlist.json`, and pins replay to the approved engineering-proof demo `demo-eval-report-replay` (`eval-report-replay`) before calling `POST /eval/question-sets/demo-replays/p5-v1/run`
  - approved demo shortlist pin remains `p5-demo-shortlist-4plus1`: 4 selected demos (`ask-happy-path`, `no-hit-guardrail`, `source-backed-answer`, `eval-report-replay`) + 1 candidate (`trace-diagnostic-readability`); `demo-eval-report-replay` is positioned as the approved engineering-proof replay demo in this wave
- boundary note (artifact producer): offline files under `storage/evals/p5-v1` are produced by the CLI runner path (`apps/api/scripts/run-p5-v1-eval-runner.mjs`) after calling `POST /eval/question-sets/demo-replays/p5-v1/run`
- boundary note (report-center contract): web `Report center` keeps using live eval API response contracts (`POST /eval/question-sets/:id/runs` + `reportExports`) for in-app read/trigger/export flows, and does not directly consume or index offline files under `storage/evals/p5-v1`
- current wave scope guard: this wave stays on eval/regression proof closeout; do not expand `Report center`/`Usage` into a generic analytics or ops dashboard platform

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
- auth/ACL owner-scoped access-control baseline:
  - `pnpm test:api:focus:acl`
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

- documents page source-entry (`web page` / `feed` / `sitemap`) contract parity + single-submit guard are currently locked by the `ui-review-regressions` source check:
  - this focused check stays limited to the current Documents source-entry UX follow-up: field validation, success feedback, and empty/busy-state consistency for the existing three intake entrypoints
  - current closeout behavior assumes an active knowledge base is required for both the document list and the source-entry panel; without one, the page now shows an explicit empty state and guidance action instead of implicitly falling back to `default-kb`

```bash
node --test --test-name-pattern "documents page" apps/web/test/ui-review-regressions.test.js
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
  - when picking the next queue item, use dependency/blocking order first; do not use creation order as the default
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
- `pnpm opencode:loop` still exists in root `package.json`, but currently points to a missing `.opencode/loop/` path in this checkout; do not treat it as an available local workflow entry.
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
- if an external source document later loses a valid `sourceConfigJson`, `POST /documents/:id/reindex` now first attempts legacy recovery from document identity (`sourceType + sourceName`) for `web_page` / `feed` / `sitemap` (with default `maxItems/maxPages=20` for feed/sitemap); only unrecoverable cases still record a structured non-retryable config failure after writing the new run/version
- when an external source re-sync does not yield a new source-level title, the backend now preserves the document's current `title` instead of overwriting it with the normalized URL fallback
- the same title-preservation rule now also applies when posting the same external source URL again and the backend reuses the existing document record for a fresh sync
- external source fetch diagnostics now distinguish retryability at the source-fetch boundary:
  - upstream / transient fetch failures remain `retryable: true`
  - invalid payload / unsupported content type style failures now persist as `retryable: false`
- external source follow-up（P3）当前 accepted stability boundary / queue slices 快照：
  - guardrail landed sync（2026-03-31）：后续仅在同一 in-scope source family 内做稳定性补强；不重开 source expansion、connector 平台化或无关能力扩面。
  - legality/crawl-courtesy baseline（policy only，当前约束）：
    - 仅面向公开可访问、无登录、无付费墙内容
    - 不支持任何访问控制绕过（登录/付费墙/封禁等）
    - `sitemap`（含 `sitemapindex`）仅作 URL 索引提示，不构成授权 grant
    - 使用方仅应导入其有权使用的数据（rights-to-use 由使用方确认）
  - stability boundary（保持不变）：
    - source family 仅限 `web page` / `feed` / `sitemap urlset` / `sitemapindex(一层)` + `external_resync`
    - source-expansion decision（当前波次）：`keep`（不新增 source family）
    - nested sitemapindex 仍按不支持处理（保持当前失败语义）
    - `MAX_CHILD_SITEMAPS=20` 仍为实现常量（本波次不做 per-source 动态配置）
    - web page 仍按静态 HTML 提取，不引入 JS 渲染抓取
  - queue-ready slices（按顺序）：
    1) `source follow-up gap list`
    2) `source diagnostics consistency`
    3) `source resync recovery guards`
    4) `new source type review`
    5) `source follow-up docs`
  - remaining safe follow-up gaps（current source wave，docs/planning snapshot）：
    - `source retry/timeout diagnostics consistency`
    - `web page body-quality diagnostics`
    - `external resync diagnostics/error-code consistency`
  - extra batch note（P3 follow-up micro-wave）：本轮附加批次只收口以上 3 个 remaining safe gaps，不重开 auth/ACL sequencing，不新增 source family。
  - intentionally deferred（本波次明确后置）：
    - 新 source family 扩展（connector 扩面）
    - web page JS 渲染抓取能力
    - 跨 source family 的全面错误码体系重构
    - source 平台化/插件化重构
  - focused validation baseline（current source follow-up wave）：
    - `pnpm test:api:file -- test/external-source-sync.test.js`
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
    - `pnpm test:api:file -- test/parsing.test.js`
    - guardrail 后续增量默认复用这组基线，不额外扩成重型全量验证。
  - focused validation baseline（extra batch）：复用同一组三条 P3 follow-up 命令，不额外升级到重型全量验证。
- backend now also persists run-level execution history in `DocumentRun` and exposes it through `GET /documents/:id/runs`
- backend now also exposes knowledge-base scoped recent run history through `GET /knowledge-bases/:id/document-runs`
- backend now also exposes one lightweight aggregate summary through `GET /knowledge-bases/:id/document-runs/summary`
- backend now also exposes one scan-first comparison summary endpoint for recent-window diagnostics through `GET /knowledge-bases/:id/document-runs/comparison` (run-vs-run or snapshot-vs-snapshot)
- in `snapshot` mode, the comparison payload now also includes additive `issueHotspotSlice` (`leftHotspot` / `rightHotspot` / `dominantShift`) for quick issue-concentration scan
- snapshot comparison null/empty contract (validated baseline): low-signal windows still keep these additive `issueHotspotSlice` keys stable and explicit, with `null` values when no hotspot or meaningful dominant shift exists (instead of omitting keys)
- backend now also exposes one minimal authenticated issue-event scan endpoint through `GET /audit/events`
- the current PC Web now minimally consumes these run observability endpoints in existing pages:
- `Knowledge Base` shows recent source/document runs plus a small recent-run summary and latest failure context
- `Knowledge Base` recent runs now also support a minimal status filter (`all` / `failed` / `processing`), direct jump to the related document, and one-item reindex for failed/skipped runs
- `Document Detail` shows per-document run history with status, trigger, source timing, and minimal diagnostics expansion
- `Usage` keeps a scan-first `P6 v1 health dashboard` surface (alerts, trend, hotspot, anomaly clustering, regression diff, snapshot window diff) by reusing existing summary/comparison/audit endpoints
  - usage snapshot window diff contract source: `GET /knowledge-bases/:id/document-runs/comparison` in `snapshot` mode (including additive `issueHotspotSlice`); this remains a scan-first troubleshooting slice, not a generic metric/report surface
- `Report center` keeps a scan-first `P5 v1` eval replay surface (pre-run guidance, quality/diff/weakest-item scan, run metadata, export) and stays on live eval API contracts
  - report-center contract source: `POST /eval/question-sets/:id/runs` response payload (including `reportExports`); this route does not consume usage snapshot payloads or offline `storage/evals/p5-v1` artifacts
- `Trace Detail` keeps a scan-first execution-summary surface (diagnostic summary slice, failure taxonomy, quick-jump anchors) and does not require new backend contracts
  - trace-detail contract source: existing `GET /traces/:id` / `GET /conversations/:id/traces` `traceSummary` readability fields; no coupling to usage snapshot comparison payloads or report-center run payloads
- closeout-batch observability contract snapshot（scan-first, landed）：
  - `Usage` contract surface remains `summary + comparison + audit` (`GET /knowledge-bases/:id/document-runs/summary`, `GET /knowledge-bases/:id/document-runs/comparison`, `GET /audit/events`)
  - `Report center` contract surface remains live eval run/read/export (`POST /eval/question-sets/:id/runs` response + `reportExports`)
  - `Trace Detail` contract surface remains `traceSummary` readability (`GET /traces/:id` / `GET /conversations/:id/traces`)
- dashboard scope is intentionally constrained after this closeout batch: keep `Usage`/`Trace Detail` scan-first troubleshooting panels plus `Report center` scan-first eval replay only, and continue to defer generic analytics/ops-platform expansion
- next accepted P6 closeout gaps (scan-first surface only, docs snapshot):
  - keep `Usage` closeout focused on existing panel readability/empty-state consistency over current summary/comparison/audit payloads (no new metric families)
  - keep `Report center` closeout focused on existing P5 eval run/read/export flow and parameter carry-through (`questionSetId` / `assistantId` / `baselineSnapshotId`), without adding new report families
  - keep `Report center` contract source on live eval API responses (plus trace-summary-derived eval readability already included in those responses), and do not repurpose usage snapshot payloads as report contracts
  - keep `Usage` ↔ `Report center` boundary as route-level navigation/readability only, without reopening dashboard platform expansion or new backend contracts
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

1. Start PostgreSQL with Docker.
2. Start API with `pnpm --filter @rag-system/api start:prod`.
3. Upload a markdown, DOCX, or PDF document to `default-kb`.
4. Wait for the document to reach `ready`.
5. Confirm the uploaded document has generated chunks in the document detail view.
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

- Supabase-first object storage runtime, with explicit local fallback only for tests/debug (`STORAGE_PROVIDER=local` or explicit `STORAGE_ROOT`)
- Database-backed document ingestion queue (`QUEUE_PROVIDER=database` / `QUEUE_PROVIDER=pgmq`)
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
