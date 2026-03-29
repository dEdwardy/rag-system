# planner-auto-refill

- 会话: ses_2c90c6c49ffec5ZvY8vMIbg3j7
- 消息: msg_d36f3ec45001PcSbv1s7MpFshi
- 完成: 2026-03-29 08:17:49
- 生成任务数: 2

## 生成任务
- source-auto-008: P6 usage source-family hotspot panel
- trace-auto-007: P6 usage snapshot window diff view

## 规划结果
[
  {
    "title": "P6 usage source-family hotspot panel",
    "family": "source",
    "prompt": "Inspect the existing P6 usage/dashboard code path first, especially `apps/web/src/pages/usage/UsagePage.tsx`, `apps/web/src/types/api.ts`, and `apps/web/test/ui-review-regressions.test.js`, plus the already-landed backend summary shape in `GET /knowledge-bases/:id/document-runs/summary`. Then make the smallest concrete change to add one scan-first `source-family hotspot` panel to the usage page that reads the existing `bySourceFamily` summary data and highlights which source family currently has the most failures/boundary hits. Keep this additive and behavior-preserving: no backend/API changes, no new endpoint, no generic dashboard refactor. If the page copy or workflow meaning changes, also sync the single relevant note in `docs/current-progress.md`. Run exactly one focused validation command: `node --test --test-name-pattern \"source-family hotspot\" apps/web/test/ui-review-regressions.test.js` (add/adjust the targeted test name as needed). Report the exact changed files and the exact command result.",
    "agent": "rag-build"
  },
  {
    "title": "P6 usage snapshot window diff view",
    "family": "trace",
    "prompt": "Inspect the current comparison flow first: `apps/web/src/features/api/hooks.ts`, `apps/web/src/types/api.ts`, `apps/web/src/pages/usage/UsagePage.tsx`, and `apps/web/test/ui-review-regressions.test.js`, and confirm how the existing backend `GET /knowledge-bases/:id/document-runs/comparison` already supports snapshot-vs-snapshot mode (`leftSinceHours` / `rightSinceHours`). Then make the smallest concrete change to expose one focused `snapshot window diff` view in the usage page (for example 1h vs 24h or 6h vs 24h) using the existing endpoint/hook, without changing backend contract or broadening the page into a larger analytics surface. Keep scope to this one comparison subpanel only; no refactors. If behavior/readability on the page changes, update the matching entry in `docs/current-progress.md`. Run exactly one focused validation command: `node --test --test-name-pattern \"snapshot window diff\" apps/web/test/ui-review-regressions.test.js` (add/adjust the targeted test name as needed). Report the exact changed files and the exact command result.",
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
  "total": 141,
  "pending": 0,
  "completed": 141,
  "deferred": 0,
  "inProgress": 0,
  "cursor": 141
}

Recent completed queue items:

- p6-v1-012: Regression diff view
  result: 已完成该增量，并按最小范围提交。 ### 实施结果（最小改动） 本次只实现 **P6 v1 regression diff view**（run-to-run 简洁差异诊断），复用已有后端 comparison endpoint，不改 backend contract。 已修改并提交的文件： 1. `apps/web/src/types/api.ts` - 新增 `KnowledgeBaseDocumentRunComparison` 相关类型（run/snapshot 两种模式）。 2. `apps/web/src/features/api/hooks.ts` - 新增 `useKnowledgeBaseDocumentRunComparison(...)` hook，调用： - `GET /knowledge-bases/:id/document-runs/comparison` 3.
- p6-v1-011: Anomaly clustering view
  result: 已按最小增量完成实现，并已提交到当前 `dev` 分支。 ### 本次实现（P6 v1 anomaly clustering view） 目标：把相关失败聚在一起，让重复模式更显眼。 #### 变更文件 1. `apps/web/src/pages/usage/UsagePage.tsx` - 新增 `P6 v1 anomaly clustering view`（`P6 v1 异常聚类视图`）子面板 - 复用现有接口数据：`useKnowledgeBaseDocumentRuns(..., { issueOnly: true, sinceHours: 24, limit: 100 })` - 按 `failedStage + failure code + retryable` 聚合失败模式 - 每个聚类展示： - 重复次数（出现 run 数） - retryable / non-retry
- p6-v1-010: Source stats
  result: Implemented ✅ (on `dev` branch), with a minimal backend-first increment for P6 v1 source-family observability. ### What I inspected first (relevant code path) - `apps/api/src/modules/document-runs/document-runs.service.ts` - `apps/api/src/modules/documents/documents.controller.ts` - `apps/api/test/document-runs-summary.test.js` - `apps/web/src/types/api.ts` ### Smallest concrete change made Added 
```

