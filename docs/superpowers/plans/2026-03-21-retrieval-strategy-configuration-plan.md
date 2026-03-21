# Retrieval Strategy Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backward-compatible `RetrievalProfile.strategyJson` contract that controls query rewrite, retrieval mode, candidate pool sizing, hybrid weights, and rerank behavior.

**Architecture:** Keep existing retrieval profile fields intact, add a validated optional `strategyJson`, and resolve one internal retrieval strategy object in the ask flow before calling retrieval. Retrieval service then uses that resolved object to choose lexical/vector/hybrid behavior and scoring while preserving current defaults for legacy profiles.

**Tech Stack:** NestJS, Prisma, Zod, Node test runner, PostgreSQL, file-backed vector store

---

### Task 1: Define and persist retrieval strategy configuration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts`
- Modify: `apps/api/src/modules/retrieval-profiles/retrieval-profiles.service.ts`
- Test: `apps/api/test/retrieval-profile-strategy.test.js`

- [ ] Step 1: Write a failing HTTP test that patches `strategyJson` onto the default retrieval profile and expects the normalized response shape.
- [ ] Step 2: Add nullable `strategyJson` to Prisma `RetrievalProfile`.
- [ ] Step 3: Add strict zod validation for `strategyJson` and export a resolver that combines legacy fields with strategy overrides.
- [ ] Step 4: Persist `strategyJson` through create/update retrieval profile service methods without changing existing field behavior.

### Task 2: Add failing retrieval and ask orchestration coverage

**Files:**
- Modify: `apps/api/test/retrieval.test.js`
- Modify: `apps/api/test/ask-success.test.js`

- [ ] Step 1: Write a failing retrieval test proving lexical mode skips embedding/vector calls.
- [ ] Step 2: Write a failing retrieval test proving hybrid candidate ordering follows configured weights.
- [ ] Step 3: Write a failing ask-flow test proving query rewrite can be disabled by strategy.
- [ ] Step 4: In the same ask-flow test, assert the resolved strategy is forwarded into retrieval instead of legacy booleans alone.

### Task 3: Implement resolved strategy handling in ask and retrieval

**Files:**
- Modify: `apps/api/src/modules/assistants/ask-assistant.service.ts`
- Modify: `apps/api/src/modules/retrieval/retrieval.service.ts`

- [ ] Step 1: Resolve one effective retrieval strategy from retrieval profile fields plus `strategyJson`.
- [ ] Step 2: Skip `rewriteQuery` when the resolved strategy disables it.
- [ ] Step 3: Thread the resolved strategy into retrieval calls.
- [ ] Step 4: Update retrieval mode selection, candidate limit calculation, and hybrid merge weighting to use the resolved strategy.
- [ ] Step 5: Preserve current fallback behavior for legacy profiles and vector failures.

### Task 4: Add end-to-end regression coverage for strategyJson

**Files:**
- Create: `apps/api/test/retrieval-profile-strategy.test.js`

- [ ] Step 1: Write a failing integration test that patches `strategyJson` with `queryRewrite.enabled = false` and `candidateSelection.mode = lexical`.
- [ ] Step 2: Ask through the default assistant and verify retrieval succeeds.
- [ ] Step 3: Fetch the created trace and verify `rewrittenQuery` is still `null`.
- [ ] Step 4: Re-run the single integration test until it passes.

### Task 5: Document, verify, and prepare delivery

**Files:**
- Modify: `docs/current-progress.md`
- Modify: `docs/current-dev-setup.md`

- [ ] Step 1: Mark retrieval strategy configuration/evolution complete in `docs/current-progress.md`.
- [ ] Step 2: Add a concise `strategyJson` note to `docs/current-dev-setup.md`.
- [ ] Step 3: Run the smallest sufficient verification:
  - `pnpm --filter @rag-system/api build`
  - `node --test apps/api/test/retrieval.test.js apps/api/test/ask-success.test.js`
  - `node --test --test-concurrency=1 apps/api/test/retrieval-profile-strategy.test.js`
- [ ] Step 4: If needed after focused failures or schema changes, run `pnpm test:api`.
- [ ] Step 5: Commit and push once verification is green.
