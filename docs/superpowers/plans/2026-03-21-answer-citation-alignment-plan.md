# Answer Citation Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make returned citation snippets align to model-selected evidence through a structured quote contract with safe backend validation and fallback behavior.

**Architecture:** Extend the answering prompt/schema so the model can emit citation evidence objects, then validate each quote against the exact retrieved source before using it as the returned snippet. Keep the existing response shape and preserve numeric-citation fallback paths when structured evidence is absent or invalid.

**Tech Stack:** NestJS, Zod, node:test, existing backend answering pipeline

---

### Task 1: Lock The New Citation Contract With Failing Tests

**Files:**
- Modify: `apps/api/test/llm.test.js`
- Modify: `apps/api/test/answering.test.js`

- [ ] **Step 1: Add a failing LLM parsing test**

Extend `apps/api/test/llm.test.js` to assert that structured answer JSON can include citation evidence objects, for example:

```json
{
  "answer": "Structured answer",
  "status": "grounded",
  "citations": [1],
  "citationEvidence": [{ "source": 1, "quote": "retrieved content marker" }],
  "missingInformation": []
}
```

and that `LlmService.generateAnswer()` returns normalized evidence data.

- [ ] **Step 2: Add a failing aligned-snippet test**

Extend `apps/api/test/answering.test.js` to assert that when the model returns valid citation evidence, `AnsweringService.generateAnswer()` uses the validated quote as the returned `snippet`.

- [ ] **Step 3: Add a failing invalid-quote fallback test**

Assert that if the model claims source `[1]` but provides a quote not found in source `[1]`, the backend rejects that quote and falls back to a deterministic source-local snippet.

- [ ] **Step 4: Run the focused tests and verify RED**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/llm.test.js apps/api/test/answering.test.js
```

Expected: FAIL because structured citation evidence is not implemented yet.

### Task 2: Implement Structured Citation Evidence Parsing

**Files:**
- Modify: `apps/api/src/infra/llm/structured-answer.schema.ts`
- Modify: `apps/api/src/infra/llm/llm.types.ts`
- Modify: `apps/api/src/infra/llm/prompt-manager.service.ts`
- Modify: `apps/api/src/infra/llm/llm.service.ts`

- [ ] **Step 1: Extend the structured answer schema**

Add a `citationEvidence` array schema with:

- `source`: positive 1-based citation index
- `quote`: trimmed non-empty string

and normalize duplicates conservatively.

- [ ] **Step 2: Extend LLM types**

Update `GenerateAnswerOutput` to expose normalized citation evidence.

- [ ] **Step 3: Update the answer prompt**

Ask the model to return `citationEvidence` objects and require each `quote` to be copied verbatim from the cited source.

- [ ] **Step 4: Parse and return the new structured data**

Update `LlmService` so structured JSON answers surface citation evidence when present while preserving current fallback behavior for plain-text answers.

- [ ] **Step 5: Re-run focused tests**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/llm.test.js apps/api/test/answering.test.js
```

Expected: some tests may still fail until answer-side validation is implemented.

### Task 3: Align Returned Snippets To Validated Evidence

**Files:**
- Modify: `apps/api/src/modules/answering/answering.service.ts`
- Modify: `apps/api/test/answering.test.js`

- [ ] **Step 1: Validate citation evidence against the cited source**

For each cited source, accept a quote only if its normalized text exists in the same source content used for answering.

- [ ] **Step 2: Prefer validated quotes in returned citations**

Use the validated quote as `snippet` when available; otherwise keep deterministic backend fallback snippet generation from that same source.

- [ ] **Step 3: Preserve existing numeric fallback behavior**

Keep current source selection behavior for answers that only provide citation numbers or inline markers.

- [ ] **Step 4: Re-run focused tests**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/llm.test.js apps/api/test/answering.test.js
```

Expected: PASS

### Task 4: Prove Main Ask Flow Still Works

**Files:**
- Modify: `apps/api/test/api-flow.test.js` (only if assertions need extension)

- [ ] **Step 1: Check whether the current integration assertions already cover the unchanged API shape**

If needed, add a small assertion that each returned citation still includes a string `snippet`.

- [ ] **Step 2: Run the integration regression**

Run:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/api-flow.test.js
```

Expected: PASS

### Task 5: Sync Docs, Commit, And Push

**Files:**
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update docs**

Document that ask citations now prefer validated source quotes when available.

- [ ] **Step 2: Mark the progress item complete**

Mark `引用片段与答案的严格结构化对齐` complete in `docs/current-progress.md` and add a short entry to the recent completed increments list.

- [ ] **Step 3: Run final verification**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/llm.test.js apps/api/test/answering.test.js
node --test --test-concurrency=1 apps/api/test/api-flow.test.js
```

- [ ] **Step 4: Commit and push only task-related files**

Run:

```bash
git add docs/current-dev-setup.md docs/current-progress.md docs/superpowers/specs/2026-03-21-answer-citation-alignment-design.md docs/superpowers/plans/2026-03-21-answer-citation-alignment-plan.md apps/api/src/infra/llm/structured-answer.schema.ts apps/api/src/infra/llm/llm.types.ts apps/api/src/infra/llm/prompt-manager.service.ts apps/api/src/infra/llm/llm.service.ts apps/api/src/modules/answering/answering.service.ts apps/api/test/llm.test.js apps/api/test/answering.test.js apps/api/test/api-flow.test.js
git commit -m "feat(api): align answer citations to source quotes"
git push
```
