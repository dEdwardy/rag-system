# Web I18n Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair corrupted Chinese UI copy in the web app and add lightweight regression protection for the in-repo dictionary.

**Architecture:** Keep the current lightweight i18n approach and repair it in place. Add a file-based Node test for representative Chinese copy instead of introducing a larger frontend testing stack.

**Tech Stack:** TypeScript, React, Node test runner, Vite

---

## File Structure

### Modify

- `apps/web/src/i18n/messages.ts`
- `docs/web-i18n.md`

### Create

- `apps/web/test/i18n-copy.test.js`

### Non-goals

- No frontend routing changes
- No backend/API work
- No external i18n dependency

---

### Task 1: Add Regression Coverage For Chinese Copy

**Files:**
- Create: `apps/web/test/i18n-copy.test.js`

- [ ] **Step 1: Write a failing content regression test**

Read `apps/web/src/i18n/messages.ts` as plain text and assert representative Chinese strings exist for:

- app shell navigation
- documents page title
- knowledge base page title
- assistant page title

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test apps/web/test/*.test.js
```

Expected:
- FAIL because the current Chinese copy is corrupted.

---

### Task 2: Rewrite The Dictionary In Clean UTF-8

**Files:**
- Modify: `apps/web/src/i18n/messages.ts`

- [ ] **Step 1: Replace the corrupted Chinese dictionary**

Rewrite the file so all existing keys remain available and `zh` values are readable Chinese text.

- [ ] **Step 2: Keep English keys stable**

Do not remove existing keys or change the export shape.

- [ ] **Step 3: Re-run the content test**

Run:

```bash
node --test apps/web/test/*.test.js
```

Expected:
- PASS

---

### Task 3: Sync Docs And Verify Frontend Build

**Files:**
- Modify: `docs/web-i18n.md`

- [ ] **Step 1: Update the i18n doc**

Document that the local dictionary remains the source of truth and has been normalized.

- [ ] **Step 2: Run frontend verification**

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
node --test apps/web/test/*.test.js
```

- [ ] Run:

```bash
pnpm --filter @rag-system/web typecheck
```

- [ ] Run:

```bash
pnpm --filter @rag-system/web build
```
