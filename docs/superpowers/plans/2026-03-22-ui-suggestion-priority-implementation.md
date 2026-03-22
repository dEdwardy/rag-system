# UI Suggestion Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `ui/suggestion.md` frontend review recommendations in priority order, starting with desktop accessibility and contrast fixes, then tightening key feedback and interaction states.

**Architecture:** Keep the existing route and data flow intact while improving the shared desktop shell, shared workspace styling tokens, and page-level interaction affordances. Prefer global fixes for contrast, focus, and component semantics, then apply narrow page-level changes only where the shared layer is insufficient.

**Tech Stack:** React 19, Mantine 8, React Router 7, Tailwind CSS v4, Playwright, TypeScript

---

### Task 1: High-Priority Accessibility And Contrast Baseline

**Files:**
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/styles/global.css`
- Modify: `apps/web/src/app/AppShell.tsx`
- Modify: `apps/web/src/pages/assistant/AssistantPage.tsx`
- Modify: `apps/web/src/pages/documents/DocumentsPage.tsx`
- Modify: `apps/web/src/pages/documents/DocumentDetailPage.tsx`
- Modify: `apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx`
- Modify: `apps/web/src/pages/traces/TraceListPage.tsx`
- Modify: `apps/web/src/pages/traces/TraceDetailPage.tsx`
- Modify: `apps/web/src/pages/usage/UsagePage.tsx`

- [ ] **Step 1: Audit shared contrast and semantic gaps**
- [ ] **Step 2: Add shared dark-surface, focus-visible, input, table, and utility classes**
- [ ] **Step 3: Force Mantine desktop workspaces to the same dark color scheme**
- [ ] **Step 4: Add missing `aria-label`, `aria-current`, `aria-live`, and landmark semantics on shell and key controls**
- [ ] **Step 5: Re-run `pnpm --filter @rag-system/web typecheck`**

### Task 2: Medium-Priority Feedback And Interaction Refinement

**Files:**
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Modify: `apps/web/src/components/StatePanel.tsx`
- Modify: `apps/web/src/pages/documents/DocumentsPage.tsx`
- Modify: `apps/web/src/pages/traces/TraceListPage.tsx`
- Modify: `apps/web/src/pages/traces/TraceDetailPage.tsx`

- [ ] **Step 1: Tighten loading and empty-state feedback in critical non-chat surfaces**
- [ ] **Step 2: Improve hover/focus feedback for navigation, links, buttons, and table actions**
- [ ] **Step 3: Add restrained transition polish where existing state changes feel abrupt**
- [ ] **Step 4: Re-run minimal web verification commands**

### Task 3: Verification, Report, And Delivery

**Files:**
- Modify: `docs/ui-version-b-tailwind-refactor-report.md`

- [ ] **Step 1: Capture desktop screenshots from `5173` for the priority-fixed pages**
- [ ] **Step 2: Update the implementation report with the review-driven fixes**
- [ ] **Step 3: Commit only task-related files**
- [ ] **Step 4: Push the branch**
