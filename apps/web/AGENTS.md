# AGENTS.md

This file adds frontend-specific rules for `apps/web`.
Apply it together with the repository-root `AGENTS.md`.

## Local Stack Notes

- Vite + React application code lives in `src/`
- UI work should preserve the existing Mantine-based component patterns already used in this app
- styling changes should respect the current Tailwind v4 + Mantine mix instead of replacing one system with another
- `test/pc-web-smoke.test.js` exists as a lightweight smoke path for app-level verification

## Frontend Scope

- frontend work should usually support an already-defined backend capability, not invent a parallel product direction by default
- prefer small, local UI increments over broad redesigns unless the task explicitly asks for redesign
- preserve existing backend contracts unless the task explicitly includes contract changes
- when frontend work depends on backend behavior, read `apps/api` and `packages/shared` first, then align the UI to the existing contract before considering backend edits

## Frontend Execution Bias

- frontend work should default to main-control execution with small, reviewable diffs
- use bounded helper work only for isolated low-risk adaptation that does not alter backend contracts
- avoid bundling backend refactors into a frontend task

## Frontend Design Constraints

When doing frontend design tasks, avoid collapsing into bland, generic layouts.

- preserve the established visual language when working inside existing UI
- ensure the page loads properly on both desktop and mobile
- prefer intentional typography, color, spacing, and motion over boilerplate defaults
- avoid introducing visual churn when the task only asks for functional frontend enablement

## Frontend Validation

Run the smallest relevant frontend validation for the change.

Common commands:

```bash
pnpm --filter @rag-system/web build
pnpm --filter @rag-system/web typecheck
pnpm --filter @rag-system/web lint
pnpm --filter @rag-system/web test:smoke
```

Default validation policy:

- frontend-only changes should run at least the relevant build or typecheck if available
- use `test:smoke` when the change affects top-level app wiring or user-visible page boot behavior
- behavior changes should be verified with the smallest practical runtime or test path
- avoid expensive whole-repo validation when an app-local check is sufficient

## OpenCode Plugin Note

- `apps/web/opencode.jsonc` keeps the web-local OpenCode command templates scoped to `apps/web`
- starting OpenCode from the repo root or `apps/api` uses the shared config and does not depend on the web-local command templates
- root `AGENTS.md` is still discovered when starting inside `apps/web` because OpenCode traverses upward for rules files
