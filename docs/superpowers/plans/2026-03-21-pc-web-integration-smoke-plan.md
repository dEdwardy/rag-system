# PC Web Integration Smoke Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one real-browser PC Web smoke test that validates the Knowledge Base to Assistant read-only path against the real backend.

**Architecture:** Keep the current API contracts and page behavior intact. Add a Node `--test` smoke script that uses `playwright`, starts only missing local processes, reads expected values from the backend, and verifies stable page selectors in the browser.

**Tech Stack:** Node test runner, Playwright browser library, React 19, Vite, NestJS

---

## File Structure

### Create

- `apps/web/test/pc-web-smoke.test.mjs`

### Modify

- `package.json`
- `apps/web/package.json`
- `apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx`
- `apps/web/src/pages/assistant/AssistantPage.tsx`
- `docs/current-dev-setup.md`
- `docs/current-progress.md`

### Explicit non-goals

- no upload browser automation yet
- no ask browser automation yet
- no mobile work
- no backend endpoint changes

---

### Task 1: Add The Failing Browser Smoke Test

**Files:**
- Create: `apps/web/test/pc-web-smoke.test.mjs`
- Modify: `apps/web/package.json`
- Modify: `package.json`

- [ ] **Step 1: Add the browser automation dependency and command entry**

Add the minimal dependency and script wiring needed to run a Node-based smoke test.

- [ ] **Step 2: Write the failing smoke test**

Cover:

- load expected knowledge base, document, assistant, and retrieval profile data from the API
- open `/knowledge-base`
- assert the page exposes stable selectors for summary values
- navigate to `/assistant`
- assert assistant and retrieval profile values are loaded

- [ ] **Step 3: Run the smoke test to verify it fails for the expected reason**

Run:

```bash
node --test apps/web/test/pc-web-smoke.test.mjs
```

Expected:
- FAIL because required selectors and/or wiring do not exist yet

---

### Task 2: Add Minimal Page Support

**Files:**
- Modify: `apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx`
- Modify: `apps/web/src/pages/assistant/AssistantPage.tsx`

- [ ] **Step 1: Add stable `data-testid` hooks to the Knowledge Base page**

Add hooks only for the values the smoke test needs:

- root
- active knowledge base id
- document count
- chunk count
- ready count
- processing count
- failed count
- assistant count
- assistant navigation action

- [ ] **Step 2: Add stable `data-testid` hooks to the Assistant page**

Add hooks for:

- root
- assistant id
- assistant name field
- retrieval profile name

- [ ] **Step 3: Re-run the smoke test until it passes**

Run:

```bash
node --test apps/web/test/pc-web-smoke.test.mjs
```

Expected:
- PASS

---

### Task 3: Document And Progress Sync

**Files:**
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Document the smoke validation command and prerequisites**

Note:

- current scope is PC Web
- local infra / seeded defaults are required
- focused smoke command

- [ ] **Step 2: Mark the current task complete in progress tracking**

Update the current first unchecked item and mention the new browser smoke coverage without claiming the later E2E tasks are done.

- [ ] **Step 3: Re-run focused validation**

Run:

```bash
pnpm --filter @rag-system/api build
pnpm --filter @rag-system/web build
node --test apps/web/test/pc-web-smoke.test.mjs
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
pnpm --filter @rag-system/web build
```

- [ ] Run:

```bash
node --test apps/web/test/pc-web-smoke.test.mjs
```

- [ ] Confirm scope boundaries remain intact:

- PC Web only
- no mobile work
- no backend contract changes
- later document/ask E2E tasks remain open
