# Local Dev Infra

> 文档角色：`background`
> 当前使用方式：用于查看本地基础设施背景说明；具体当前运行步骤优先看 `docs/current-dev-setup.md`。

## Services

This project uses Docker Compose for local infrastructure:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- PostgreSQL initializes `pgvector` automatically

## Start

```bash
docker compose -f docker-compose.local-infra.yml up -d
```

## Stop

```bash
docker compose -f docker-compose.local-infra.yml down
```

## Reset data

```bash
docker compose -f docker-compose.local-infra.yml down -v
```

## Connection values

PostgreSQL:

- host: `localhost`
- port: `5432`
- database: `rag_system`
- username: `postgres`
- password: `postgres`

Database URL:

```text
postgresql://postgres:postgres@localhost:5432/rag_system
```

Redis:

- host: `localhost`
- port: `6379`
- URL: `redis://localhost:6379`

Recommended local API overrides:

```text
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/rag_system
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:5432/rag_system
QUEUE_PROVIDER=redis
REDIS_URL=redis://127.0.0.1:6379
VECTOR_STORE_PROVIDER=pgvector
```

The local infra stack does not include the `pgmq` extension. Prefer Redis queue locally; use PostgreSQL-backed queue mode only as a fallback if you are debugging queue behavior without Redis.

Storage runtime now exclusively uses Supabase Storage: normal development must configure the required `SUPABASE_*` storage variables. Local filesystem storage has been removed.

## Local API env template

Use `apps/api/.env` as the local API runtime config source.

- keep Docker-backed `DATABASE_URL` / `DIRECT_URL` / `REDIS_URL`
- prefer OSS credentials for object storage now that the OSS provider is supported; current setup expects a single bucket and stores project files under `OSS_PREFIX`, for example `rag-system/uploads/...` and `rag-system/generated/...`

## Shared Infra Naming

When you later move these local foundations into long-lived shared containers outside this repo, use explicit `infra-*` naming so they stay visually separate from project services.

Suggested names:

- `infra-postgres`
- `infra-redis`
- `infra-proxy` (if added later)

Project containers should keep project-scoped names such as `rag-system-api`, `rag-system-web`, and `rag-system-worker`.

## Future Auth Direction

Current auth uses access JWT + refresh JWT cookies.

Planned simplification direction:

- access JWT for normal API auth
- optional Redis-backed coordination only if cross-process revocation or shared refresh state is needed later

Current local/self-hosted baseline no longer requires Redis for auth. Redis remains optional for future revocation/coordination needs.
