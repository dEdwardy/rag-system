# Document Chain E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated backend/API end-to-end test for the document workflow and sync progress/setup docs to match the new coverage.

**Architecture:** Keep the existing NestJS app and HTTP contracts unchanged. Add one focused integration test that treats the document pipeline as the unit under test, using isolated runtime state the same way the current API integration tests do. Update only the docs that describe progress and validation commands.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Redis/BullMQ, Node test runner

---

## File Structure

### New files to create

- `apps/api/test/document-chain-e2e.test.js`
  - Dedicated HTTP integration test for `Knowledge Base -> Documents -> Ingestion -> Reindex -> Delete`

### Existing files to modify

- `docs/current-dev-setup.md`
  - Add the focused command for the new document-chain E2E test
- `docs/current-progress.md`
  - Mark the task complete and record the new validation coverage

### Existing files to reference

- `apps/api/test/api-flow.test.js`
- `apps/api/src/modules/documents/documents.controller.ts`
- `apps/api/src/modules/documents/documents.service.ts`
- `apps/api/src/modules/ingestion/ingestion.service.ts`

### Explicit non-goals

- No ask-path assertions
- No frontend changes
- No broad test-helper refactor
- No mobile work

---

### Task 1: Add Dedicated Document-Chain E2E Coverage

**Files:**
- Create: `apps/api/test/document-chain-e2e.test.js`
- Reference: `apps/api/test/api-flow.test.js`

- [ ] **Step 1: Write the failing document-chain E2E test**

Create a Node test that covers this sequence through real HTTP endpoints:

- `GET /knowledge-bases/default-kb`
- `GET /knowledge-bases/default-kb/documents`
- `POST /knowledge-bases/default-kb/documents/upload`
- poll `GET /documents/:id` until `ready`
- `GET /knowledge-bases/default-kb/documents`
- `GET /documents/:id/chunks`
- `POST /documents/:id/reindex`
- poll `GET /documents/:id` until `ready`
- `DELETE /documents/:id`
- verify `GET /documents/:id` and `GET /documents/:id/chunks` return `404`

Use a unique marker in the uploaded markdown so chunk assertions are deterministic.

- [ ] **Step 2: Run the new test to verify RED**

Run:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js
```

Expected:
- FAIL because the new test file is not implemented yet or because one of the new assertions exposes a real gap

- [ ] **Step 3: Make the smallest implementation adjustment only if the failing test reveals a real product gap**

Prefer no production changes. If a real gap appears, keep the fix narrowly scoped to the touched document workflow surface.

- [ ] **Step 4: Re-run the focused document-chain E2E test**

Run:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js
```

Expected:
- PASS

---

### Task 2: Sync Docs For The Completed Increment

**Files:**
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update setup docs with the focused command**

Add the new focused command under the API/web validation section:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js
```

- [ ] **Step 2: Update progress to mark the current first unchecked task complete**

In `docs/current-progress.md`:

- mark `更完整的文档链路 E2E` complete
- keep `更完整的 ask 链路 E2E` unchecked
- add a concise note in the recent progress section describing the new dedicated document-chain E2E coverage

- [ ] **Step 3: Run the focused verification again after doc updates**

Run:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js
```

Expected:
- PASS

---

## Final Verification

- [ ] Run:

```bash
pnpm --filter @rag-system/api build
```

- [ ] Run:

```bash
node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js
```

- [ ] Confirm scope boundaries remain intact:

- backend/API only
- no ask E2E implementation
- no frontend changes
- no unrelated refactor
