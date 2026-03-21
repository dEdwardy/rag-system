# External Feed Source Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend/API-only path that ingests one RSS or Atom feed URL into the existing document pipeline and verifies the flow end to end.

**Architecture:** Keep remote feed acquisition separate from ingestion. Fetch and extract the feed at document-creation time, save normalized feed text into local storage, create a standard `Document` record, then reuse the existing async ingestion/indexing path unchanged. Validation should cover both extraction behavior and the full API flow.

**Tech Stack:** NestJS, Prisma, BullMQ, built-in fetch, Node test runner

---

## File Structure

### New files to create

- `apps/api/src/infra/feed-source/feed-source.module.ts`
  - Nest module boundary for feed fetching and extraction
- `apps/api/src/infra/feed-source/feed-source.service.ts`
  - fetch + XML-to-text extraction for RSS/Atom feeds
- `apps/api/test/feed-source-e2e.test.js`
  - focused end-to-end validation for feed source ingestion

### Existing files to modify

- `apps/api/src/modules/documents/document.schemas.ts`
  - request schema for creating a feed-backed document
- `apps/api/src/modules/documents/documents.controller.ts`
  - new route for feed ingestion
- `apps/api/src/modules/documents/documents.module.ts`
  - import the feed-source module
- `apps/api/src/modules/documents/documents.service.ts`
  - orchestration for fetch -> save text artifact -> create document -> enqueue ingestion
- `apps/api/test/parsing.test.js`
  - focused extraction test
- `docs/current-dev-setup.md`
  - focused validation command and workflow note
- `docs/current-progress.md`
  - mark the current task complete and record the increment

### Existing files to reference

- `apps/api/src/infra/web-page/web-page.service.ts`
- `apps/api/src/infra/storage/storage.service.ts`
- `apps/api/src/modules/ingestion/ingestion.service.ts`
- `apps/api/test/web-page-source-e2e.test.js`

### Explicit non-goals

- No frontend implementation
- No mobile adaptation work
- No generic connector framework
- No recursive entry-page crawling

---

### Task 1: Add Failing Tests First

**Files:**
- Modify: `apps/api/test/parsing.test.js`
- Create: `apps/api/test/feed-source-e2e.test.js`

- [ ] **Step 1: Add a failing feed extraction test**

Add a focused test that verifies representative RSS or Atom XML is normalized into usable plain text and feed metadata.

- [ ] **Step 2: Add a failing feed ingestion E2E**

Create a local temporary HTTP server that serves deterministic RSS or Atom XML containing a unique marker, then exercise:

- `POST /knowledge-bases/default-kb/documents/feed`
- `GET /documents/:id`
- `GET /documents/:id/chunks`
- `POST /assistants/default-assistant/ask`
- `POST /documents/:id/reindex`

Lock down:

- `sourceType = "feed"`
- `sourceName` is the URL
- ready status
- chunk content contains the marker
- ask retrieves the marker
- reindex preserves the marker

- [ ] **Step 3: Run focused tests to verify RED**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/parsing.test.js
node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js
```

Expected:

- FAIL because the new extraction/service/route behavior does not exist yet

---

### Task 2: Implement Minimal Backend Support

**Files:**
- Create: `apps/api/src/infra/feed-source/feed-source.module.ts`
- Create: `apps/api/src/infra/feed-source/feed-source.service.ts`
- Modify: `apps/api/src/modules/documents/document.schemas.ts`
- Modify: `apps/api/src/modules/documents/documents.controller.ts`
- Modify: `apps/api/src/modules/documents/documents.module.ts`
- Modify: `apps/api/src/modules/documents/documents.service.ts`

- [ ] **Step 1: Add request schema for feed ingestion**

Define a body schema with:

- `url`
- optional `title`
- optional `maxItems`

Validate absolute `http` or `https` URLs only and bound `maxItems`.

- [ ] **Step 2: Implement feed source service**

Add a service that:

- fetches the URL
- validates response/content-type
- extracts title/description/entries from RSS or Atom XML
- normalizes summary text into one deterministic text payload
- throws clear errors for invalid upstream responses

- [ ] **Step 3: Add the documents route and service orchestration**

Wire a controller route and service method that:

- fetches/extracts feed content
- persists the text artifact
- creates a normal `Document`
- enqueues ingestion

- [ ] **Step 4: Re-run focused tests to verify GREEN**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/parsing.test.js
node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js
```

Expected:

- PASS

---

### Task 3: Sync Docs

**Files:**
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update setup docs**

Document:

- the new `POST /knowledge-bases/:id/documents/feed` backend capability
- the focused validation command for the new E2E test

- [ ] **Step 2: Update progress**

Mark `外部知识源接入` complete and add a concise note in the recent completed section.

- [ ] **Step 3: Re-run focused verification after doc edits**

Run:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js
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
node --test apps/api/test/parsing.test.js
```

- [ ] Run:

```bash
node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js
```

- [ ] Confirm scope boundaries remain intact:

- backend/API first
- `PC Web` client priority unchanged
- no mobile work
- no connector over-expansion
