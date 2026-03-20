# Local Dev Infra

## Services

This project uses Docker Compose for local infrastructure:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

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

Redis:

- host: `localhost`
- port: `6379`
- password: none

Redis URL:

```text
redis://localhost:6379
```
