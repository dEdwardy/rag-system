# Client Priority Realignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update planning docs so the repository now treats PC Web as the current client scope and defers mobile adaptation until later.

**Architecture:** This is a documentation-only change. Update the progress and setup docs, then ensure the first unchecked item selected by the existing workflow is no longer the mobile task.

**Tech Stack:** Markdown documentation

---

### Task 1: Record The Priority Shift

**Files:**
- Create: `docs/superpowers/specs/2026-03-21-client-priority-realignment-design.md`
- Create: `docs/superpowers/plans/2026-03-21-client-priority-realignment-plan.md`

- [ ] **Step 1: Write the design note**

Capture the decision that the current client scope is PC Web only and mobile is deferred.

- [ ] **Step 2: Write the implementation plan**

Document the concrete repo-doc changes required to enforce the new priority order.

### Task 2: Update Current Progress

**Files:**
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update the Web unfinished-work section**

Make validation / E2E work higher priority than mobile.

- [ ] **Step 2: Update the recommended next steps**

Ensure the first unchecked item now reflects the new priority order.

### Task 3: Update Dev Setup

**Files:**
- Modify: `docs/current-dev-setup.md`

- [ ] **Step 1: Clarify current client target**

State that the current client focus is PC Web.

- [ ] **Step 2: Clarify mobile status**

State that mobile adaptation is intentionally deferred until later.
