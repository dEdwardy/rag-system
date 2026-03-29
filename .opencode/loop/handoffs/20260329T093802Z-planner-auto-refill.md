# planner-auto-refill

- 会话: ses_2c70bf0c3ffei9Ol1lXQi641EY
- 消息: msg_d38f4e175001fdsI30eDHb7j0u
- 完成: 2026-03-29 17:38:02
- 生成任务数: 2

## 生成任务
- contract-auto-028: auth identity-link snapshot fields
- contract-auto-029: auth oauth provider contract reserve

## 规划结果
[
  {
    "title": "auth identity-link snapshot fields",
    "family": "contract",
    "prompt": "Inspect the current Phase 2 auth extension path first: `.opencode/plan/auth-roadmap-local-oidc-github-google.md`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.js`, and `docs/current-progress.md`. Then make the smallest additive Phase 2 schema increment by extending `AuthIdentityLink` only with the still-missing future-link metadata fields that are already implied by the roadmap (`emailSnapshot`, `profileSnapshot`, `lastLoginAt`) while keeping local login, session-cookie auth, seed behavior, and ACL semantics unchanged. Do not add OAuth endpoints, callbacks, provider logic, or broad schema cleanup. Update `docs/current-progress.md` with the landed fact. Run exactly one focused validation command: `pnpm --filter @rag-system/api exec prisma validate`. Report the exact changed files and the exact validation command result.",
    "agent": "rag-build"
  },
  {
    "title": "auth oauth provider contract reserve",
    "family": "contract",
    "prompt": "Inspect the current Phase 2 contract path first: `.opencode/plan/auth-roadmap-local-oidc-github-google.md`, `apps/api/src/modules/auth/auth.schemas.ts`, `apps/api/src/modules/auth/auth.controller.ts`, `apps/api/test/auth-provider-boundary.test.js`, and `docs/current-progress.md`. Then make the smallest additive contract-only change that reserves future OAuth/OIDC provider route shapes without implementing provider login: add a narrow reusable provider/schema boundary for the planned providers (`github`, `google`, `oidc`) and lock it with the existing auth boundary test file. Keep `/auth/login`, `/auth/logout`, `/auth/me`, session-cookie behavior, and current route policy behavior unchanged; do not add real callback flow, token exchange, or frontend wiring. Update `docs/current-progress.md` with the landed contract note. Run exactly one focused validation command: `pnpm test:api:file -- test/auth-provider-boundary.test.js`. Report the exact changed files and the exact validation command result.",
    "agent": "rag-build"
  }
]

## 规划提示词
```text
Planner mode: propose the next narrow queue refill only.

Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, `docs/current-dev-setup.md`, and `README.md` before proposing follow-up queue work.

Current planning bias:
- stay on one narrow mainline increment at a time
- prefer backend/API-first closeout work over new expansion
- prefer additive, behavior-preserving readability/diagnostics/contract alignment work
- do not open a new architecture track, new source family, retrieval semantic rewrite, schema/persistence redesign, or broad UI pass

When choosing the next items:
- use the latest completed queue items and handoff results as the immediate context
- continue the same wave if there is still a small concrete gap to close
- prefer tasks that name exact files or codepaths and can be finished with one focused validation command
- prefer tasks that also keep `docs/current-progress.md` aligned when behavior or workflow changes
- avoid repeating already-completed work or proposing cleanup-only chores

Return JSON array only.
Each item must be an object with:
- `title`: short concrete task title
- `family`: stable family prefix such as `trace`, `loop`, `docs`, `contract`, `embedding`, `source`
- `prompt`: execution-ready build prompt for `rag-build`
- `agent`: usually `rag-build`
- `model`: omit unless a non-default model is clearly needed

Prompt requirements:
- tell the builder to inspect the relevant code path first, then make the smallest concrete change
- name the target files, tests, or docs when they are inferable
- require exactly one focused validation command
- require reporting exact changed files and command results
- keep scope to one meaningful increment; no bundled refactors

Hard limits:
- return at most the requested number of items
- if no good next task exists, return `[]`
- do not emit markdown fences, prose, or explanations outside the JSON array

Return at most 2 items.

Current queue summary:

{
  "total": 212,
  "pending": 0,
  "completed": 212,
  "deferred": 0,
  "inProgress": 0,
  "cursor": 212
}

Recent completed queue items:

- contract-auto-027: auth identity-link schema skeleton
  result: Implemented the requested **smallest Phase 2 additive schema increment** after inspecting the specified auth/persistence surfaces. ### Inspected first (as requested) - `.opencode/plan/auth-roadmap-local-oidc-github-google.md` - `apps/api/prisma/schema.prisma` - `apps/api/prisma/seed.js` - `apps/api/src/modules/auth/auth-identity.contract.ts` - `docs/current-progress.md` ### Concrete changes made 1
- contract-auto-026: auth source enum baseline
  result: Implemented the increment end-to-end (inspect → minimal code change → one focused validation → commit). ### Inspected first (as requested) - `.opencode/plan/auth-roadmap-local-oidc-github-google.md` - `apps/api/src/modules/auth/auth-identity.contract.ts` - `apps/api/src/modules/auth/auth.service.ts` - `apps/api/test/auth-provider-boundary.test.js` - `docs/current-progress.md` ### Minimal additive 
- auth-local-docs-sync-043: auth local docs sync
  result: Implemented as requested (docs-only sync, after inspecting the specified paths first). ### Inspected first - `docs/current-dev-setup.md` - `docs/current-progress.md` - `.opencode/plan/auth-roadmap-local-oidc-github-google.md` (including local-account sections) ### Smallest concrete change made Updated docs to explicitly record the implemented **Phase 1 local-account login baseline** and its bounda
```

