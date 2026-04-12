# Production Infra Baseline

Use `docker/infra/` when you want a minimal self-hosted infra baseline on ECS or a single server:

- PostgreSQL with `pgvector`
- Redis with password protection
- no public host port exposure by default; app containers should reach them over the Docker network

## Files

- uploadable bundle: `docker/infra/`
- compose file: `docker/infra/docker-compose.yml`
- env template: `docker/infra/.env.example`

## First-time setup

1. Copy the whole `docker/infra/` directory to the server, for example `/opt/rag-infra`
2. Copy `.env.example` to `.env`
3. Fill in strong values for `POSTGRES_PASSWORD` and `REDIS_PASSWORD`
   - optional: set `DOCKER_SHARED_NETWORK`, default is `rag-infra-net`
4. Start infra:

```bash
cd /opt/rag-infra
docker compose up -d
```

5. Verify containers:

```bash
docker compose ps
```

The infra compose creates a named Docker network, default `rag-infra-net`.
The app compose references that network as an external network so both projects can resolve `infra-postgres` and `infra-redis` by container name.

## App env wiring

Point the API production env to these services:

```text
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@infra-postgres:5432/rag_system
DIRECT_URL=postgresql://postgres:<POSTGRES_PASSWORD>@infra-postgres:5432/rag_system
QUEUE_PROVIDER=redis
REDIS_URL=redis://default:<REDIS_PASSWORD>@infra-redis:6379
VECTOR_STORE_PROVIDER=pgvector
VECTOR_STORE_PGVECTOR_DIMENSIONS=1024
QUEUE_MAX_CONCURRENT_TASKS=1
```

If the API container is not on the same Docker network, replace `infra-postgres` / `infra-redis` with the host or private network address exposed to the app container.

If you intentionally need host access for debugging, add explicit `ports:` mappings yourself instead of exposing database and Redis ports by default.

## Notes

- PostgreSQL automatically enables the `vector` extension from `docker/infra/postgres/init/001-create-extensions.sql`
- Redis persistence is enabled with AOF
- this compose is only the infra layer; the app container is still started from the repository root `docker-compose.yml`
- after the database is up, apply schema changes with the approved production path:

```bash
pnpm --filter @rag-system/api exec prisma migrate deploy
```
