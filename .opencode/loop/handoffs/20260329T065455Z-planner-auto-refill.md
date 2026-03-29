# planner-auto-refill

- 会话: ses_2c7a23895ffelExn1rQDcjxpZB
- 消息: msg_d385f6a57001lOFKP4iJCYD7Jb
- 完成: 2026-03-29 14:54:55
- 生成任务数: 2

## 生成任务
- docs-auto-004: mark P2 ACL baseline closeout
- contract-auto-023: guard hotspot dominant-shift web contract

## 规划结果
[
  {
    "title": "mark P2 ACL baseline closeout",
    "family": "docs",
    "prompt": "Inspect `docs/next_steps_rag_project_plan.md` and `docs/current-progress.md` first, using the latest completed P2/ACL queue items as the source of truth. Then make the smallest docs-only change to mark the current owner-only ACL baseline as closed out in planning/status docs: explicitly record what is now done, what remains intentionally deferred (`member/viewer`, share/public expansion, RBAC/ABAC, cross-tenant collaboration), and avoid opening a new ACL wave or changing roadmap order. Keep scope to these docs only unless one more status doc update is strictly required. Run exactly one focused validation command: `git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md`. Report exact changed files and the command result.",
    "agent": "rag-build"
  },
  {
    "title": "guard hotspot dominant-shift web contract",
    "family": "contract",
    "prompt": "Inspect `apps/api/test/document-runs-summary.test.js`, `apps/web/src/types/api.ts`, and `apps/web/test/document-run-contract.test.js` first. Then make the smallest contract-alignment change so the web-side snapshot comparison guard explicitly locks the current backend `issueHotspotSlice` shape, especially `dominantShift` and the null-stable hotspot fields, without changing endpoint behavior, dashboard scope, or unrelated UI code. Only update `docs/current-progress.md` if the contract guard meaningfully changes the recorded closeout status. Run exactly one focused validation command: `node --test apps/web/test/document-run-contract.test.js`. Report exact changed files and the command result.",
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
  "total": 193,
  "pending": 0,
  "completed": 193,
  "deferred": 0,
  "inProgress": 0,
  "cursor": 193
}

Recent completed queue items:

- contract-auto-022: lock issue-hotspot dominant-shift tie-break
  result: 已按你的要求直接实施最小收口（backend-first）并完成一次 focused 验证 + 提交。 ### 先检查的代码路径 - `apps/api/src/modules/document-runs/document-runs.service.ts` - `apps/api/test/document-runs-summary.test.js` ### 最小改动内容 1. **显式化并稳定 `issueHotspotSlice.dominantShift` 选取 contract** - 文件：`apps/api/src/modules/document-runs/document-runs.service.ts` - 改动： - 将 `dominantShift` 的排序逻辑抽成显式 comparator：`compareDominantShiftCandidates` - 明确 
- docs-queue-followup-032: queue follow-up docs sync
  result: 已按你的要求执行：先检查了这三处文档路径，再做了最小 docs-only 同步，并提交到当前 `dev` 分支。 ### 已检查（先读） - `docs/next_steps_rag_project_plan.md` - `docs/current-progress.md` - `.opencode/loop/queue-refinement-plan-2026-03-29.md` ### 实际改动（最小范围，docs-only） 1. `docs/next_steps_rag_project_plan.md` - 在“第二批 queue refinement note（2026-03-29）”下补充状态句，明确： - 第一批 refined queue batch 已按顺序完成； - 第二批是 closeout 风格（contract/guard/docs-sync）收口，不是新 wav
- p6-comparison-null-docs-031: document-run comparison null-contract docs sync
  result: Done — I followed the requested execution mode (inspect first → smallest docs-only change → one focused validation → commit). ### Inspected first - `docs/current-dev-setup.md` - `docs/current-progress.md` - current document-run comparison closeout notes in: - `docs/next_steps_rag_project_plan.md` (queue refinement note mentioning snapshot hotspot null-state closeout) - existing `issueHotspotSlice`
```

