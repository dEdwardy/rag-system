# Ask Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the ask pipeline into a clearer application flow, make failed asks traceable and consistent, and strengthen API regression coverage without introducing `packages/shared` work.

**Architecture:** Keep the existing NestJS module layout and current HTTP contract, but move ask orchestration out of the controller into a dedicated application service. Use the new orchestration boundary to centralize success and failure handling around trace lifecycle, then lock the behavior down with focused API tests instead of broad refactors.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Redis/BullMQ, Node test runner, Zod

---

## File Structure

### Existing files to modify

- `apps/api/src/modules/assistants/assistants.controller.ts`
  - Shrink the HTTP layer so it validates input and delegates the ask workflow.
- `apps/api/src/modules/assistants/assistants.module.ts`
  - Register the new ask orchestration service.
- `apps/api/src/modules/answering/answering.service.ts`
  - Adjust only if needed to support clearer failure handling or response shaping.
- `apps/api/src/modules/traces/traces.service.ts`
  - Preserve or extend trace lifecycle helpers used by the new ask flow.
- `apps/api/src/modules/messages/messages.service.ts`
  - Reuse existing message persistence helpers from the orchestration service.
- `apps/api/src/modules/conversations/conversations.service.ts`
  - Reuse existing conversation helpers from the orchestration service.
- `apps/api/test/api-flow.test.js`
  - Extend the main API integration path and add regression coverage for ask orchestration behavior.
- `apps/api/test/retrieval.test.js`
  - Keep retrieval behavior covered if any orchestration changes affect profile-driven retrieval usage.

### New files to create

- `apps/api/src/modules/assistants/ask-assistant.service.ts`
  - Single entry point for ask orchestration: conversation setup, message creation, rewrite, retrieval, answering, trace persistence, and final response shaping.
- `apps/api/test/ask-failures.test.js`
  - Focused tests for failed ask behavior and trace consistency.

### Docs to check while implementing

- `docs/phase-1-rag-blueprint.md`
- `docs/current-progress.md`
- `docs/retrieval-trace.md`

### Explicit non-goals for this plan

- Do not move shared types into `packages/shared`.
- Do not redesign retrieval heuristics or vector storage.
- Do not expand frontend work in this plan.
- Do not add auth, tenant isolation, or major schema changes.

---

### Task 1: Extract Ask Orchestration Out Of The Controller

**Files:**
- Create: `apps/api/src/modules/assistants/ask-assistant.service.ts`
- Modify: `apps/api/src/modules/assistants/assistants.controller.ts`
- Modify: `apps/api/src/modules/assistants/assistants.module.ts`
- Modify: `apps/api/test/api-flow.test.js`

- [ ] **Step 1: Write the failing integration test expectation for controller thinning**

Add or update the existing ask integration coverage in `apps/api/test/api-flow.test.js` so it still asserts the current contract:

```js
assert.equal(askResponse.status, 201);
assert.equal(typeof askResult.conversationId, "string");
assert.equal(typeof askResult.traceId, "string");
assert.ok(Array.isArray(askResult.citations));
assert.ok(Array.isArray(askResult.retrievedChunks));
```

The point of this step is to lock the public behavior before moving orchestration code.

- [ ] **Step 2: Run the API integration test to establish the baseline**

Run:

```bash
pnpm --filter @rag-system/api test -- api-flow.test.js
```

Expected:
- PASS in the current workspace before refactor work begins.

- [ ] **Step 3: Create the ask orchestration service**

Create `apps/api/src/modules/assistants/ask-assistant.service.ts` with one public method, for example:

```ts
async askAssistant(input: {
  assistantId: string;
  question: string;
  conversationId?: string;
}) { /* orchestrate the full ask flow */ }
```

Move these responsibilities from the controller into the service:

- load assistant and retrieval profile
- fetch or create conversation
- persist the user message
- run query rewrite
- run retrieval
- create the initial trace
- run answering
- persist the assistant message
- attach trace and touch conversation
- update the trace and shape the final response

Keep the HTTP response shape exactly as it is today.

- [ ] **Step 4: Update the module wiring**

Register the new service in `apps/api/src/modules/assistants/assistants.module.ts` and inject the same dependencies there instead of constructing new layers elsewhere.

Expected outcome:
- the orchestration service is owned by the assistants module
- no other module boundaries are widened unnecessarily

- [ ] **Step 5: Simplify the controller**

Reduce `apps/api/src/modules/assistants/assistants.controller.ts` so `POST /assistants/:id/ask` only:

- parses input with the existing schema
- delegates to the orchestration service
- returns the orchestration result

Avoid leaving duplicate orchestration helpers behind in the controller.

- [ ] **Step 6: Run focused tests after the refactor**

Run:

```bash
pnpm --filter @rag-system/api test -- api-flow.test.js
```

Expected:
- PASS
- no response contract changes

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/assistants/assistants.controller.ts apps/api/src/modules/assistants/assistants.module.ts apps/api/src/modules/assistants/ask-assistant.service.ts apps/api/test/api-flow.test.js
git commit -m "refactor: extract ask orchestration service"
```

---

### Task 2: Make Failed Ask Attempts Traceable And Consistent

**Files:**
- Modify: `apps/api/src/modules/assistants/ask-assistant.service.ts`
- Modify: `apps/api/src/modules/traces/traces.service.ts`
- Modify: `apps/api/src/modules/answering/answering.service.ts`
- Test: `apps/api/test/ask-failures.test.js`

- [ ] **Step 1: Write the failing tests for ask failure behavior**

Create `apps/api/test/ask-failures.test.js` with focused coverage for a failed ask path. Prefer one realistic failure trigger over many mocks. The required assertions are:

```js
assert.equal(response.status >= 500 || response.status === 400, true);
assert.equal(trace.status, "failed");
assert.equal(typeof trace.errorMessage, "string");
```

At minimum, cover:

- trace exists when ask fails after the workflow has started
- trace status is `failed`
- `errorMessage` is persisted

- [ ] **Step 2: Run the new failure test to verify it fails**

Run:

```bash
pnpm --filter @rag-system/api test -- ask-failures.test.js
```

Expected:
- FAIL because failure-path trace behavior is not fully centralized yet.

- [ ] **Step 3: Centralize trace lifecycle in the orchestration service**

Update `apps/api/src/modules/assistants/ask-assistant.service.ts` so the trace is created at a stable point in the workflow and updated in both success and failure paths.

Implementation rules:

- create the trace after the user message exists and before answer generation
- set `status: success` only on the success path
- update to `status: failed` when answering or later workflow steps throw
- preserve `rewrittenQuery`, retrieval diagnostics, and any data already available at failure time

- [ ] **Step 4: Add small helper support in traces service only if needed**

If the orchestration code becomes repetitive, add one small helper in `apps/api/src/modules/traces/traces.service.ts` for failed trace updates. Keep the service focused on persistence rather than orchestration.

- [ ] **Step 5: Ensure failure responses remain coherent**

If `apps/api/src/modules/answering/answering.service.ts` needs a small adjustment to avoid swallowing useful failure information, make the smallest possible change there. Do not redesign the answer API or provider abstraction in this task.

- [ ] **Step 6: Run the failure-path tests again**

Run:

```bash
pnpm --filter @rag-system/api test -- ask-failures.test.js
```

Expected:
- PASS
- trace is present and marked failed

- [ ] **Step 7: Re-run the happy-path integration test**

Run:

```bash
pnpm --filter @rag-system/api test -- api-flow.test.js
```

Expected:
- PASS
- no regression to the existing success path

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/assistants/ask-assistant.service.ts apps/api/src/modules/traces/traces.service.ts apps/api/src/modules/answering/answering.service.ts apps/api/test/ask-failures.test.js apps/api/test/api-flow.test.js
git commit -m "feat: persist failed ask traces"
```

---

### Task 3: Strengthen API Regression Coverage Around Ask And Retrieval

**Files:**
- Modify: `apps/api/test/api-flow.test.js`
- Modify: `apps/api/test/retrieval.test.js`
- Test: `apps/api/test/ask-failures.test.js`

- [ ] **Step 1: Identify the highest-risk regressions and encode them as tests**

Add focused coverage for:

- reindex followed by ask still returns grounded results
- retrieval profile options still affect ranking behavior as expected
- failed ask trace behavior remains stable after refactors

Keep each new test single-purpose and readable.

- [ ] **Step 2: Add one regression to the main API flow test**

Prefer a practical end-to-end assertion that exercises real behavior, for example:

```js
assert.ok(askResult.retrievedChunks.some(chunk => chunk.content.includes(marker)));
assert.ok(Array.isArray(trace.retrievalScoresJson));
```

If reindex coverage is added here, do it without making the test brittle.

- [ ] **Step 3: Add or extend retrieval-focused unit tests**

Update `apps/api/test/retrieval.test.js` to keep the profile-driven retrieval logic protected. Maintain coverage for:

- chunk window expansion
- hybrid merge
- rerank ordering

Add only the smallest extra case needed if orchestration changes reveal a gap.

- [ ] **Step 4: Run the API test suite**

Run:

```bash
pnpm test:api
```

Expected:
- PASS
- all existing and new tests pass together

- [ ] **Step 5: Run a type/build safety check if API changes widened**

Run:

```bash
pnpm --filter @rag-system/api build
```

Expected:
- PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/test/api-flow.test.js apps/api/test/retrieval.test.js apps/api/test/ask-failures.test.js
git commit -m "test: expand ask and retrieval regression coverage"
```

---

## Final Verification

- [ ] Run:

```bash
pnpm test:api
```

Expected:
- PASS

- [ ] Run:

```bash
pnpm --filter @rag-system/api build
```

Expected:
- PASS

- [ ] Confirm the final implementation still matches current product scope:

- no `packages/shared` extraction
- no frontend work
- no schema redesign
- no retrieval strategy rewrite beyond what tests require

---

## Notes For Execution

- Keep edits focused. Do not refactor unrelated files while extracting ask orchestration.
- Preserve the current ask response contract for the web app.
- Prefer adding one small service with clear ownership over introducing multiple abstraction layers.
- Use the new orchestration boundary to make trace lifecycle explicit, not to redesign the entire module graph.
