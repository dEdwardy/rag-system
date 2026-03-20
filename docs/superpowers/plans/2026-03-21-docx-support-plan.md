# DOCX Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend DOCX ingestion support so `.docx` uploads can be parsed and processed through the existing RAG ingestion pipeline.

**Architecture:** Extend the existing parsing service with DOCX detection and plain-text extraction while keeping ingestion, chunking, indexing, and answering contracts unchanged. Validate the change with test-first coverage at the parser layer and ingestion orchestrator layer, then update progress/setup docs to reflect the new supported format.

**Tech Stack:** NestJS, Node.js test runner, existing ingestion/indexing services, DOCX text extraction library, Prisma-backed document metadata flow

---

### Task 1: Add parser-level DOCX coverage first

**Files:**
- Modify: `apps/api/test/parsing.test.js`

- [ ] **Step 1: Write the failing DOCX parsing test**

Add a new test in `apps/api/test/parsing.test.js` that generates a deterministic DOCX buffer, calls `ParsingService.parseDocument(...)`, and asserts the returned text includes stable phrases from the sample content.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rag-system/api build && node --test apps/api/test/parsing.test.js`
Expected: FAIL because DOCX is currently unsupported.

- [ ] **Step 3: Add deterministic DOCX test data**

Generate a small deterministic `.docx` buffer in the test containing a heading and a short paragraph so parsing output assertions stay stable.

- [ ] **Step 4: Commit checkpoint**

```bash
git add apps/api/test/parsing.test.js
git commit -m "test: add failing DOCX parsing coverage"
```

### Task 2: Implement minimal DOCX parsing support

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/infra/parsing/parsing.service.ts`

- [ ] **Step 1: Add DOCX parser dependency**

Add a small library that extracts raw text from `.docx` buffers without changing the current parsing service interface.

- [ ] **Step 2: Implement DOCX detection**

Update `ParsingService` to recognize:
- `.docx`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

- [ ] **Step 3: Implement normalized DOCX text extraction**

Add a `parseDocxDocument` helper that:
- reads text from the file buffer
- normalizes CRLF to LF
- removes null characters if present
- collapses 3+ blank lines to 2
- trims final output
- throws if extracted content is empty

- [ ] **Step 4: Run parser test to verify it passes**

Run: `pnpm --filter @rag-system/api build && node --test apps/api/test/parsing.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/src/infra/parsing/parsing.service.ts apps/api/test/parsing.test.js
git commit -m "feat(api): add DOCX parsing support"
```

### Task 3: Prove ingestion orchestration still works with DOCX

**Files:**
- Modify: `apps/api/test/ingestion.orchestrator.test.js`

- [ ] **Step 1: Write a failing DOCX ingestion test**

Add a test that drives `IngestionService.prototype.processDocument` with:
- `sourceName: "guide.docx"`
- DOCX MIME type
- a fake parser return value based on DOCX content

Assert the orchestration still:
- sets `processing/parsing`
- deletes old chunks
- creates new chunks
- calls indexing
- ends in `ready/completed`

- [ ] **Step 2: Run targeted ingestion test to verify expected result**

Run: `pnpm --filter @rag-system/api build && node --test apps/api/test/ingestion.orchestrator.test.js`
Expected: PASS after Task 2, proving no ingestion contract regressions.

- [ ] **Step 3: Refine only if the test exposes a contract gap**

Keep production changes limited to ingestion/parsing behavior directly required by the test.

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/ingestion.orchestrator.test.js
git commit -m "test: cover DOCX ingestion orchestration"
```

### Task 4: Update progress and setup docs

**Files:**
- Modify: `README.md`
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update supported format references**

Document DOCX alongside Markdown, TXT, and PDF where the repo describes current ingestion support.

- [ ] **Step 2: Update progress tracker**

Mark the `8.2` DOCX item complete in `docs/current-progress.md` and add the task to the recent completed increment list.

- [ ] **Step 3: Keep edits incremental**

Do not rewrite unrelated sections or future tasks.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/current-dev-setup.md docs/current-progress.md
git commit -m "docs: record DOCX ingestion support"
```

### Task 5: Final verification and delivery

**Files:**
- Review only

- [ ] **Step 1: Run minimal sufficient verification**

Run:
- `pnpm --filter @rag-system/api build`
- `node --test apps/api/test/parsing.test.js apps/api/test/ingestion.orchestrator.test.js`

If either command exposes broader breakage caused by the change, expand to `pnpm test:api`.

- [ ] **Step 2: Inspect worktree before commit/push**

Run:
- `git status --short`
- `git diff --stat`

- [ ] **Step 3: Create final task commit if prior checkpoints were skipped**

```bash
git add apps/api/package.json apps/api/src/infra/parsing/parsing.service.ts apps/api/test/parsing.test.js apps/api/test/ingestion.orchestrator.test.js README.md docs/current-dev-setup.md docs/current-progress.md docs/superpowers/specs/2026-03-21-docx-support-design.md docs/superpowers/plans/2026-03-21-docx-support-plan.md
git commit -m "feat(api): support DOCX ingestion"
```

- [ ] **Step 4: Push**

Run: `git push`

- [ ] **Step 5: Report exact verification commands and results**

Summarize:
- identified task
- commands run
- docs updated
- commit hash
- push result
