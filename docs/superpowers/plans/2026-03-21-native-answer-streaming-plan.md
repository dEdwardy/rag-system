# Native Answer Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `POST /assistants/:id/ask/stream` from completed-answer progressive reveal to provider-native answer text streaming while still finalizing citations, trace ids, and execution metadata in the last event.

**Architecture:** Keep `NDJSON` as the transport and keep rewrite/retrieval/finalization staged. Add a streaming answer-generation path in the backend, normalize provider deltas in the LLM layer, accumulate the full answer server-side, then reuse existing post-processing to emit the final payload. Keep the non-stream ask endpoint unchanged.

**Tech Stack:** NestJS, Node fetch, Ollama HTTP API, OpenAI chat/completions streaming, React 19, TanStack Query, Node test runner

---

## File Structure

### Existing files to modify

- `apps/api/src/infra/llm/llm.types.ts`
  - define stream event and stream result types
- `apps/api/src/infra/llm/llm.service.ts`
  - add provider-native answer streaming support and normalized delta callbacks
- `apps/api/src/modules/answering/answering.service.ts`
  - separate stream accumulation from existing answer finalization
- `apps/api/src/modules/assistants/ask-assistant.service.ts`
  - add a dedicated ask-stream orchestration path
- `apps/api/src/modules/assistants/assistants.controller.ts`
  - use the new orchestration instead of splitting a completed answer
- `apps/api/test/ask-stream-e2e.test.js`
  - strengthen native-stream assertions
- `apps/web/src/lib/api.ts`
  - keep handling normalized `NDJSON` events and preserve structured errors
- `apps/web/src/features/api/hooks.ts`
  - keep hook behavior aligned with the streaming contract
- `apps/web/src/pages/chat/ChatPage.tsx`
  - adapt any phase labels or finalization assumptions if needed
- `docs/current-dev-setup.md`
  - record the new stream semantics and validation path
- `docs/current-progress.md`
  - record the native-streaming increment separately from the first-round transport

### New tests likely to create

- `apps/api/test/llm-answer-stream.test.js`
  - provider stream normalization and accumulation tests
- `apps/api/test/ask-stream-service.test.js`
  - streaming orchestration tests for event order and failure semantics
- `apps/web/test/api-stream.test.js`
  - stream-client error and event handling updates if needed

### Explicit non-goals

- no transport migration to SSE or WebSocket
- no streaming retrieval pipeline
- no mid-stream citations with guaranteed correctness
- no schema migration
- no mobile work

---

### Task 1: Lock The Real Streaming Contract In Tests

**Files:**
- Modify: `apps/api/test/ask-stream-e2e.test.js`
- Create: `apps/api/test/llm-answer-stream.test.js`
- Create: `apps/api/test/ask-stream-service.test.js`

- [ ] **Step 1: Add a failing LLM stream normalization test**

Cover one provider stream fixture and assert:

- deltas are emitted in order
- accumulated text matches the completed output
- provider completion metadata is preserved

- [ ] **Step 2: Run the focused LLM stream test to verify RED**

Run: `node --test apps/api/test/llm-answer-stream.test.js`
Expected: fail because no native stream normalization path exists yet

- [ ] **Step 3: Add a failing ask-stream orchestration test**

Cover:

- `status: started`
- `status: retrieving` or equivalent pre-generation progress
- `status: generating`
- one or more real deltas from the answer stream
- `final` only after completion
- structured `error` diagnostics on failure

- [ ] **Step 4: Run the orchestration test to verify RED**

Run: `node --test apps/api/test/ask-stream-service.test.js`
Expected: fail because the current service has no dedicated native-stream path

- [ ] **Step 5: Tighten the existing E2E contract**

Require:

- `answer_delta` appears before `final`
- delta concatenation equals the final answer
- final payload still includes citations and trace ids

- [ ] **Step 6: Run the E2E to confirm the expected pre-implementation failure**

Run: `node --test --test-concurrency=1 apps/api/test/ask-stream-e2e.test.js`
Expected: fail because the current implementation still fabricates deltas from a completed answer

- [ ] **Step 7: Commit the red tests**

```bash
git add apps/api/test/llm-answer-stream.test.js apps/api/test/ask-stream-service.test.js apps/api/test/ask-stream-e2e.test.js
git commit -m "test: lock native ask stream contract"
```

---

### Task 2: Add LLM Provider-Native Streaming

**Files:**
- Modify: `apps/api/src/infra/llm/llm.types.ts`
- Modify: `apps/api/src/infra/llm/llm.service.ts`
- Test: `apps/api/test/llm-answer-stream.test.js`

- [ ] **Step 1: Define streaming types**

Add explicit types for:

- normalized answer stream delta callback
- completed stream result
- provider stream lifecycle errors

- [ ] **Step 2: Run the LLM stream test and keep it red**

Run: `node --test apps/api/test/llm-answer-stream.test.js`
Expected: fail until the implementation exists

- [ ] **Step 3: Implement Ollama native answer streaming**

Use the provider stream endpoint and normalize emitted text chunks into one internal callback shape.

- [ ] **Step 4: Implement OpenAI native answer streaming**

Normalize the provider event stream into the same callback shape used by the Ollama path.

- [ ] **Step 5: Preserve fallback behavior**

If no provider streaming is available, return a deterministic completed result through the same abstraction without breaking the stream consumer.

- [ ] **Step 6: Re-run the focused LLM stream test to verify GREEN**

Run: `node --test apps/api/test/llm-answer-stream.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/infra/llm/llm.types.ts apps/api/src/infra/llm/llm.service.ts apps/api/test/llm-answer-stream.test.js
git commit -m "feat: add provider-native answer streaming"
```

---

### Task 3: Split Answer Finalization From Answer Generation

**Files:**
- Modify: `apps/api/src/modules/answering/answering.service.ts`
- Test: `apps/api/test/ask-stream-service.test.js`

- [ ] **Step 1: Add a failing test for answer finalization from accumulated text**

Assert that the service can take completed streamed text and still produce:

- normalized answer
- citations
- answering metadata
- quality evaluation

- [ ] **Step 2: Run the focused service test to verify RED**

Run: `node --test apps/api/test/ask-stream-service.test.js`
Expected: fail because finalization still assumes one-shot generation

- [ ] **Step 3: Extract answer finalization logic**

Refactor so the service can:

- stream and accumulate answer text
- finalize from accumulated text using the current post-processing rules

- [ ] **Step 4: Keep non-stream answer generation working**

Reuse the extracted finalization path from the existing one-shot flow instead of duplicating logic.

- [ ] **Step 5: Re-run the focused service test to verify GREEN**

Run: `node --test apps/api/test/ask-stream-service.test.js`
Expected: PASS for the finalization assertions

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/answering/answering.service.ts apps/api/test/ask-stream-service.test.js
git commit -m "refactor: split streamed answer finalization"
```

---

### Task 4: Add Dedicated Ask Stream Orchestration

**Files:**
- Modify: `apps/api/src/modules/assistants/ask-assistant.service.ts`
- Modify: `apps/api/src/modules/assistants/assistants.controller.ts`
- Test: `apps/api/test/ask-stream-service.test.js`
- Test: `apps/api/test/ask-stream-e2e.test.js`

- [ ] **Step 1: Add a failing orchestration assertion for real provider deltas**

Assert that the service emits live deltas from the stream callback instead of post hoc splitting.

- [ ] **Step 2: Run the orchestration test to verify RED**

Run: `node --test apps/api/test/ask-stream-service.test.js`
Expected: fail until the new orchestration exists

- [ ] **Step 3: Implement `askAssistantStream()` orchestration**

Responsibilities:

- create or reuse conversation
- persist user message
- create initial trace
- emit progress phases
- forward normalized provider deltas
- accumulate full answer
- finalize assistant message and trace after completion

- [ ] **Step 4: Update the controller to consume the new orchestration**

Remove completed-answer splitting from the controller and serialize only emitted service events.

- [ ] **Step 5: Preserve structured failures**

Ensure the stream still emits one structured `error` event when the pipeline fails before or during completion.

- [ ] **Step 6: Re-run the service test to verify GREEN**

Run: `node --test apps/api/test/ask-stream-service.test.js`
Expected: PASS

- [ ] **Step 7: Re-run the ask-stream E2E to verify GREEN**

Run: `node --test --test-concurrency=1 apps/api/test/ask-stream-e2e.test.js`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/assistants/ask-assistant.service.ts apps/api/src/modules/assistants/assistants.controller.ts apps/api/test/ask-stream-service.test.js apps/api/test/ask-stream-e2e.test.js
git commit -m "feat: stream native ask deltas"
```

---

### Task 5: Align The Web Stream Consumer

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/features/api/hooks.ts`
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Test: `apps/web/test/api-stream.test.js`
- Test: `apps/web/test/chat-stream-state.test.js`

- [ ] **Step 1: Add or update a failing frontend stream test**

Assert that the client continues to:

- append deltas progressively
- treat `error` as failure
- wait for `final` to attach citations and trace metadata

- [ ] **Step 2: Run the focused frontend test to verify RED if contract changes are needed**

Run: `node --experimental-strip-types --test apps/web/test/api-stream.test.js`
Expected: fail only if the new backend phases or finalization assumptions require frontend adjustments

- [ ] **Step 3: Update the stream client and hook behavior**

Keep the client compatible with the normalized backend events and preserve structured stream failures.

- [ ] **Step 4: Update the chat page only as needed**

Possible changes:

- refined phase labels
- longer live generating state
- finalization timing assumptions

- [ ] **Step 5: Re-run the focused frontend tests to verify GREEN**

Run: `node --experimental-strip-types --test apps/web/test/api-stream.test.js`

Run: `node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/features/api/hooks.ts apps/web/src/pages/chat/ChatPage.tsx apps/web/test/api-stream.test.js apps/web/test/chat-stream-state.test.js
git commit -m "feat: align web client with native answer streaming"
```

---

### Task 6: Sync Docs And Run Final Serial Verification

**Files:**
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update dev setup wording**

Document that:

- the first completed increment was `NDJSON` progressive reveal
- the current increment upgrades answer generation to provider-native streaming
- final citations and trace metadata still arrive in the completion event

- [ ] **Step 2: Update progress tracking**

Record what is completed and keep wording precise so native text streaming is not confused with full structured real-time streaming.

- [ ] **Step 3: Run backend build**

Run: `pnpm --filter @rag-system/api build`
Expected: PASS

- [ ] **Step 4: Run focused backend tests serially**

Run: `node --test apps/api/test/llm-answer-stream.test.js`

Run: `node --test apps/api/test/ask-stream-service.test.js`

Run: `node --test --test-concurrency=1 apps/api/test/ask-stream-e2e.test.js`

Run: `node --test --test-concurrency=1 apps/api/test/ask-chain-e2e.test.js`

Expected: PASS

- [ ] **Step 5: Run focused frontend tests serially**

Run: `node --experimental-strip-types --test apps/web/test/api-stream.test.js`

Run: `node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js`

Expected: PASS

- [ ] **Step 6: Run web build**

Run: `pnpm --filter @rag-system/web build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add docs/current-dev-setup.md docs/current-progress.md
git commit -m "docs: record native answer streaming"
```

---

## Final Verification

- [ ] Run `pnpm --filter @rag-system/api build`
- [ ] Run `node --test apps/api/test/llm-answer-stream.test.js`
- [ ] Run `node --test apps/api/test/ask-stream-service.test.js`
- [ ] Run `node --test --test-concurrency=1 apps/api/test/ask-stream-e2e.test.js`
- [ ] Run `node --test --test-concurrency=1 apps/api/test/ask-chain-e2e.test.js`
- [ ] Run `node --experimental-strip-types --test apps/web/test/api-stream.test.js`
- [ ] Run `node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js`
- [ ] Run `pnpm --filter @rag-system/web build`
- [ ] Confirm final scope boundaries remain intact:

- native text streaming only for answer generation
- final citations and trace metadata still arrive at completion
- no transport migration
- no mobile expansion
