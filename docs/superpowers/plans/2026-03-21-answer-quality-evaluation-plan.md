# Answer Quality Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic answer-quality evaluation object to ask responses and trace persistence using existing backend answer/retrieval signals.

**Architecture:** Keep evaluation local to the backend ask pipeline. `AnsweringService` will compute a small normalized `qualityEvaluation` object from answer status, citations, missing-information, and retrieval signals; `AskAssistantService` will return and persist it; traces will expose it through the existing endpoints via a new JSON column.

**Tech Stack:** NestJS, Prisma, PostgreSQL JSONB, node:test

---

### Task 1: Lock Expected Quality Evaluation Behavior With Failing Tests

**Files:**
- Modify: `apps/api/test/answering.test.js`
- Modify: `apps/api/test/ask-success.test.js`
- Modify: `apps/api/test/api-flow.test.js`

- [ ] **Step 1: Add a failing strong-quality test**

Extend `apps/api/test/answering.test.js` so a grounded answer with citations and no missing information returns:

- `overall: "strong"`
- `grounding: "grounded"`
- `completeness: "complete"`

- [ ] **Step 2: Add a failing partial-quality test**

Assert that grounded answers with non-empty `missingInformation` return:

- `overall: "partial"`
- `completeness: "partial"`
- `flags` containing `missing_information`

- [ ] **Step 3: Add a failing weak-quality test**

Assert that insufficient-context answers with no supporting chunks return:

- `overall: "weak"`
- `grounding: "ungrounded"`
- `completeness: "insufficient"`

- [ ] **Step 4: Add ask orchestration expectations**

Extend `apps/api/test/ask-success.test.js` so the final ask result includes `qualityEvaluation` and the trace update persists `qualityEvaluationJson`.

- [ ] **Step 5: Add integration assertions**

Extend `apps/api/test/api-flow.test.js` so:

- ask response includes `qualityEvaluation`
- `GET /traces/:id` includes `qualityEvaluationJson`

- [ ] **Step 6: Run focused tests and verify RED**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js
```

Expected: FAIL because quality evaluation is not implemented yet.

### Task 2: Add Persistence For Trace Quality Evaluation

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260321170000_add_answer_trace_quality_evaluation/migration.sql`

- [ ] **Step 1: Add optional JSON field to `AnswerTrace`**

Add `qualityEvaluationJson Json?` to the Prisma model.

- [ ] **Step 2: Add migration SQL**

Create a migration that adds `qualityEvaluationJson` as a nullable `JSONB` column.

- [ ] **Step 3: Rebuild Prisma client through project build flow**

Run:

```bash
pnpm --filter @rag-system/api build
```

Expected: PASS

### Task 3: Implement Deterministic Quality Evaluation

**Files:**
- Modify: `apps/api/src/modules/answering/answering.service.ts`
- Modify: `apps/api/src/modules/assistants/ask-assistant.service.ts`
- Modify: `apps/api/src/modules/traces/traces.service.ts`

- [ ] **Step 1: Add normalized quality evaluation computation**

Have `AnsweringService.generateAnswer()` return:

- `qualityEvaluation.overall`
- `qualityEvaluation.grounding`
- `qualityEvaluation.completeness`
- `qualityEvaluation.flags`
- `qualityEvaluation.summary`

- [ ] **Step 2: Base quality rules on existing backend signals only**

Use:

- `answerStatus`
- `missingInformation`
- citation count
- top retrieval score / retrieval presence

Keep thresholds simple and deterministic.

- [ ] **Step 3: Return and persist the quality evaluation**

Update `AskAssistantService` so `qualityEvaluation` is returned from ask responses and persisted into `qualityEvaluationJson` on trace updates.

- [ ] **Step 4: Ensure trace service accepts the new JSON field**

Update trace create/update typings as needed.

- [ ] **Step 5: Re-run focused tests**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js
```

Expected: PASS

### Task 4: Prove Main HTTP Path Still Works

**Files:**
- Modify: `apps/api/test/api-flow.test.js`

- [ ] **Step 1: Run integration regression**

Run:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/api-flow.test.js
```

Expected: PASS with `qualityEvaluation` included in ask and trace payloads.

### Task 5: Sync Docs, Commit, And Push

**Files:**
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update setup docs**

Document the new ask/trace quality evaluation fields.

- [ ] **Step 2: Update progress**

Mark `回答质量评估` complete and add the new spec/plan documents to the recent completed increments section.

- [ ] **Step 3: Run final verification**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js
node --test --test-concurrency=1 apps/api/test/api-flow.test.js
```

- [ ] **Step 4: Commit and push only task-related files**

Run:

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260321170000_add_answer_trace_quality_evaluation/migration.sql apps/api/src/modules/answering/answering.service.ts apps/api/src/modules/assistants/ask-assistant.service.ts apps/api/src/modules/traces/traces.service.ts apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/api-flow.test.js docs/current-dev-setup.md docs/current-progress.md docs/superpowers/specs/2026-03-21-answer-quality-evaluation-design.md docs/superpowers/plans/2026-03-21-answer-quality-evaluation-plan.md
git commit -m "feat(api): add answer quality evaluation"
git push
```
