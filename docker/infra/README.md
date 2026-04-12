# Infra Bundle

Upload the whole `docker/infra/` directory to ECS when you want a minimal self-hosted infra bundle.

## Included files

- `docker-compose.yml`
- `.env.example`
- `postgres/init/001-create-extensions.sql`

## On ECS

1. Copy this directory to a target such as `/opt/rag-infra`
2. Copy `.env.example` to `.env`
3. Fill in strong values for:
   - `POSTGRES_PASSWORD`
   - `REDIS_PASSWORD`
   - optional `DOCKER_SHARED_NETWORK` if you do not want the default `rag-infra-net`
4. Start:

```bash
cd /opt/rag-infra
docker compose up -d
```

5. Verify:

```bash
docker compose ps
docker compose logs -f
```

## App connection values

If your app container joins the same Docker network, use:

```text
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@infra-postgres:5432/rag_system
DIRECT_URL=postgresql://postgres:<POSTGRES_PASSWORD>@infra-postgres:5432/rag_system
QUEUE_PROVIDER=redis
REDIS_URL=redis://default:<REDIS_PASSWORD>@infra-redis:6379
VECTOR_STORE_PROVIDER=pgvector
VECTOR_STORE_PGVECTOR_DIMENSIONS=1024
QUEUE_MAX_CONCURRENT_TASKS=1
```

This bundle does not expose database or Redis ports to the public host by default.

The compose also creates a named shared Docker network, defaulting to `rag-infra-net`, so the app stack can attach to the same network from a separate compose project.
