# planner-auto-refill

- 会话: ses_2c62f8ba9ffeUyi7BZryn3sBAY
- 消息: msg_d39d2bbb0001Swl2TOW5uWu6C0
- 完成: 2026-03-29 21:40:24
- 生成任务数: 1

## 生成任务
- p3-stabilization-auto-001: p3-web-partial-run-summary-anchor-coverage

## 规划结果
[
  {
    "title": "p3-web-partial-run-summary-anchor-coverage",
    "family": "p3-stabilization",
    "agent": "rag-build",
    "prompt": "Inspect the existing run-summary path before changing anything: read `apps/api/src/modules/document-runs/document-runs.service.ts` and `apps/api/test/document-runs-summary.test.js`, then confirm how `EXTERNAL_SOURCE_PARTIAL_SUCCESS` anchors are built today for `latestFailure` / `latestPartialSourceFailure`. Also spot-check the already-landed web body diagnostics shape in `apps/api/src/infra/web-page/web-page.service.ts` and the related body-quality tests in `apps/api/test/parsing.test.js` so the increment stays aligned with current P3 behavior. Then implement the smallest possible closeout increment: lock the web-page body-missing / low-body-quality partial-diagnostics behavior into document-run summary coverage, adding or adjusting code only if the summary anchor path is currently dropping useful failure context. Prefer a test-first/focused change in `apps/api/test/document-runs-summary.test.js`; touch `apps/api/src/modules/document-runs/document-runs.service.ts` only if needed to preserve the already-landed diagnostic message through the summary anchor output. Do not broaden into new source families, UI work, report-center work, or generic refactors. Run exactly one validation command: `pnpm test:api:file -- test/document-runs-summary.test.js`. In your final report, include the exact files changed and the exact validation command/result."
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
  "total": 248,
  "pending": 0,
  "completed": 248,
  "deferred": 0,
  "inProgress": 0,
  "cursor": 248
}

Recent completed queue items:

- loop-queue-refresh-072: loop queue refresh
  result: 已按你给的执行模式完成本次 **queue-closeout refresh（072）**，并先检查了指定路径与前置 handoff/result（067–071）。 ### 先检查内容 - `.opencode/loop/queue.json` - `.opencode/loop/queue-refinement-plan-2026-03-29.md` - `docs/current-progress.md` - 前置 handoff/result： - `.opencode/loop/handoffs/20260329T131838Z-p3-source-gaplist-refresh-067.md` - `.opencode/loop/handoffs/20260329T132235Z-p3-source-retry-timeout-diagnostics-068.md` - `.o
- p3-source-followup-docs-sync-071: source follow-up docs sync
  result: 已按你的要求完成一个**最小 docs-only 同步增量**，并已提交到当前分支（`dev`）。 ### 先检查的文档 - `docs/next_steps_rag_project_plan.md` - `docs/current-dev-setup.md` - `docs/current-progress.md` ### 本次实际改动文件 1. `docs/next_steps_rag_project_plan.md` 2. `docs/current-dev-setup.md` 3. `docs/current-progress.md` ### 改动内容（最小范围） - 在 `next_steps` 的 `P3 follow-up micro-wave` 段补齐： - extra batch 覆盖的 remaining safe gaps（三项） - 该 extra batch 复用
- p3-external-resync-error-code-consistency-070: external resync error-code consistency
  result: Implemented as requested: inspected the existing external resync config-failure path and `test/external-source-sync.test.js`, then made a **small backend-only consistency pass** for config-failure code/readability without changing recovery semantics. ### What I changed 1. **Aligned unrecoverable config-failure readability by source family** while keeping code/semantics unchanged: - Still uses `cod
```

