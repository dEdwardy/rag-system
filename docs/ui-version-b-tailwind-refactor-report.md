# UI Version B Tailwind Refactor Report

Updated: 2026-03-22
Scope: `PC Web` only

## Objective

Refactor the web UI to match `ui/version-b-creative.html` as closely as possible on desktop while preserving existing frontend behavior, routes, API calls, and stream/chat data flow.

## Implemented

### 1. Tailwind-based styling foundation

- Added `tailwindcss` and `@tailwindcss/vite` to `apps/web`.
- Switched Vite to the Tailwind Vite plugin.
- Replaced the previous large custom global stylesheet with a Tailwind-driven global entry that keeps only:
  - theme variables
  - base element resets
  - animation keyframes

### 2. App shell rebuild

Files:

- `apps/web/src/app/AppShell.tsx`
- `apps/web/src/styles/global.css`

Changes:

- Rebuilt the shell with Tailwind utility classes instead of Mantine layout primitives.
- Matched the target page structure:
  - fixed left sidebar
  - sticky top bar
  - viewport-locked desktop shell with inner scrolling regions
  - dark gradient/grid background
  - brand block, nav groups, badges, user profile block
  - top actions and language switch
- Forced the shell into the `creative-dark + workspace-app` desktop direction required by Version B.
- Replaced hardcoded sidebar badge/model/profile display values with real frontend query data from knowledge bases, documents, and conversations.
- Split `Usage` onto its own `/usage` route and updated active-state matching so only the exact menu item highlights.

### 3. Chat workspace rebuild

Files:

- `apps/web/src/pages/chat/ChatPage.tsx`
- `apps/web/src/components/StatePanel.tsx`

Changes:

- Rebuilt the chat page into the same two-pane structure as `ui/version-b-creative.html`:
  - left: assistant header, transcript area, composer
  - right: single panel containing conversation list and citation cards
- Locked the chat workspace inside the desktop shell so the page itself does not scroll; the transcript pane and the right-side panel each scroll within their own columns when content grows.
- Preserved existing logic:
  - assistants query
  - conversations/messages/traces queries
  - streamed ask mutation
  - optimistic streamed turn rendering
  - trace links and citation links
  - notifications on failure
- Added an initial desktop-friendly auto-selection of the first loaded conversation so the chat workspace opens in a populated state when data exists.

### 4. Source-level regression checks

Files:

- `apps/web/test/ui-tailwind-migration.test.js`
- `apps/web/test/chat-layout-source.test.js`
- `apps/web/test/state-panel-theme.test.js`

Changes:

- Added/updated source assertions for:
  - Tailwind dependency and Vite plugin wiring
  - desktop shell dimensions
  - two-pane chat layout
  - dark state-panel surface styling

## Verification

### Commands run

```bash
node --test apps/web/test/trace-router.test.js apps/web/test/desktop-shell-consistency.test.js
pnpm --filter @rag-system/web test:smoke
pnpm --filter @rag-system/web typecheck
pnpm --filter @rag-system/web build
```

Result:

- Route/highlight consistency checks passed.
- Desktop smoke flow passed.
- `typecheck` passed.
- `build` passed.

Build note:

- Vite still reports the existing large-chunk warning for the web bundle.
- This refactor did not introduce a build failure.

### Browser verification

Artifacts:

- `output/playwright/ui-refactor-audit/target-desktop-edge.png`
- `output/playwright/ui-refactor-audit/target-desktop-chrome.png`
- `output/playwright/ui-refactor-audit/dev3001-desktop-edge.png`
- `output/playwright/ui-refactor-audit-final/target-reference-desktop.png`
- `output/playwright/ui-refactor-audit-final/app-chat-desktop.png`
- `output/playwright/ui-refactor-audit-final/app-knowledge-base-desktop.png`
- `output/playwright/ui-refactor-audit-final/app-usage-desktop.png`
- `output/playwright/ui-refactor-audit-final/app-assistant-desktop.png`

Validation method:

- Used Playwright with local Edge/Chrome channels to confirm the target HTML renders as expected on desktop.
- Used a temporary preview target on `http://127.0.0.1:3001` to validate the refactored app against the real local API.
- Used local Edge for the final desktop screenshot pass against a single temporary static port.
- Desktop-only visual checks are authoritative.

Important environment note:

- The already-running local `5173` dev process does not automatically pick up the new Tailwind/Vite plugin wiring.
- After this refactor, the web dev server needs a restart to load the new styling pipeline.

## Scope boundaries

- No backend files were changed.
- No API contract or data processing logic was changed.
- This delivery is intentionally scoped to `PC Web`.
- Mobile screenshots captured during the implementation process are not part of the acceptance conclusion.

## Main files changed

- `apps/web/package.json`
- `apps/web/vite.config.ts`
- `apps/web/src/styles/global.css`
- `apps/web/src/app/AppShell.tsx`
- `apps/web/src/components/StatePanel.tsx`
- `apps/web/src/pages/chat/ChatPage.tsx`
- `apps/web/src/pages/usage/UsagePage.tsx`
- `apps/web/src/app/router.tsx`
- `apps/web/test/ui-tailwind-migration.test.js`
- `apps/web/test/chat-layout-source.test.js`
- `apps/web/test/state-panel-theme.test.js`
- `apps/web/test/trace-router.test.js`
- `apps/web/test/desktop-shell-consistency.test.js`

## Residual notes

- The repository currently has other unrelated uncommitted changes in the worktree. This refactor was kept focused on the desktop shell/chat UI path and its immediate validation files.
