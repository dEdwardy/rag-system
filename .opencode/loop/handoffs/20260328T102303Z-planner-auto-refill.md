# planner-auto-refill

- 会话: ses_2cc08de16ffeTsAu6xysnhbpbJ
- 消息: msg_d33f781e9001qQjNTdF0UJErq7
- 完成: 2026-03-28 18:23:03
- 生成任务数: 2

## 生成任务
- source-auto-004: Sitemap XML text/plain fallback
- source-auto-005: Atom link single-quote parsing guard

## 规划结果
[
  {
    "title": "Sitemap XML text/plain fallback",
    "family": "source",
    "prompt": "Inspect the existing sitemap fetch/parsing path first in `apps/api/src/infra/sitemap-source/sitemap-source.service.ts` and the current source parsing coverage in `apps/api/test/parsing.test.js`. Then make the smallest concrete backend change so sitemap fetches tolerate `content-type` missing/`unknown` or `text/plain` only when the payload clearly looks like sitemap XML (`urlset` or `sitemapindex`), including child sitemap fetches through the same codepath. Keep this additive and behavior-preserving: do not change retry policy, page expansion semantics, persistence, or diagnostics shape beyond what is necessary for this one fallback. If behavior changes, append the minimal matching note to `docs/current-progress.md`. Run exactly one focused validation command: `pnpm test:api:file -- test/parsing.test.js`. Report the exact changed files and the exact command result.",
    "agent": "rag-build"
  },
  {
    "title": "Atom link single-quote parsing guard",
    "family": "source",
    "prompt": "Inspect `apps/api/src/infra/feed-source/feed-source.service.ts` first, especially `extractAtomLink(...)`, and then review the nearby feed parsing cases in `apps/api/test/parsing.test.js`. Make the smallest concrete parsing fix so Atom entries still resolve their canonical link when the `<link>` tag uses single-quoted attributes and/or `rel`/`href` attribute order differs from the current happy path. Keep scope to this one feed parsing edge case only: no refresh-window changes, no dedup redesign, no new source family work. If behavior changes, append the minimal matching note to `docs/current-progress.md`. Run exactly one focused validation command: `pnpm test:api:file -- test/parsing.test.js`. Report the exact changed files and the exact command result.",
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
  "total": 38,
  "pending": 0,
  "completed": 36,
  "inProgress": 0,
  "cursor": 38
}

Recent completed queue items:

- source-sitemap-index-013: Expand sitemap-index stability
  result: Implemented one **minimal sitemap index handling increment** end-to-end (inspect → change → focused validation → commit). ### What code path I inspected first - `apps/api/src/infra/sitemap-source/sitemap-source.service.ts` - `apps/api/test/parsing.test.js` ### Chosen edge case (single focused increment) **Sitemap index XML with namespace-prefixed tags** (e.g. `<sm:sitemapindex>`, `<sm:sitemap>`, `
- source-feed-refresh-012: Refresh feed source flow
  result: 已按要求完成一个**最小 backend 增量**（当前分支 `dev`），并已提交。 ### 1) 先检查的相关代码路径 - `apps/api/src/infra/feed-source/feed-source.service.ts` - 重点看 `selectEntryBlocksByFreshness(...)`（feed 刷新窗口/截断逻辑） - `apps/api/test/parsing.test.js` - 现有 feed 解析与 freshness/dedup 回归测试 ### 2) 本次最小改动（1 个 focused increment） #### 改动文件 1. `apps/api/src/infra/feed-source/feed-source.service.ts` - 调整 `selectEntryBlocksByFreshness(...)`： - 之前：
- source-cache-011: Add cache guard
  result: Implemented one **minimal stale-response guard increment** on `dev` and committed it. ### What I inspected first (relevant code path) - `apps/api/src/modules/documents/documents.service.ts` - external-source create/resync flow: - `createWebPageDocument` - `createFeedDocument` - `createSitemapDocument` - `resyncExternalDocument` - existing stale-version guard logic: - `ensureCurrentExternalDocument
```

