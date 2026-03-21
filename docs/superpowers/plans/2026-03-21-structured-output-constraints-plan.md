# Structured Output Constraints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit schema validation and normalization for structured LLM answer output.

**Architecture:** Introduce a dedicated structured-answer schema in the LLM infra layer, validate provider JSON candidates against it, and keep the current plain-text fallback path unchanged when schema validation fails.

**Tech Stack:** NestJS, TypeScript, Zod, node:test

---

### Task 1: Lock the structured-output constraints with failing tests

**Files:**
- Modify: `apps/api/test/llm.test.js`

- [ ] Step 1: Write a failing test proving structured answer JSON is normalized through an explicit schema.
- [ ] Step 2: In that test, assert numeric-string citations are coerced into integers and deduplicated.
- [ ] Step 3: Write a failing test proving blank `missingInformation` values are removed.
- [ ] Step 4: Write a failing test proving malformed structured payloads still fall back to plain-text citation extraction.

### Task 2: Implement the structured-answer schema and integrate it

**Files:**
- Create: `apps/api/src/infra/llm/structured-answer.schema.ts`
- Modify: `apps/api/src/infra/llm/llm.service.ts`

- [ ] Step 1: Add a strict schema for `answer`, `status`, `citations`, and `missingInformation`.
- [ ] Step 2: Normalize citations into unique positive integers.
- [ ] Step 3: Normalize `missingInformation` into a trimmed non-empty string array.
- [ ] Step 4: Use the schema inside `tryParseStructuredAnswer()`.
- [ ] Step 5: Keep the plain-text fallback path unchanged for invalid payloads.

### Task 3: Update docs and verify

**Files:**
- Modify: `docs/current-progress.md`
- Modify: `docs/current-dev-setup.md`

- [ ] Step 1: Mark `输出结构约束` complete in `docs/current-progress.md`.
- [ ] Step 2: Add a concise note in `docs/current-dev-setup.md` that structured answer JSON is now schema-validated and normalized.
- [ ] Step 3: Run minimal sufficient verification:
  - `pnpm --filter @rag-system/api build`
  - `node --test apps/api/test/llm.test.js`
  - `pnpm test:api`
- [ ] Step 4: Commit and push the task-specific files.
