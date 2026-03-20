# Retrieval Profile Metadata Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable retrieval-profile-driven metadata filters for backend retrieval and ask flow without touching the unfinished frontend work.

**Architecture:** Add a small validated `filtersJson` contract on retrieval profiles, thread it through ask to retrieval, and apply the same filter semantics in Prisma-backed lexical retrieval and file-backed vector retrieval. Keep behavior unchanged when filters are absent.

**Tech Stack:** NestJS, Prisma, Zod, Node test runner, file-backed vector store

---

### Task 1: Define and persist validated retrieval profile filters

**Files:**
- Modify: `apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts`
- Modify: `apps/api/src/modules/retrieval-profiles/retrieval-profiles.service.ts`

- [ ] Step 1: Add a failing test expectation later consumed by API/integration coverage that `filtersJson` is accepted and normalized.
- [ ] Step 2: Extend zod schemas with a strict metadata filter object containing optional `documentIds`, `sectionTitles`, and `pageNumbers` arrays.
- [ ] Step 3: Normalize empty arrays to omission so persistence stays compact.
- [ ] Step 4: Persist normalized `filtersJson` on create and update.

### Task 2: Add failing retrieval tests for metadata filter behavior

**Files:**
- Modify: `apps/api/test/retrieval.test.js`

- [ ] Step 1: Write a failing test for lexical retrieval constrained by `documentIds`.
- [ ] Step 2: Run `node --test apps/api/test/retrieval.test.js` after build and confirm failure is due to missing filter support.
- [ ] Step 3: Write a failing test for vector retrieval constrained by `sectionTitles` and `pageNumbers`.
- [ ] Step 4: Write a failing test for fallback retrieval remaining inside the configured filter scope.

### Task 3: Implement metadata filter compilation and retrieval enforcement

**Files:**
- Modify: `apps/api/src/modules/retrieval/retrieval.service.ts`
- Modify: `apps/api/src/infra/vector-store/vector-store.service.ts`
- Modify: `apps/api/src/modules/assistants/ask-assistant.service.ts`

- [ ] Step 1: Add a shared local type in retrieval service for the supported metadata filters.
- [ ] Step 2: Thread filters through `retrieve`, lexical fallback, candidate queries, and chunk-window expansion.
- [ ] Step 3: Compile filters into Prisma `where` fragments for `DocumentChunk.findMany`.
- [ ] Step 4: Add vector store filtering against stored record metadata fields.
- [ ] Step 5: Pass `assistant.retrievalProfile.filtersJson` from ask flow into retrieval.
- [ ] Step 6: Re-run retrieval tests and make them pass with minimal code changes.

### Task 4: Add API-level regression coverage

**Files:**
- Add: `apps/api/test/retrieval-profile-filters.test.js`

- [ ] Step 1: Write a failing HTTP integration test that patches `default-retrieval-profile` with `filtersJson`, asks through `default-assistant`, and expects only filtered chunks.
- [ ] Step 2: Run the single test after build and confirm it fails for the expected reason before implementation is complete.
- [ ] Step 3: Adjust implementation only as needed until the test passes.

### Task 5: Document and verify

**Files:**
- Modify: `docs/current-progress.md`

- [ ] Step 1: Add a concise progress update noting retrieval profile metadata filter support and its first supported keys.
- [ ] Step 2: Run the smallest sufficient validation:
  - `pnpm --filter @rag-system/api build`
  - `node --test apps/api/test/retrieval.test.js apps/api/test/retrieval-profile-filters.test.js`
- [ ] Step 3: If targeted validation passes, optionally run `pnpm test:api` only if a change unexpectedly affects broader API behavior.
- [ ] Step 4: Summarize the exact commands and results in the final handoff.
