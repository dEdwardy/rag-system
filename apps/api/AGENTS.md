# AGENTS.md

This file adds backend-specific rules for `apps/api`.
Apply it together with the repository-root `AGENTS.md`.

## Local Stack Notes

- NestJS application code lives in `src/`
- Prisma schema and seed flow live in `prisma/`
- fast feedback tests live in `test/` and are split by backend area
- `build` runs `prisma generate` before `nest build`, so schema-touching work should keep Prisma artifacts in mind

## Backend Priorities

Unless the task explicitly says otherwise, prioritize work in this order:

1. backend correctness
2. retrieval / answering quality
3. ingestion reliability
4. diagnostics / traceability / metadata clarity
5. frontend enablement
6. polish / refactor

Frontend work should usually support an already-defined backend capability, not lead it.

## Backend Execution Bias

- for complex but familiar backend work, prefer direct main-control execution and keep the scope narrow
- use subagents mainly for narrow supporting work such as codebase search, external reference lookup, audit mapping, or commit drafting
- prefer incremental backend progress over broad product reshaping

## High-Risk Areas

Use extra caution and keep changes especially small in these areas:

- ingestion pipelines
- retrieval logic
- answer generation / orchestration
- streaming behavior
- persistence / schema-related logic
- cross-package shared contracts

For these areas:

- prefer minimal diffs
- validate behavior with focused tests
- avoid opportunistic refactors
- review for regressions before closeout

## Backend Validation

Run the smallest relevant validation for the change.

Common commands:

```bash
pnpm --filter @rag-system/api test:fast
pnpm --filter @rag-system/api test:integration
pnpm --filter @rag-system/api test:e2e
pnpm build
pnpm lint
pnpm typecheck
```

Default validation policy:

- for day-to-day backend work, run the smallest focused test command that matches the changed area
- prefer focused scripts such as `test:fast:llm`, `test:fast:retrieval`, `test:fast:assistants`, `test:fast:documents`, or `test:fast:infra` when they match the touched area
- use broader `test:integration` or `test:e2e` mainly for closeout, broader cross-module verification, or behavior changes that cross boundaries
- cross-package changes should run `pnpm build` or the relevant package build
- avoid expensive full-suite validation when a smaller relevant check is sufficient for the current increment

Minimum expectation:

- every non-trivial change should have at least one relevant validation step
- behavior changes should validate behavior, not only types
- do not claim completion without stating what was validated

## Test Boundary Rule

Prefer source-first tests for the local fast feedback loop.

Rules:

- new API test files must use Vitest (`import { test } from 'vitest'`) and must not introduce `node:test`
- do not add new raw `node --test` validation commands; use `pnpm test:api:file -- test/<file>.test.js` or a focused Vitest command
- existing `node:test` files are legacy only; when touching one for behavior changes, prefer migrating it to Vitest in the same focused increment
- fast-lane, unit, and focused module tests should run against source code and should not require `dist/`
- integration and E2E tests may continue using the current build-aware or `dist/` startup path when they validate real API or application wiring
- do not add new `dist/` dependencies to tests that should belong to the fast lane
- when a test can reasonably be implemented as a fast focused test, prefer that over adding another heavy build-dependent test path
- any `dist/`-dependent validation should be treated as heavy validation by default

Heavy validation must remain serial.
Do not run multiple builds, full API suites, integration flows, or E2E flows in parallel.

## Prisma And Remote DB Safety

- treat Supabase or any shared remote database as high-risk by default
- default to read-only inspection for remote databases unless the user explicitly approves a write step
- never run `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` against Supabase or any shared remote database
- for approved remote schema rollout, use `prisma migrate deploy`
- before any remote schema change, prefer validating the migration locally or against a separate dev/staging database first
- call out destructive risk explicitly before running migrations or data backfills against a remote database
