# planner-auto-refill

- 会话: ses_2c908252cffeu5FnOPeH9m7TXi
- 消息: msg_d36f869f6001Scqhsz6qcKwca4
- 完成: 2026-03-29 08:22:51
- 生成任务数: 2

## 生成任务
- contract-auto-019: Snapshot comparison source-family deltas
- source-auto-009: Usage snapshot diff family drilldown

## 规划结果
[
  {
    "title": "Snapshot comparison source-family deltas",
    "family": "contract",
    "prompt": "Inspect the existing comparison/summary code path first, especially `apps/api/src/modules/document-runs/document-runs.service.ts`, `apps/api/src/modules/documents/documents.controller.ts`, `apps/api/src/modules/documents/document.schemas.ts`, and `apps/api/test/document-runs-summary.test.js`. Then make the smallest additive backend/API change so `GET /knowledge-bases/:id/document-runs/comparison` snapshot mode also returns source-family delta data derived from the already-existing `bySourceFamily` summary buckets. Keep run-comparison mode unchanged, keep existing failure/boundary semantics unchanged, and do not open a broader analytics redesign. If the response shape changes, update `docs/current-progress.md` in the same increment. Run exactly one focused validation command: `pnpm test:api:file -- test/document-runs-summary.test.js`. Report the exact changed files and the exact command result.",
    "agent": "rag-build"
  },
  {
    "title": "Usage snapshot diff family drilldown",
    "family": "source",
    "prompt": "Inspect the current usage-page snapshot diff path first, especially `apps/web/src/pages/usage/UsagePage.tsx`, `apps/web/src/features/api/hooks.ts`, `apps/web/src/types/api.ts`, and `apps/web/test/ui-review-regressions.test.js`, and confirm how the recent `snapshot window diff` and `source-family hotspot` panels are currently wired. Then make the smallest frontend-only change to the existing snapshot diff panel so it can show one concise source-family drilldown based on the comparison response, explaining which source family is driving the 6h vs 24h issue-window shift. Reuse the existing endpoint/hook contract; do not add a new route, do not broaden the page into a generic dashboard, and keep the change scoped to this one panel. Update `docs/current-progress.md` if behavior changes. Run exactly one focused validation command: `node --test --test-name-pattern \"snapshot window diff\" apps/web/test/ui-review-regressions.test.js`. Report the exact changed files and the exact command result.",
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
  "total": 143,
  "pending": 0,
  "completed": 143,
  "deferred": 0,
  "inProgress": 0,
  "cursor": 143
}

Recent completed queue items:

- trace-auto-007: P6 usage snapshot window diff view
  result: 已按你要求完成并提交（仅最小范围增量）。 ### 已提交的文件（仅本次增量） 1. `apps/web/src/pages/usage/UsagePage.tsx` 2. `apps/web/test/ui-review-regressions.test.js` 3. `docs/current-progress.md` ### 提交信息 - **commit**: `2a453ce` - **message**: `feat(usage): add focused snapshot-window diff panel` - **branch**: `dev` - 未执行 push / PR（按你的要求留到后续） ### 你指定的唯一 focused validation（原样） ```bash node --test --test-name-pattern "snapshot windo
- source-auto-008: P6 usage source-family hotspot panel
  result: Implemented as requested (additive, frontend-only, no backend/API contract changes). ### Inspected code path first I reviewed: - `apps/web/src/pages/usage/UsagePage.tsx` - `apps/web/src/types/api.ts` (confirmed `KnowledgeBaseDocumentRunSummary.bySourceFamily` is already present) - `apps/web/test/ui-review-regressions.test.js` - Backend summary path: - `apps/api/src/modules/documents/documents.cont
- p6-v1-012: Regression diff view
  result: 已完成该增量，并按最小范围提交。 ### 实施结果（最小改动） 本次只实现 **P6 v1 regression diff view**（run-to-run 简洁差异诊断），复用已有后端 comparison endpoint，不改 backend contract。 已修改并提交的文件： 1. `apps/web/src/types/api.ts` - 新增 `KnowledgeBaseDocumentRunComparison` 相关类型（run/snapshot 两种模式）。 2. `apps/web/src/features/api/hooks.ts` - 新增 `useKnowledgeBaseDocumentRunComparison(...)` hook，调用： - `GET /knowledge-bases/:id/document-runs/comparison` 3.
```

