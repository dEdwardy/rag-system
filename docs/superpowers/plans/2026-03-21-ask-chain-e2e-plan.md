# Ask Chain E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated backend/API end-to-end test for the ask workflow and sync progress/setup docs to match the new coverage.

**Architecture:** Keep the existing NestJS app and ask HTTP contract unchanged. Add one focused integration test that treats the ask pipeline as the unit under test, using isolated runtime state the same way the current API integration tests do. Update only the docs that describe progress and validation commands.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Redis/BullMQ, Node test runner

---

## File Structure

### New files to create

- `apps/api/test/ask-chain-e2e.test.js`
  - Dedicated HTTP integration test for `upload -> ready -> ask -> conversation/traces -> reindex -> ask`

### Existing files to modify

- `docs/current-dev-setup.md`
  - Add the focused command for the new ask-chain E2E test
- `docs/current-progress.md`
  - Mark the task complete and record the new validation coverage

### Existing files to reference

- `apps/api/test/api-flow.test.js`
- `apps/api/test/document-chain-e2e.test.js`
- `apps/api/src/modules/assistants/ask-assistant.service.ts`
- `apps/api/src/modules/traces/traces.service.ts`

### Explicit non-goals

- No frontend changes
- No mobile adaptation work
- No broad test-helper refactor
- No retrieval/answering redesign beyond what the new test reveals

---

### Task 1: Add Dedicated Ask-Chain E2E Coverage

**Files:**
- Create: `apps/api/test/ask-chain-e2e.test.js`
- Reference: `apps/api/test/api-flow.test.js`
- Reference: `apps/api/test/document-chain-e2e.test.js`

- [ ] **Step 1: Write the failing ask-chain E2E test**

Create a Node test that covers this sequence through real HTTP endpoints:

- upload a markdown file with a unique marker
- poll `GET /documents/:id` until `ready`
- call `POST /assistants/default-assistant/ask`
- inspect `GET /conversations/:id/messages`
- inspect `GET /conversations/:id/traces`
- inspect `GET /traces/:id`
- call `POST /assistants/default-assistant/ask` again with the same `conversationId`
- call `POST /documents/:id/reindex`
- wait until `ready`
- call `POST /assistants/default-assistant/ask` a third time with the same `conversationId`

Use assertions that lock down:

- conversation reuse
- trace persistence
- marker presence in retrieved chunks/context groups
- message count growth across asks

- [ ] **Step 2: Run the new test to verify RED**

Run:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/ask-chain-e2e.test.js
```

Expected:
- FAIL because the new file is not implemented yet or because one of the richer ask-chain assertions exposes a real gap

- [ ] **Step 3: Make the smallest implementation adjustment only if the failing test reveals a real product gap**

Prefer no production changes. If the new test exposes an actual ask-path defect, keep the fix narrowly scoped to the touched backend surface.

- [ ] **Step 4: Re-run the focused ask-chain E2E test**

Run:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/ask-chain-e2e.test.js
```

Expected:
- PASS

---

### Task 2: Sync Docs For The Completed Increment

**Files:**
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update setup docs with the focused command**

Add the new focused command under the API validation section:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/ask-chain-e2e.test.js
```

- [ ] **Step 2: Update progress to mark the current first unchecked task complete**

In `docs/current-progress.md`:

- mark `鏇村畬鏁寸殑 ask 閾捐矾 E2E` complete
- add a concise note in the recent progress section describing the new dedicated ask-chain E2E coverage
- keep later unchecked tasks still unchecked

- [ ] **Step 3: Run the focused verification again after doc updates**

Run:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/ask-chain-e2e.test.js
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
node --test --test-concurrency=1 apps/api/test/ask-chain-e2e.test.js
```

- [ ] Confirm scope boundaries remain intact:

- backend/API only
- PC Web priority unchanged
- no frontend/mobile work
- no unrelated refactor
