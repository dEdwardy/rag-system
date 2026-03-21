# External Knowledge Source Expansion Implementation Plan

> 文档角色：`historical-task-plan`
> 当前使用方式：这是 `external knowledge source expansion` 某一已完成子增量的历史实现计划记录；当前阶段方向仍可参考，但不要把本文档直接当成当前唯一执行计划。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing sitemap source ingestion path so it also supports one-level sitemap indexes while keeping the broader external-source task in progress.

**Architecture:** Reuse the current sitemap document endpoint and document creation flow. Expand sitemap indexes inside `SitemapSourceService`, normalize the resulting bounded page URL set, then continue through the existing combined-text artifact and ingestion pipeline unchanged.

**Tech Stack:** NestJS, Prisma, built-in fetch, Node test runner

---

## File Structure

### Existing files to modify

- `apps/api/src/infra/sitemap-source/sitemap-source.service.ts`
  - add sitemap index detection, child sitemap expansion, and bounded page URL aggregation
- `apps/api/test/parsing.test.js`
  - add focused failing coverage for sitemap index extraction/expansion behavior
- `apps/api/test/sitemap-source-e2e.test.js`
  - extend the E2E server fixture to serve a sitemap index and validate the full ingestion path
- `docs/current-dev-setup.md`
  - note sitemap index support and validation command
- `docs/current-progress.md`
  - record this bounded increment while keeping the broader task open

### Existing files to reference

- `apps/api/src/infra/web-page/web-page.service.ts`
- `apps/api/src/modules/documents/documents.service.ts`
- `docs/superpowers/specs/2026-03-21-sitemap-source-ingestion-design.md`

### Explicit non-goals

- No frontend work
- No mobile work
- No generic connector refactor
- No nested sitemap-index recursion

---

### Task 1: Write Failing Tests First

**Files:**
- Modify: `apps/api/test/parsing.test.js`
- Modify: `apps/api/test/sitemap-source-e2e.test.js`

- [ ] **Step 1: Add a failing sitemap-index parsing test**

Add a test that demonstrates a root `sitemapindex` payload can be expanded into direct page URLs from child `urlset` payloads, with deduplication and `maxPages` bounding.

- [ ] **Step 2: Run the focused parsing test to verify RED**

Run:

```bash
node --test apps/api/test/parsing.test.js
```

Expected:

- FAIL because current sitemap extraction only accepts direct `urlset`

- [ ] **Step 3: Extend the E2E test with a failing sitemap-index scenario**

Add a deterministic local HTTP fixture where:

- `/sitemap-index.xml` returns a root `sitemapindex`
- child sitemap URLs return direct `urlset` XML
- linked HTML pages expose a unique marker

Assert:

- `POST /knowledge-bases/default-kb/documents/sitemap` succeeds
- the resulting document becomes `ready`
- chunks contain the marker
- ask retrieves the marker

- [ ] **Step 4: Run the sitemap E2E test to verify RED**

Run:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js
```

Expected:

- FAIL because sitemap index payloads are currently rejected

---

### Task 2: Implement Minimal Sitemap-Index Support

**Files:**
- Modify: `apps/api/src/infra/sitemap-source/sitemap-source.service.ts`

- [ ] **Step 1: Add payload-shape detection**

Detect direct `urlset` vs root `sitemapindex` payloads.

- [ ] **Step 2: Implement child sitemap extraction**

Extract ordered unique child sitemap URLs from a root `sitemapindex` payload.

- [ ] **Step 3: Implement bounded child expansion**

Fetch child sitemap payloads one level deep, reject nested indexes, extract direct page URLs, de-duplicate across children, and stop once `maxPages` page URLs are collected.

- [ ] **Step 4: Keep existing combined page-content behavior**

Reuse the current page fetch and combined generated text artifact path after URL expansion.

- [ ] **Step 5: Re-run focused tests to verify GREEN**

Run:

```bash
node --test apps/api/test/parsing.test.js
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js
```

Expected:

- PASS

---

### Task 3: Update Docs

**Files:**
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update setup notes**

Document that sitemap ingestion now supports:

- one direct `urlset`
- one root `sitemapindex` that expands child `urlset` sitemaps

- [ ] **Step 2: Update progress**

Keep `external knowledge source expansion` unchecked, but record that sitemap ingestion now covers both direct sitemap and sitemap-index minimum increments.

- [ ] **Step 3: Re-run the focused verification after doc edits**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/parsing.test.js
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

- [ ] Confirm scope remains intact:

- backend/API only
- current top-level task still `external knowledge source expansion`
- no mobile work
- no unrelated source-type expansion in this session
