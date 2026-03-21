# Retrieval Filter Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend backend retrieval metadata filters beyond exact allowlists with a backward-compatible strategy model that stays local to the API retrieval flow.

**Architecture:** Keep the existing `filtersJson` entry point, but normalize each filter field into a richer internal strategy shape. Preserve legacy array input for compatibility, compile the normalized strategy into Prisma and vector-store predicates, and cover the new behavior with retrieval and API regression tests before updating progress docs.

**Tech Stack:** NestJS, Prisma, Zod, Node test runner, file-backed vector store

---

### Task 1: Define a backward-compatible filter strategy contract

**Files:**
- Modify: `apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts`
- Test: `apps/api/test/assistants-api.test.js`

- [ ] Step 1: Write a failing API-level test that patches a retrieval profile using strategy-shaped `filtersJson` and expects the normalized response shape.
- [ ] Step 2: Extend the schema so legacy arrays remain valid while each field may also accept a strategy object.
- [ ] Step 3: Normalize legacy arrays into strategy objects so downstream retrieval code has one internal contract.
- [ ] Step 4: Reject unknown strategy keys and invalid operator combinations with existing zod validation.

### Task 2: Add failing retrieval tests for the new strategy semantics

**Files:**
- Modify: `apps/api/test/retrieval.test.js`
- Modify: `apps/api/test/ask-success.test.js`

- [ ] Step 1: Write a failing retrieval test for section-title `contains` matching.
- [ ] Step 2: Write a failing retrieval test for page-number `min` / `max` range filtering.
- [ ] Step 3: Write a failing retrieval test for `exclude` semantics so filtered-out chunks never appear in lexical fallback.
- [ ] Step 4: Update ask-flow unit coverage to assert normalized strategy filters are passed from assistant config into retrieval.

### Task 3: Implement filter strategy compilation in retrieval and vector search

**Files:**
- Modify: `apps/api/src/modules/retrieval/retrieval.service.ts`
- Modify: `apps/api/src/infra/vector-store/vector-store.service.ts`
- Modify: `apps/api/src/modules/assistants/ask-assistant.service.ts`

- [ ] Step 1: Introduce a normalized internal filter type shared by schema, retrieval, and vector-store usage.
- [ ] Step 2: Compile strategy filters into Prisma `where` clauses for lexical candidate queries and chunk-window expansion.
- [ ] Step 3: Apply the same semantics in vector-store record filtering, including case-insensitive `contains` matching and page ranges.
- [ ] Step 4: Keep legacy exact-allowlist behavior working via normalization instead of parallel code paths.
- [ ] Step 5: Re-run focused retrieval and ask-flow tests until they pass.

### Task 4: Add HTTP regression coverage for strategy filters

**Files:**
- Modify: `apps/api/test/retrieval-profile-filters.test.js`

- [ ] Step 1: Write a failing integration test that patches a retrieval profile with strategy filters, asks through the default assistant, and expects only chunks inside the strategy scope.
- [ ] Step 2: Use a scenario that exercises at least one new operator instead of only legacy `documentIds`.
- [ ] Step 3: Re-run the single integration test until it passes with the final implementation.

### Task 5: Document, verify, and prepare delivery

**Files:**
- Modify: `docs/current-progress.md`

- [ ] Step 1: Mark the retrieval metadata-filter strategy enhancement complete with a short note about the new supported operators.
- [ ] Step 2: Update the recent validation snapshot with the focused commands used in this session.
- [ ] Step 3: Run the smallest sufficient verification:
  - `pnpm --filter @rag-system/api build`
  - `node --test apps/api/test/retrieval.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js`
  - `node --test --test-concurrency=1 apps/api/test/retrieval-profile-filters.test.js`
- [ ] Step 4: If the focused verification exposes broader regression risk, run `pnpm test:api` before commit and push.
