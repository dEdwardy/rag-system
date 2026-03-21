# Retrieval And Answering Execution Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stable retrieval and answering execution metadata to ask responses and persisted traces so future pipeline evolution has an explicit backend contract.

**Architecture:** Extend `AnswerTrace` with additive JSON metadata fields, propagate prompt ids through the LLM boundary, shape normalized execution metadata in the ask and answering services, and lock the behavior with focused unit and integration tests before broader validation.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Node test runner, Zod

---

### Task 1: Lock Metadata Behavior With Failing Tests

**Files:**
- Modify: `apps/api/test/answering.test.js`
- Modify: `apps/api/test/ask-success.test.js`
- Modify: `apps/api/test/api-flow.test.js`
- Modify: `apps/api/test/ask-chain-e2e.test.js`

- [ ] Add unit assertions for `AnsweringService` metadata shaping.
- [ ] Add unit assertions for `AskAssistantService` retrieval/answering metadata persistence and response output.
- [ ] Add integration assertions for the new trace metadata JSON fields.
- [ ] Run focused tests and confirm they fail for the expected missing metadata reasons.

### Task 2: Extend Schema And Persistence

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260321193000_add_answer_trace_execution_metadata/migration.sql`
- Modify: `apps/api/src/modules/traces/traces.service.ts`

- [ ] Add additive `retrievalMetadataJson` and `answeringMetadataJson` fields to `AnswerTrace`.
- [ ] Create the Prisma migration.
- [ ] Extend trace create/update helpers to accept the new fields.
- [ ] Apply the migration locally.

### Task 3: Propagate Prompt Metadata Through LLM And Answering Layers

**Files:**
- Modify: `apps/api/src/infra/llm/llm.types.ts`
- Modify: `apps/api/src/infra/llm/llm.service.ts`
- Modify: `apps/api/src/modules/answering/answering.service.ts`

- [ ] Add `promptId` to answer and rewrite outputs.
- [ ] Return prompt ids consistently for provider and fallback paths.
- [ ] Have `AnsweringService` return normalized `answeringMetadata`.
- [ ] Run focused unit tests and confirm they pass.

### Task 4: Persist And Return Retrieval/Answering Execution Metadata

**Files:**
- Modify: `apps/api/src/modules/assistants/ask-assistant.service.ts`
- Modify: `apps/api/test/ask-success.test.js`
- Modify: `apps/api/test/api-flow.test.js`
- Modify: `apps/api/test/ask-chain-e2e.test.js`

- [ ] Build normalized retrieval metadata from resolved strategy, rewrite result, filters, and retrieval outcome.
- [ ] Store retrieval metadata on trace creation and update.
- [ ] Persist answering metadata on successful trace update.
- [ ] Return both metadata objects from the ask response.
- [ ] Re-run focused orchestration and integration tests.

### Task 5: Validate, Update Docs, And Finish The Task

**Files:**
- Modify: `docs/current-progress.md`
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/retrieval-trace.md`

- [ ] Update docs to describe the new trace metadata fields and validated flow.
- [ ] Mark the current `retrieval / answering systematic evolution` task complete in `docs/current-progress.md`.
- [ ] Run `pnpm --filter @rag-system/api build`.
- [ ] Run `pnpm test:api`.
- [ ] Check `git status --short`, stage only task files, commit, and push.
