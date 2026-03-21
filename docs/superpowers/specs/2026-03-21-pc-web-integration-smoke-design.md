# PC Web Integration Smoke Automation Design

## Task Identification

This design covers the current first unchecked task in `docs/current-progress.md`: add more integration-level automation validation for the current `PC Web` client scope.

## Goal

Add one real-browser smoke automation path that validates the current web app can load real backend data and render core read-only management surfaces without relying only on helper-level tests.

## Scope Decision

This round should stay smaller than the later unchecked E2E tasks for:

- fuller document flow E2E
- fuller ask flow E2E
- broader frontend/backend integration automation

So the change should target a narrow but meaningful PC Web slice:

- `Knowledge Base` page loads from real API data
- the page renders derived summary state correctly
- the user can navigate from `Knowledge Base` to `Assistant`
- `Assistant` page loads the current assistant and retrieval profile data

This gives the repository one browser-driven integration smoke path without prematurely claiming full document or ask E2E coverage.

## Chosen Approach

Add a Node test that uses the `playwright` browser library directly, not a large new test runner. The smoke test should:

1. reuse the existing built API and built web app when already running
2. start them locally when they are not already available
3. call the API directly to derive the expected seeded data
4. open the real browser against the web app
5. verify the `Knowledge Base` and `Assistant` pages render values that match the backend

The pages should expose a few stable `data-testid` hooks so the smoke test is resilient to copy/layout changes.

## Alternatives Considered

### 1. Add only more helper-level Node tests

Pros:

- smallest implementation
- no browser dependency

Cons:

- does not verify routing, fetch behavior, or real page rendering
- not meaningfully closer to integration automation

Rejected because it does not satisfy the current task.

### 2. Jump directly to full upload and ask browser E2E

Pros:

- highest validation value

Cons:

- overlaps later unchecked tasks
- larger runtime/setup surface
- higher risk in one session

Rejected for this round because the workflow requires completing only the first unchecked item.

### 3. Add one read-only browser smoke that uses real API data

Pros:

- meaningfully increases automation depth
- stays inside current PC Web scope
- avoids swallowing the later full-flow E2E tasks

Cons:

- requires adding browser automation dependency and process orchestration

Chosen because it is the best fit for the current task boundary.

## Design

### Test Coverage

The first smoke path should validate:

- seeded knowledge base list loads
- seeded documents for the active knowledge base are reflected in the Knowledge Base overview counts
- knowledge base health/status summary renders
- the page action can navigate to `Assistant`
- assistant name and retrieval profile name render from the backend

### Runtime Model

The smoke test should:

- check whether API `http://127.0.0.1:3000/health` is already available
- check whether the web app `http://127.0.0.1:4173` is already available
- start only the missing processes
- stop only the processes it started

This keeps the test usable both in a local dev session and in a clean validation run.

### Stable Selectors

Add focused `data-testid` hooks for:

- knowledge base root and summary fields
- metric values on the Knowledge Base page
- assistant root and key loaded values

These hooks should be narrow, implementation-light, and only added where needed for automation stability.

### Documentation

Update:

- `docs/current-progress.md` to mark the current task complete and mention the new smoke coverage
- `docs/current-dev-setup.md` to document the smoke validation command and its prerequisites

## Files

### Create

- `apps/web/test/pc-web-smoke.test.mjs`
- `docs/superpowers/plans/2026-03-21-pc-web-integration-smoke-plan.md`

### Modify

- `package.json`
- `apps/web/package.json`
- `apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx`
- `apps/web/src/pages/assistant/AssistantPage.tsx`
- `docs/current-dev-setup.md`
- `docs/current-progress.md`

## Validation

- `pnpm --filter @rag-system/api build`
- `pnpm --filter @rag-system/web build`
- `node --test apps/web/test/pc-web-smoke.test.mjs`

## Non-Goals

- full upload -> ready document browser E2E
- full ask browser E2E
- mobile adaptation
- redesigning existing pages
- changing backend API contracts
