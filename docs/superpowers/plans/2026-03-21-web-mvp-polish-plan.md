# Web MVP Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Knowledge Base page into a useful operational overview and align its frontend state handling with the current MVP patterns.

**Architecture:** Keep the change frontend-only by deriving summary metrics from existing `knowledge-bases`, `documents`, and `assistants` queries. Reuse `StatePanel` and the existing i18n layer instead of introducing new infrastructure or APIs.

**Tech Stack:** React 19, React Router, TanStack Query, Mantine, TypeScript

---

## File Structure

### Existing files to modify

- `apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx`
- `apps/web/src/features/api/hooks.ts`
- `apps/web/src/i18n/messages.ts`
- `docs/current-progress.md`

### Existing files to reuse

- `apps/web/src/components/StatePanel.tsx`

### Explicit non-goals

- No backend changes
- No `packages/shared` extraction
- No new frontend routing
- No design system rewrite

---

### Task 1: Expand Knowledge Base Data Inputs

**Files:**
- Modify: `apps/web/src/features/api/hooks.ts`
- Modify: `apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx`

- [ ] **Step 1: Confirm the page can read the data it needs**

Ensure the Knowledge Base page has access to:

- knowledge base list
- documents for the active knowledge base
- assistants list

Expected:
- no backend changes required
- only existing queries are used

- [ ] **Step 2: Add the missing assistants query to the Knowledge Base page**

Reuse the existing `useAssistants()` hook instead of creating a new API path.

- [ ] **Step 3: Derive operational summary metrics in the page**

Compute:

- total documents
- total chunks
- ready document count
- processing document count
- failed document count
- assistants bound to the knowledge base

- [ ] **Step 4: Run frontend typecheck**

Run:

```bash
pnpm --filter @rag-system/web typecheck
```

Expected:
- PASS

---

### Task 2: Upgrade The Knowledge Base Page UI

**Files:**
- Modify: `apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx`
- Modify: `apps/web/src/i18n/messages.ts`

- [ ] **Step 1: Replace bare loading with StatePanel-driven state handling**

Cover:

- loading
- knowledge base query error
- document query error
- no knowledge base available

- [ ] **Step 2: Add the expanded overview layout**

Surface:

- identity card with status and updated time
- summary metric cards
- operational status summary
- navigation actions to `Documents` and `Assistant`

- [ ] **Step 3: Add all new copy to i18n**

Add both `en` and `zh` keys for:

- metric labels
- state labels
- summary text
- navigation/action text used on the page

- [ ] **Step 4: Run frontend build**

Run:

```bash
pnpm --filter @rag-system/web build
```

Expected:
- PASS

---

### Task 3: Sync Progress Docs

**Files:**
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update the frontend progress snapshot**

Adjust the wording for the Knowledge Base page so it no longer reads like a simple placeholder summary.

- [ ] **Step 2: Keep the docs incremental**

Only update the parts affected by this work. Do not rewrite unrelated sections.

- [ ] **Step 3: Re-run frontend verification**

Run:

```bash
pnpm --filter @rag-system/web typecheck
pnpm --filter @rag-system/web build
```

Expected:
- PASS

---

## Final Verification

- [ ] Run:

```bash
pnpm --filter @rag-system/web typecheck
```

- [ ] Run:

```bash
pnpm --filter @rag-system/web build
```

- [ ] Confirm scope boundaries remain intact:

- frontend-only change
- no API contract changes
- no `packages/shared` work
