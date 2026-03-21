# Chunk Window Context Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured `contextGroups` to ask responses so chunk-window expansion returns contiguous context segments while preserving the existing `retrievedChunks` contract.

**Architecture:** Keep chunk retrieval and citations backward-compatible, but add a grouping step after chunk-window expansion that merges adjacent chunks from the same document into deterministic context groups. Thread those groups through ask and answering so the API returns organized context and answering can prefer merged group text without changing persistence or frontend scope.

**Tech Stack:** NestJS, Prisma, Node test runner, existing ask/retrieval/answering services

---

### Task 1: Add failing retrieval tests for contiguous context grouping

**Files:**
- Modify: `apps/api/test/retrieval.test.js`

- [ ] Step 1: Write a failing test that verifies adjacent expanded chunks from the same document are grouped into one `contextGroup`.
- [ ] Step 2: Run `pnpm --filter @rag-system/api build` so the latest source is compiled before test execution.
- [ ] Step 3: Run `node --test apps/api/test/retrieval.test.js` and confirm failure is caused by missing `contextGroups`.
- [ ] Step 4: Add a second failing test that non-contiguous chunks remain separate groups and preserve `primaryChunkIds`.

### Task 2: Implement retrieval-side context grouping

**Files:**
- Modify: `apps/api/src/modules/retrieval/retrieval.service.ts`

- [ ] Step 1: Introduce a retrieval result shape that includes both `retrievedChunks` and `contextGroups`.
- [ ] Step 2: Add a focused helper that groups expanded chunks by `documentId` plus consecutive `chunkIndex`.
- [ ] Step 3: Build `mergedContent`, `chunkIds`, `primaryChunkIds`, `pageNumbers`, and `sectionTitles` deterministically in chunk order.
- [ ] Step 4: Keep the existing `retrievedChunks` data unchanged so current citations and callers are unaffected.
- [ ] Step 5: Re-run `node --test apps/api/test/retrieval.test.js` until the new grouping tests pass.

### Task 3: Add failing ask/answering tests for grouped context propagation

**Files:**
- Modify: `apps/api/test/ask-success.test.js`
- Modify: `apps/api/test/answering.test.js`

- [ ] Step 1: Write a failing ask-service test that expects `contextGroups` to be passed through retrieval, answering, and the final ask result.
- [ ] Step 2: Write a failing answering-service test that expects grouped merged context to be preferred when calling the LLM.
- [ ] Step 3: Run `node --test apps/api/test/ask-success.test.js apps/api/test/answering.test.js` and confirm both fail for the expected missing-field behavior.

### Task 4: Implement ask/answering support for context groups

**Files:**
- Modify: `apps/api/src/modules/assistants/ask-assistant.service.ts`
- Modify: `apps/api/src/modules/answering/answering.service.ts`

- [ ] Step 1: Extend ask flow to accept retrieval results containing both chunks and groups.
- [ ] Step 2: Pass `contextGroups` into answering while preserving chunk-based citation selection.
- [ ] Step 3: Update answering so LLM context prefers group `mergedContent`, but fallback behavior remains chunk-based when no groups exist.
- [ ] Step 4: Return `contextGroups` from `POST /assistants/:id/ask` alongside existing fields.
- [ ] Step 5: Re-run `node --test apps/api/test/ask-success.test.js apps/api/test/answering.test.js` until they pass.

### Task 5: Add API regression coverage and document the additive response

**Files:**
- Modify: `apps/api/test/api-flow.test.js`
- Modify: `docs/current-progress.md`
- Modify: `docs/current-dev-setup.md`

- [ ] Step 1: Write a failing HTTP integration assertion that `ask` responses include `contextGroups` and preserve `retrievedChunks`.
- [ ] Step 2: Run `node --test --test-concurrency=1 apps/api/test/api-flow.test.js` and confirm the new assertion fails before the implementation is complete.
- [ ] Step 3: Make only the minimal implementation adjustments needed so the integration assertion passes.
- [ ] Step 4: Update progress/setup docs with the new chunk-window grouping capability and response field.

### Task 6: Verify and prepare delivery

**Files:**
- Modify: `docs/current-progress.md`

- [ ] Step 1: Run the smallest sufficient verification:
  - `pnpm --filter @rag-system/api build`
  - `node --test apps/api/test/retrieval.test.js apps/api/test/ask-success.test.js apps/api/test/answering.test.js`
  - `node --test --test-concurrency=1 apps/api/test/api-flow.test.js`
- [ ] Step 2: If focused verification exposes unexpected regressions, run `pnpm test:api` before commit.
- [ ] Step 3: Record the exact validation commands and results in the final handoff.
