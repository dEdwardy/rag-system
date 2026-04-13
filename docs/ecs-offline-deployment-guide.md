# ECS Offline Deployment Guide

This guide reflects the current real deployment shape on ECS:

- `infra` is maintained in a separate ECS directory and is not part of routine app releases
- daily releases only update the `rag-system` app image
- PostgreSQL and Redis data must remain untouched during app deploys
- GitHub Actions can now build a compressed app image archive and push it to ECS automatically

Recommended ECS directory split:

```text
/usr/pros/infra
/usr/pros/rag-system
```

## Current Deployment Boundary

Treat the two directories as separate responsibilities:

- `/usr/pros/infra`
  - long-lived PostgreSQL / Redis runtime
  - persistent volumes and passwords
  - updated only when infra itself must change
- `/usr/pros/rag-system`
  - app compose and app runtime env
  - safe place for normal app deploys

Normal releases should only touch `/usr/pros/rag-system`.

## First-Time Infra Setup

Use this only when creating the ECS infra layer for the first time, or when infra itself truly changes.

1. Copy `docker/infra/` to ECS, for example `/usr/pros/infra`
2. Copy `docker/infra/.env.example` to `/usr/pros/infra/.env`
3. Fill in strong values for:
   - `POSTGRES_PASSWORD`
   - `REDIS_PASSWORD`
   - optional `DOCKER_SHARED_NETWORK` if you do not want the default `rag-infra-net`
4. Start infra:

```bash
cd /usr/pros/infra
docker compose up -d
```

5. Verify:

```bash
docker compose ps
docker network inspect rag-infra-net
```

Expected containers:

- `infra-postgres`
- `infra-redis`

After this, infra should usually stay as-is.

## App Env Wiring

The app container should talk to infra over the shared Docker network:

```env
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@infra-postgres:5432/rag_system
DIRECT_URL=postgresql://postgres:<POSTGRES_PASSWORD>@infra-postgres:5432/rag_system

QUEUE_PROVIDER=redis
REDIS_URL=redis://default:<REDIS_PASSWORD>@infra-redis:6379

VECTOR_STORE_PROVIDER=pgvector
VECTOR_STORE_PGVECTOR_DIMENSIONS=1024
QUEUE_MAX_CONCURRENT_TASKS=1
```

App runtime env remains under the app checkout, for example:

```text
/usr/pros/rag-system/apps/api/.env.production
```

## Normal App Release

The normal release path does not redeploy infra.

### Option A: GitHub Actions auto deploy

The repository now includes `.github/workflows/deploy-offline-ecs.yml`.

It triggers on `push` to `master` and does this automatically:

1. build `rag-system:latest`
2. compress it to `.tar.gz`
3. upload the archive to ECS over SSH/SCP
4. load the image on ECS
5. run `docker compose up -d app` in `/usr/pros/rag-system`

Required GitHub secrets:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`
- `DEPLOY_PATH`
- `SSH_PORT` optional, default `22`
- `REMOTE_IMAGE_DIR` optional, default `/tmp/rag-system-deploy`

For the current ECS split, `DEPLOY_PATH` should point to the app directory, for example:

```text
/usr/pros/rag-system
```

### Option B: Manual offline deploy

If you want to deploy manually, upload the compressed app image archive and run:

```bash
gunzip -c rag-system-latest.tar.gz | docker load
cd /usr/pros/rag-system
docker compose up -d app
```

If your Docker build supports direct load from gzip-compressed input, `docker load -i rag-system-latest.tar.gz` may also work.

## Safety Rules

For normal releases, do not run infra lifecycle commands from the app release flow.

Avoid these in routine app deploys:

- `docker compose down -v`
- deleting PostgreSQL or Redis volumes
- recreating `/usr/pros/infra`
- changing infra passwords without coordinating app env updates
- pruning data directories by hand

Normal app deploys should be limited to:

```bash
cd /usr/pros/rag-system
docker compose up -d app
```

This keeps PostgreSQL and Redis data intact.

## When Infra Actually Needs an Update

Infra changes are rare and should be treated separately from app releases.

Only update `/usr/pros/infra` when one of these is true:

- PostgreSQL / Redis image version change
- infra compose change
- shared Docker network or volume layout change
- password rotation that requires infra restart
- init SQL or persistence policy change

In that case:

1. sync the updated `docker/infra/` contents to `/usr/pros/infra`
2. review volumes and env carefully
3. restart only the infra services that must change
4. verify app connectivity after the infra change

Do not bundle infra updates into normal app release runs.

## Minimal Release Checklist

- app image built from the intended commit
- ECS app directory is `/usr/pros/rag-system`
- app env is already present and correct
- `infra-postgres` is healthy
- `infra-redis` is healthy
- shared Docker network `rag-infra-net` exists
- deploy flow only touches the app container

## Recommended Long-Term Practice

- keep `infra` and `app` in separate ECS directories
- treat infra as a stable base, not part of each release
- use `deploy-offline-ecs.yml` for normal app deploys
- only touch `/usr/pros/infra` when infra itself changes
