# Main Chain Test Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen backend/API main-path regression coverage around upload -> ingestion -> indexing -> retrieval -> ask -> trace without expanding scope into DOCX or frontend work.

**Architecture:** Keep the existing NestJS modules and current HTTP contract intact. Add focused orchestrator-level tests for ingestion and ask services, then deepen the existing real HTTP integration flow so it verifies more of the persisted chain instead of only checking a minimal happy path.

**Tech Stack:** NestJS, Prisma, BullMQ, Node test runner, TypeScript, PostgreSQL, Redis

---

## File Structure

### Existing files to modify

- `apps/api/test/api-flow.test.js`
- `docs/current-progress.md`

### New files to create

- `apps/api/test/ingestion.orchestrator.test.js`
- `apps/api/test/ask-success.test.js`

### Existing files to reference

- `apps/api/src/modules/ingestion/ingestion.service.ts`
- `apps/api/src/modules/indexing/indexing.service.ts`
- `apps/api/src/modules/assistants/ask-assistant.service.ts`
- `apps/api/test/ask-failures.test.js`

### Explicit non-goals

- No DOCX parsing work
- No answering contract redesign
- No frontend changes
- No broad retrieval algorithm refactor

---

### Task 1: Cover Document Ingestion Orchestration

**Files:**
- Create: `apps/api/test/ingestion.orchestrator.test.js`

- [ ] **Step 1: Write a failing happy-path ingestion orchestrator test**

Instantiate `IngestionService` with stubbed collaborators and call the compiled service's internal processing entry point using bracket access. Assert the flow:

- loads the stored file
- parses content
- deletes previous chunks
- creates new chunks
- calls indexing for the document
- updates document status to `processing/parsing`, then `indexing`, then `ready/completed`

- [ ] **Step 2: Run the new ingestion test and verify it fails for the expected reason**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/ingestion.orchestrator.test.js
```

Expected:
- FAIL because the test asserts orchestration details that are not fully encoded yet or because the new test file does not exist yet

- [ ] **Step 3: Add a failing ingestion failure-path assertion**

In the same test file, add a second test where parsing or indexing throws and assert the document is updated to:

- `status: failed`
- `processingStage: failed`
- `errorMessage` set to the thrown message

- [ ] **Step 4: Re-run the ingestion test and verify it passes**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/ingestion.orchestrator.test.js
```

Expected:
- PASS

---

### Task 2: Cover Ask Orchestration Success Path

**Files:**
- Create: `apps/api/test/ask-success.test.js`

- [ ] **Step 1: Write a failing ask success-path orchestrator test**

Instantiate `AskAssistantService` with fakes and assert a successful ask:

- creates or loads the conversation
- persists the user message
- rewrites the query
- forwards retrieval profile options into retrieval
- creates the trace before answering
- persists the assistant message
- updates the trace to `success` with citations and retrieval diagnostics
- returns `conversationId`, `traceId`, `answer`, `citations`, and `retrievedChunks`

- [ ] **Step 2: Run the new ask success test and verify it fails before implementation adjustments**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/ask-success.test.js
```

Expected:
- FAIL until the test matches real behavior and any small code gap is fixed

- [ ] **Step 3: Make the smallest implementation adjustment only if the failing test exposes a real gap**

Keep changes limited to current ask orchestration behavior and avoid any contract redesign.

- [ ] **Step 4: Re-run ask orchestrator tests**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/ask-success.test.js apps/api/test/ask-failures.test.js
```

Expected:
- PASS

---

### Task 3: Deepen Real HTTP Main-Chain Coverage

**Files:**
- Modify: `apps/api/test/api-flow.test.js`

- [ ] **Step 1: Extend the existing integration flow with chunk-level assertions**

After the document becomes ready, call `GET /documents/:id/chunks` and assert:

- response is `200`
- at least one chunk exists
- chunk content contains the integration marker

- [ ] **Step 2: Extend the ask section with conversation/message linkage assertions**

After `POST /assistants/:id/ask`, add checks against:

- `GET /conversations/:id/messages`
- `GET /conversations/:id/traces`

Assert the user and assistant messages exist, the assistant message links to the same `traceId`, and the conversation traces include the created trace.

- [ ] **Step 3: Keep reindex coverage intact**

Retain the existing reindex-and-ask verification and ensure the marker remains retrievable after reindex.

- [ ] **Step 4: Run the focused integration test**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/api-flow.test.js
```

Expected:
- PASS

---

### Task 4: Sync Progress Docs And Run API Verification

**Files:**
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update the current progress snapshot for the completed test hardening increment**

Add a concise note that the main-path test coverage now includes:

- ingestion orchestrator coverage
- ask orchestrator success/failure coverage
- deeper HTTP integration checks for chunks, messages, and traces

- [ ] **Step 2: Mark the `8.2 当前推荐下一步` first item as complete**

Only do this if the new targeted validation passes in this session.

- [ ] **Step 3: Run the smallest sufficient API verification set**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/ingestion.orchestrator.test.js apps/api/test/ask-success.test.js apps/api/test/ask-failures.test.js apps/api/test/api-flow.test.js
pnpm test:api
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
node --test apps/api/test/ingestion.orchestrator.test.js apps/api/test/ask-success.test.js apps/api/test/ask-failures.test.js apps/api/test/api-flow.test.js
```

- [ ] Run:

```bash
pnpm test:api
```

- [ ] Confirm scope boundaries remain intact:

- backend/API only
- no DOCX work
- no frontend work
- no unrelated refactors
