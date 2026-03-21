# Assistant Config Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Assistant page so it manages assistant answer policy and retrieval profile filters, with minimal backend support for clearing filters.

**Architecture:** Keep the UI on the existing Assistant page, extract policy/filter serialization into a dedicated helper, and make only one backend contract change: allow `PATCH /retrieval-profiles/:id` to accept `filtersJson: null` for clearing. This preserves the current structure while making the config surface meaningfully more complete.

**Tech Stack:** React, Mantine, TanStack Query, TypeScript, NestJS, Zod, node:test

---

### Task 1: Lock The New Config Behavior With Failing Tests

**Files:**
- Add: `apps/web/test/assistant-config.test.js`
- Modify: `apps/api/test/retrieval-profile-filters.test.js`

- [ ] **Step 1: Add a failing web helper test**

Create `apps/web/test/assistant-config.test.js` covering:

- default answer-policy resolution when `answerPolicyJson` is missing
- list parsing for retrieval filters
- `filtersJson: null` payload generation when all filter inputs are cleared

- [ ] **Step 2: Add a failing backend regression assertion**

Extend `apps/api/test/retrieval-profile-filters.test.js` so `PATCH /retrieval-profiles/:id` with `filtersJson: null` succeeds and returns `filtersJson: null`.

- [ ] **Step 3: Run the focused tests and confirm they fail for the intended reason**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/retrieval-profile-filters.test.js
node --experimental-strip-types --test apps/web/test/assistant-config.test.js
```

Expected: FAIL because the helper module and null-clearing backend support do not exist yet.

### Task 2: Implement The Assistant Config Helper And API Types

**Files:**
- Modify: `apps/web/src/types/api.ts`
- Modify: `apps/web/src/features/api/hooks.ts`
- Add: `apps/web/src/pages/assistant/assistant-config-form.ts`

- [ ] **Step 1: Extend web API types**

Add typed shapes for:

- `answerPolicyJson`
- `filtersJson`

and widen mutation payloads to submit them.

- [ ] **Step 2: Add the Assistant config helper**

Create a small helper module that:

- resolves form defaults
- converts filter JSON into textarea-friendly strings
- parses textarea strings back into normalized arrays
- builds deterministic assistant and retrieval-profile patch payloads

- [ ] **Step 3: Re-run the focused web test**

Run:

```bash
node --experimental-strip-types --test apps/web/test/assistant-config.test.js
```

Expected: PASS for helper behavior.

### Task 3: Wire The Assistant Page To The Richer Config Surface

**Files:**
- Modify: `apps/web/src/pages/assistant/AssistantPage.tsx`
- Modify: `apps/web/src/i18n/messages.ts`

- [ ] **Step 1: Expand the Assistant page form**

Add answer-policy controls and retrieval-filter inputs while preserving the existing page structure.

- [ ] **Step 2: Switch submit handling to helper-built payloads**

Use the helper module so the page submits:

- assistant core fields plus `answerPolicyJson`
- retrieval profile core fields plus `filtersJson`

- [ ] **Step 3: Add i18n copy for the new controls**

Update both `en` and `zh` dictionaries with the new Assistant-page labels and hints.

### Task 4: Add Minimal Backend Support For Clearing Retrieval Filters

**Files:**
- Modify: `apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts`
- Modify: `apps/api/src/modules/retrieval-profiles/retrieval-profiles.service.ts`
- Modify: `apps/api/test/retrieval-profile-filters.test.js`

- [ ] **Step 1: Allow nullable `filtersJson` in update schema**

Update the retrieval-profile update schema so `filtersJson: null` is valid on patch.

- [ ] **Step 2: Persist explicit filter clearing**

Update the service so `filtersJson: null` clears the stored JSON value.

- [ ] **Step 3: Re-run focused backend regression**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/retrieval-profile-filters.test.js
```

Expected: PASS

### Task 5: Sync Docs, Verify, Commit, And Push

**Files:**
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update setup docs**

Document that the Assistant page now manages richer answer-policy fields and retrieval metadata filters.

- [ ] **Step 2: Update progress**

Mark `更完整的 assistant / config 管理` complete and record the key files changed for this increment.

- [ ] **Step 3: Run minimal sufficient verification**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/retrieval-profile-filters.test.js
node --experimental-strip-types --test apps/web/test/assistant-config.test.js
pnpm --filter @rag-system/web typecheck
pnpm --filter @rag-system/web build
```

- [ ] **Step 4: Review task-only diff and status**

Run:

```bash
git status --short
```

- [ ] **Step 5: Commit and push**

Run:

```bash
git add docs/superpowers/specs/2026-03-21-assistant-config-management-design.md docs/superpowers/plans/2026-03-21-assistant-config-management-plan.md docs/current-dev-setup.md docs/current-progress.md apps/web/src/types/api.ts apps/web/src/features/api/hooks.ts apps/web/src/pages/assistant/assistant-config-form.ts apps/web/src/pages/assistant/AssistantPage.tsx apps/web/src/i18n/messages.ts apps/web/test/assistant-config.test.js apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts apps/api/src/modules/retrieval-profiles/retrieval-profiles.service.ts apps/api/test/retrieval-profile-filters.test.js
git commit -m "feat(web): expand assistant config management"
git push
```

- [ ] **Step 6: Prepare the next-chat handoff**

Report the completed task, commands run, docs updated, commit hash, push result, and the next recommended unchecked task.
