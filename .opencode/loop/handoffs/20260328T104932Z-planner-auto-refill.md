# planner-auto-refill

- 会话: ses_2cbf15e6effe9RUPVZI6ZMtzSP
- 消息: msg_d341018420011DfcrOqMGbvPTZ
- 完成: 2026-03-28 18:49:32
- 生成任务数: 1

## 生成任务
- source-auto-006: Atom alternate rel token guard

## 规划结果
[
  {
    "title": "Atom alternate rel token guard",
    "family": "source",
    "agent": "rag-build",
    "prompt": "Inspect the existing Atom link extraction path first in `apps/api/src/infra/feed-source/feed-source.service.ts` and the nearby focused coverage in `apps/api/test/parsing.test.js`, then make the smallest concrete backend change so `extractAtomLink(...)` still prefers the canonical alternate link when an Atom `<link>` uses a multi-token or mixed-case `rel` value that includes `alternate` (instead of only exact `rel=\"alternate\"`). Keep scope to this one parsing edge case only; do not refactor unrelated feed parsing or dedup logic. Add one focused regression in `apps/api/test/parsing.test.js`, and if the behavior changes, append one concise progress note to `docs/current-progress.md`. Run exactly one validation command: `pnpm test:api:file -- test/parsing.test.js`. Report the exact changed files and the command result."
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
  "total": 40,
  "pending": 0,
  "completed": 38,
  "inProgress": 0,
  "cursor": 40
}

Recent completed queue items:

- source-auto-005: Atom link single-quote parsing guard
  result: Done — this increment was already implemented on `dev` as requested, with minimal scope and one focused validation. ### Inspected code path first - `apps/api/src/infra/feed-source/feed-source.service.ts` (`extractAtomLink(...)`) - `apps/api/test/parsing.test.js` (nearby feed parsing cases) ### Smallest concrete parsing fix applied - `extractAtomLink(...)` now handles Atom `<link>` attributes when:
- source-auto-004: Sitemap XML text/plain fallback
  result: Implemented on current branch `dev` as requested (no push / no PR). ### Inspected first - `apps/api/src/infra/sitemap-source/sitemap-source.service.ts` - `apps/api/test/parsing.test.js` ### Smallest concrete backend change made 1. **Sitemap content-type fallback added (additive, behavior-preserving)** File: `apps/api/src/infra/sitemap-source/sitemap-source.service.ts` - Kept existing accepted type
- source-sitemap-index-013: Expand sitemap-index stability
  result: Implemented one **minimal sitemap index handling increment** end-to-end (inspect → change → focused validation → commit). ### What code path I inspected first - `apps/api/src/infra/sitemap-source/sitemap-source.service.ts` - `apps/api/test/parsing.test.js` ### Chosen edge case (single focused increment) **Sitemap index XML with namespace-prefixed tags** (e.g. `<sm:sitemapindex>`, `<sm:sitemap>`, `
```

