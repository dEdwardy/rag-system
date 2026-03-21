# PC Web Chat Experience Polish Implementation Plan

> **Execution constraint:** In the current workstation environment, implement and validate this plan in strict serial order. Do not run heavy commands, tests, or review steps in parallel.

**Goal:** Make the `PC Web` chat experience feel materially better by adding streamed answers and redesigning the `Chat` page interaction and visual hierarchy.

**Architecture:** Keep the work centered on the `Chat` page. Add the minimum backend and frontend transport needed for streamed ask responses, then rebuild the chat workspace around a stronger transcript/composer/inspector layout while preserving existing conversation, citation, and trace concepts.

**Tech Stack:** NestJS, React 19, Vite, Mantine, TanStack Query, Node test runner

---

## File Structure

### Existing files to modify

- `docs/current-progress.md`
  - move `PC Web chat experience polish` to the current top priority and defer `external knowledge source expansion`
- `docs/current-dev-setup.md`
  - add focused validation commands and updated workflow notes
- `apps/api/src/modules/assistants/assistants.controller.ts`
  - expose a streamed ask endpoint or streamed response mode if needed
- `apps/api/src/modules/assistants/ask-assistant.service.ts`
  - provide streamed ask orchestration or a stream-friendly execution path
- `apps/api/src/modules/answering/answering.service.ts`
  - support progressive answer delivery if required by the chosen transport
- `apps/web/src/lib/api.ts`
  - add streaming-capable request helper alongside existing JSON request helper
- `apps/web/src/features/api/hooks.ts`
  - add chat-stream hook or mutation flow for progressive answer updates
- `apps/web/src/types/api.ts`
  - add any stream-event or optimistic message types needed by the page
- `apps/web/src/pages/chat/ChatPage.tsx`
  - redesign the page and integrate streaming UX

### Existing tests to modify or extend

- `apps/api/test/ask-chain-e2e.test.js`
  - add focused streamed-ask coverage if backend transport changes
- `apps/web/test/pc-web-smoke.test.js`
  - extend or add targeted chat smoke coverage if practical

### New tests likely to create

- `apps/web/test/chat-page.test.js`
  - focused UI/state regression coverage for streaming and chat states

### Explicit non-goals

- no mobile adaptation
- no all-pages redesign
- no continued external-source implementation in this session
- no unrelated backend refactors

---

### Task 1: Reorder The Active Task And Add Failing Chat-Focused Tests

**Files:**
- Modify: `docs/current-progress.md`
- Modify: `docs/current-dev-setup.md`
- Create or Modify: `apps/web/test/chat-page.test.js`
- Modify: `apps/api/test/ask-chain-e2e.test.js`

- [ ] **Step 1: Update progress tracking to make this the current first task**

Move `PC Web chat experience polish` ahead of `external knowledge source expansion` and note that the external-source task is deferred, not completed.

- [ ] **Step 2: Add a failing frontend test for chat pending / streamed state**

Write the smallest focused test that proves the page should show:

- optimistic user message
- pending assistant shell
- progressive answer content or equivalent streamed state

- [ ] **Step 3: Add a failing backend or integration test for streamed ask transport**

Lock down the expected streamed protocol shape and completion behavior before implementing the transport.

- [ ] **Step 4: Run focused tests to verify RED**

Run only the new focused tests and confirm they fail for missing streaming behavior, not for unrelated setup issues. Execute them one by one.

---

### Task 2: Add Minimal Streaming Support

**Files:**
- Modify: `apps/api/src/modules/assistants/assistants.controller.ts`
- Modify: `apps/api/src/modules/assistants/ask-assistant.service.ts`
- Modify: `apps/api/src/modules/answering/answering.service.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/features/api/hooks.ts`
- Modify: `apps/web/src/types/api.ts`

- [ ] **Step 1: Choose one simple stream transport and lock the event shape**

Keep it local-stack friendly and avoid introducing infrastructure beyond what chat needs right now.

- [ ] **Step 2: Implement backend streamed ask path**

Ensure the stream can represent:

- stream start
- partial answer chunks
- final citations / trace ids / message ids
- error completion

- [ ] **Step 3: Implement frontend stream client helper**

Add a helper that can consume the stream progressively and surface lifecycle events to React state cleanly.

- [ ] **Step 4: Wire the chat hook to support progressive updates**

The hook should let the page:

- append the user message immediately
- show an in-progress assistant message
- progressively update assistant content
- finalize citations and trace metadata on completion

- [ ] **Step 5: Re-run focused streaming tests to verify GREEN**

Run the focused backend/integration and chat-state tests until they pass. Execute them one by one.

---

### Task 3: Redesign The Chat Page

**Files:**
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`

- [ ] **Step 1: Write down the visual thesis in the implementation notes**

Use this direction while building:

- calm research console
- strong center transcript
- lighter conversation rail
- clearer right-side citation inspector

- [ ] **Step 2: Rebuild the page layout around one dominant workspace**

Keep the three-zone model, but make the transcript column visually dominant and reduce generic card stacking.

- [ ] **Step 3: Improve message presentation**

Differentiate:

- user messages
- assistant messages
- pending assistant message
- inline error state

- [ ] **Step 4: Improve composer and ask interaction**

The composer should feel like the primary interaction, with better hierarchy, stronger affordance, and clearer in-flight feedback.

- [ ] **Step 5: Improve citation panel readability**

Make citations easier to scan and keep the trace detail action present but secondary.

- [ ] **Step 6: Add restrained motion**

Use a small number of meaningful transitions for:

- streamed assistant reveal
- pending state
- new message entry

- [ ] **Step 7: Run focused UI tests and local build**

Verify the page still builds and the focused UI behavior remains correct. Execute validation commands one by one.

---

### Task 4: Sync Docs And Validate The New Priority

**Files:**
- Modify: `docs/current-progress.md`
- Modify: `docs/current-dev-setup.md`

- [ ] **Step 1: Update current-dev-setup with the new chat validation path**

Document the focused chat validation commands and note the `PC Web` priority.

- [ ] **Step 2: Update current-progress with what is complete vs still deferred**

Keep `external knowledge source expansion` open but no longer first. Record the new active `PC Web` chat-experience task.

- [ ] **Step 3: Re-run the smallest sufficient final validation**

At minimum:

- relevant API build/tests if backend streaming changed
- relevant web build/tests for chat UI
- keep the full final verification strictly serial

---

## Final Verification

- [ ] Run the focused backend validation for streamed ask behavior
- [ ] Run the focused web validation for chat streaming and UI state
- [ ] Run `pnpm --filter @rag-system/web build`
- [ ] If backend changed, run `pnpm --filter @rag-system/api build`
- [ ] Confirm scope boundaries remain intact:

- `PC Web` only
- `Chat` page first
- `external knowledge source expansion` deferred, not removed
- no mobile work
