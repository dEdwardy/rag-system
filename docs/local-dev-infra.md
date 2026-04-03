# Local Dev Infra

> 文档角色：`background`
> 当前使用方式：用于查看本地基础设施背景说明；具体当前运行步骤优先看 `docs/current-dev-setup.md`。

## Services

This project uses Docker Compose for local infrastructure:

- PostgreSQL on `localhost:5432`

## Start

```bash
docker compose up -d
```

## Stop

```bash
docker compose down
```

## Reset data

```bash
docker compose down -v
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

Redis is no longer part of the default local infra baseline. Queue runtime now defaults to Supabase `pgmq`, with PostgreSQL-backed queue fallback available when needed.
