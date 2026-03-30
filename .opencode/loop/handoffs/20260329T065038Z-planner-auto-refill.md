# planner-auto-refill

- 会话: ses_2c7a59416ffe9Grjea0j9IvW8B
- 消息: msg_d385b6f80001WcveFLRxF17twe
- 完成: 2026-03-29 14:50:38
- 生成任务数: 1

## 生成任务
- contract-auto-022: lock issue-hotspot dominant-shift tie-break

## 规划结果
[
  {
    "title": "lock issue-hotspot dominant-shift tie-break",
    "family": "contract",
    "prompt": "先检查现有 document-run comparison 的实现与回归：`apps/api/src/modules/document-runs/document-runs.service.ts`、`apps/api/test/document-runs-summary.test.js`。然后只做一个最小 backend-first 收口：把 snapshot `issueHotspotSlice.dominantShift` 的选取规则补成显式且稳定的 contract（重点是 issue concentration / issue signal 并列时的 deterministic tie-break），并补一条 focused regression，避免后续排序细节漂移导致 usage scan-first 文案锚点抖动。不要改 endpoint 路径，不要扩 dashboard，不要引入新 source family 语义；如行为说明需要同步，再最小更新 `docs/current-progress.md`。最后只运行这一个验证命令：`pnpm test:api:file -- test/document-runs-summary.test.js`。汇报时给出准确修改文件列表和该命令的结果。",
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
  "total": 192,
  "pending": 0,
  "completed": 192,
  "deferred": 0,
  "inProgress": 0,
  "cursor": 192
}

Recent completed queue items:

- docs-queue-followup-032: queue follow-up docs sync
  result: 已按你的要求执行：先检查了这三处文档路径，再做了最小 docs-only 同步，并提交到当前 `dev` 分支。 ### 已检查（先读） - `docs/next_steps_rag_project_plan.md` - `docs/current-progress.md` - `.opencode/loop/queue-refinement-plan-2026-03-29.md` ### 实际改动（最小范围，docs-only） 1. `docs/next_steps_rag_project_plan.md` - 在“第二批 queue refinement note（2026-03-29）”下补充状态句，明确： - 第一批 refined queue batch 已按顺序完成； - 第二批是 closeout 风格（contract/guard/docs-sync）收口，不是新 wav
- p6-comparison-null-docs-031: document-run comparison null-contract docs sync
  result: Done — I followed the requested execution mode (inspect first → smallest docs-only change → one focused validation → commit). ### Inspected first - `docs/current-dev-setup.md` - `docs/current-progress.md` - current document-run comparison closeout notes in: - `docs/next_steps_rag_project_plan.md` (queue refinement note mentioning snapshot hotspot null-state closeout) - existing `issueHotspotSlice`
- p6-hotspot-wording-030: usage hotspot dominant-shift wording guard
  result: Implemented the requested minimal regression-guard increment after inspecting the specified code path. ### Inspected first - `apps/web/src/pages/usage/UsagePage.tsx` - `apps/web/test/ui-review-regressions.test.js` ### Smallest concrete change made I added focused snapshot guard assertions in: - `apps/web/test/ui-review-regressions.test.js` Specifically, inside the existing **“snapshot window diff”
```

