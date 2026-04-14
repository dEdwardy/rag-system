# AGENTS.md

This file adds frontend-specific rules for `apps/web`.
Apply it together with the repository-root `AGENTS.md`.

## Local Stack Notes

- Vite + React application code lives in `src/`
- UI work should preserve the existing Mantine-based component patterns already used in this app
- styling changes should respect the current Tailwind v4 + Mantine mix instead of replacing one system with another
- `test/pc-web-smoke.test.js` remains as a manual local smoke helper for app-level verification

## Frontend Scope

- frontend work should usually support an already-defined backend capability, not invent a parallel product direction by default
- prefer small, local UI increments over broad redesigns unless the task explicitly asks for redesign
- preserve existing backend contracts unless the task explicitly includes contract changes
- when frontend work depends on backend behavior, read `apps/api` and `packages/shared` first, then align the UI to the existing contract before considering backend edits
- treat Chinese UI copy and inline labels as encoding-sensitive; if a page shows mojibake in local dev, verify the source file encoding before changing layout or CSS

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
pnpm --filter @rag-system/web test:guard
pnpm --filter @rag-system/web test:guard:legacy
pnpm --filter @rag-system/web test:legacy
pnpm --filter @rag-system/web test:smoke
pnpm --filter @rag-system/web test:smoke:legacy
```

Default validation policy:

- frontend-only changes should run at least the relevant build or typecheck if available
- use `test:guard` for contract, helper, copy, theme, and source-structure regressions that do not need a browser session
- use `test:guard:legacy` only when your change is expected to touch older source/UX guardrails that are still being triaged and are not part of the stable default guard gate
- use `test:legacy` when you explicitly want the current legacy guard backlog
- the current browser smoke path is still a manual legacy local-dev lane tied to seeded accounts; use `test:smoke:legacy` only when you intentionally want that local browser verification
- `test:smoke` currently aliases that same legacy smoke lane for compatibility
- behavior changes should be verified with the smallest practical runtime or test path
- avoid expensive whole-repo validation when an app-local check is sufficient

## OpenCode Plugin Note

- `apps/web/opencode.jsonc` keeps the web-local OpenCode command templates scoped to `apps/web`
- starting OpenCode from the repo root or `apps/api` uses the shared config and does not depend on the web-local command templates
- root `AGENTS.md` is still discovered when starting inside `apps/web` because OpenCode traverses upward for rules files
