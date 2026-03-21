# Chat Page Visual Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the `PC Web` chat page so it follows the constrained visual direction while borrowing only the most useful workspace ideas from the creative concept.

**Architecture:** Keep the current chat data flow and streaming behavior unchanged. Limit the work to the web chat page and, if needed, a tiny helper adjustment. Rebalance hierarchy across the top context strip, left conversation rail, center transcript workspace, and right citation inspector.

**Tech Stack:** React 19, Mantine, TanStack Query, Vite, Node test runner

---

## File Structure

- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
  - apply the visual refinement and layout rebalancing
- Modify: `apps/web/src/pages/chat/chat-page-helpers.ts`
  - only if small display helpers need cleanup while preserving behavior
- Modify: `docs/current-progress.md`
  - note this chat-page refinement increment if the UI changes land

## Task 1: Lock The Current Behavior With Focused Validation

**Files:**
- Test: `apps/web/test/chat-stream-state.test.js`
- Test: `apps/web/test/chat-page-helpers.test.js`

- [ ] **Step 1: Run the existing focused chat tests before editing**

Run:

```bash
node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js
node --experimental-strip-types --test apps/web/test/chat-page-helpers.test.js
```

Expected: both pass so the current chat behavior baseline is known.

## Task 2: Refine The Chat Page Hierarchy

**Files:**
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`

- [ ] **Step 1: Tighten the top context strip**

Reduce the hero feel and keep only the page identity, assistant status, model status, and short goal copy.

- [ ] **Step 2: Rework the conversation rail presentation**

Keep the same data and actions, but make items read like navigation rows instead of plain buttons.

- [ ] **Step 3: Rebalance the center workspace**

Make the transcript the dominant visual surface and visually connect it more naturally with the composer.

- [ ] **Step 4: Improve message states**

Ensure assistant, user, streaming, and error states have stronger role distinction without changing message semantics.

- [ ] **Step 5: Refine the citation inspector**

Increase title/context/snippet scan efficiency and keep the trace action available but secondary.

## Task 3: Preserve Behavior And Verify

**Files:**
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Modify: `apps/web/src/pages/chat/chat-page-helpers.ts` (only if needed)
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Re-run focused chat tests**

Run:

```bash
node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js
node --experimental-strip-types --test apps/web/test/chat-page-helpers.test.js
```

Expected: pass without behavior regressions.

- [ ] **Step 2: Run the web build**

Run:

```bash
pnpm --filter @rag-system/web build
```

Expected: build succeeds.

- [ ] **Step 3: Update the progress snapshot if the UI refinement lands**

Briefly record that the `Chat` page visual direction has been further refined within the existing `PC Web` priority.
