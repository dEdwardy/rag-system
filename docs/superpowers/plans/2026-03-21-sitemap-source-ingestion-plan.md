# Sitemap Source Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend/API-only path that ingests one sitemap URL into the existing document pipeline and verifies the flow end to end.

**Architecture:** Keep sitemap acquisition separate from ingestion. Fetch the sitemap and its bounded page set at document-creation time, normalize page content into one generated text artifact, create a standard `Document` record, then reuse the existing async ingestion/indexing path unchanged. Validation should cover both sitemap extraction behavior and the full API flow.

**Tech Stack:** NestJS, Prisma, BullMQ, built-in fetch, Node test runner

---

## File Structure

### New files to create

- `apps/api/src/infra/sitemap-source/sitemap-source.module.ts`
  - Nest module boundary for sitemap fetching and extraction
- `apps/api/src/infra/sitemap-source/sitemap-source.service.ts`
  - sitemap XML fetch + URL extraction + bounded page aggregation
- `apps/api/test/sitemap-source-e2e.test.js`
  - focused end-to-end validation for sitemap source ingestion

### Existing files to modify

- `apps/api/src/modules/documents/document.schemas.ts`
  - request schema for creating a sitemap-backed document
- `apps/api/src/modules/documents/documents.controller.ts`
  - new route for sitemap ingestion
- `apps/api/src/modules/documents/documents.module.ts`
  - import the sitemap-source module
- `apps/api/src/modules/documents/documents.service.ts`
  - orchestration for fetch sitemap -> aggregate page text -> create document -> enqueue ingestion
- `apps/api/test/parsing.test.js`
  - focused sitemap extraction test
- `docs/current-dev-setup.md`
  - focused validation command and workflow note
- `docs/current-progress.md`
  - record the new bounded increment under the still-open external-source task

### Existing files to reference

- `apps/api/src/infra/web-page/web-page.service.ts`
- `apps/api/src/modules/ingestion/ingestion.service.ts`
- `apps/api/test/web-page-source-e2e.test.js`
- `apps/api/test/feed-source-e2e.test.js`

### Explicit non-goals

- No frontend implementation
- No mobile adaptation work
- No sitemap index recursion
- No generic connector framework in this round

---

### Task 1: Add Failing Tests First

**Files:**
- Modify: `apps/api/test/parsing.test.js`
- Create: `apps/api/test/sitemap-source-e2e.test.js`

- [ ] **Step 1: Add a failing sitemap extraction test**

Add a focused test that verifies representative sitemap XML is normalized into an ordered bounded URL list and then combined with fetched page content.

- [ ] **Step 2: Add a failing sitemap ingestion E2E**

Create a local temporary HTTP server that serves deterministic sitemap XML plus linked HTML pages, then exercise:

- `POST /knowledge-bases/default-kb/documents/sitemap`
- `GET /documents/:id`
- `GET /documents/:id/chunks`
- `POST /assistants/default-assistant/ask`
- `POST /documents/:id/reindex`

Lock down:

- `sourceType = "sitemap"`
- `sourceName` is the sitemap URL
- ready status
- chunk content contains page markers
- ask retrieves the markers
- reindex preserves the marker

- [ ] **Step 3: Run focused tests to verify RED**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/parsing.test.js
node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js
```

Expected:

- FAIL because the new sitemap/service/route behavior does not exist yet

---

### Task 2: Implement Minimal Backend Support

**Files:**
- Create: `apps/api/src/infra/sitemap-source/sitemap-source.module.ts`
- Create: `apps/api/src/infra/sitemap-source/sitemap-source.service.ts`
- Modify: `apps/api/src/modules/documents/document.schemas.ts`
- Modify: `apps/api/src/modules/documents/documents.controller.ts`
- Modify: `apps/api/src/modules/documents/documents.module.ts`
- Modify: `apps/api/src/modules/documents/documents.service.ts`

- [ ] **Step 1: Add request schema for sitemap ingestion**

Define a body schema with:

- `url`
- optional `title`
- optional `maxPages`

Validate absolute `http`/`https` URLs only and bound `maxPages` to `1..50`.

- [ ] **Step 2: Implement sitemap source service**

Add a service that:

- fetches sitemap XML
- validates response/content-type
- extracts de-duplicated page URLs from direct `urlset` XML
- fetches the bounded page set through `WebPageService`
- returns combined normalized text
- throws clear errors for invalid upstream responses

- [ ] **Step 3: Add the documents route and service orchestration**

Wire a controller route and service method that:

- fetches/extracts sitemap content
- persists the generated text artifact
- creates a normal `Document`
- enqueues ingestion

- [ ] **Step 4: Re-run focused tests to verify GREEN**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/parsing.test.js
node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js
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

- the new `POST /knowledge-bases/:id/documents/sitemap` backend capability
- the focused validation command for the new E2E test

- [ ] **Step 2: Update progress**

Keep `external knowledge source expansion` as the first open task, but add a concise note that sitemap source ingestion minimum increment is now done.

- [ ] **Step 3: Re-run focused verification after doc edits**

Run:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js
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
node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js
```

- [ ] Confirm scope boundaries remain intact:

- backend/API first
- `PC Web` client priority unchanged
- no mobile work
- no connector-platform over-expansion
