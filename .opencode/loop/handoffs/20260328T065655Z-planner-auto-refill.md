# planner-auto-refill

- 会话: ses_2ccc52e41ffeEFJrVGW9zVY7F7
- 消息: msg_d333af1070011KBgiccDIkDLVP
- 完成: 2026-03-28 14:56:55
- 生成任务数: 2

## 生成任务
- trace-auto-002: Align unknown/fallback trace readability wording
- loop-auto-001: Add read-model metadata build prompt template

## 规划结果
[
  {
    "title": "Align unknown/fallback trace readability wording",
    "family": "trace",
    "prompt": "Inspect the existing trace-summary readability path first in `apps/api/src/modules/traces/traces.service.ts` and the focused expectations in `apps/api/test/traces.service.test.js`, then make the smallest additive behavior-preserving wording alignment for the remaining unknown/fallback readability labels called out by the current plan wave (`failedStageReadabilityLabel`, `answerStatusSourceReadabilityLabel`, `answerTextSourceReadabilityLabel`, and any directly shared local helpers they already use). Do not change retrieval semantics, contracts, persistence, or unrelated labels. If wording changes, also add one concise closeout note to `docs/current-progress.md`. Run exactly one focused validation command: `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`. Report the exact changed files and the command result.",
    "agent": "rag-build"
  },
  {
    "title": "Add read-model metadata build prompt template",
    "family": "loop",
    "prompt": "Inspect the current loop prompt flow first in `.opencode/loop/prompts/`, `scripts/opencode-loop.md`, and any prompt-selection code that already references generated/build prompts, then make the smallest concrete change to add a dedicated read-model/metadata-convergence build prompt template instead of reusing the generic build wording. Keep scope limited to the existing opencode loop prompt path; do not redesign queueing, model routing, or planner behavior. Update `docs/current-progress.md` only if the workflow surface changes. Run exactly one focused validation command: `node scripts/opencode-loop.mjs --self-test`. Report the exact changed files and the command result.",
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
  "total": 10,
  "pending": 0,
  "completed": 10,
  "inProgress": 0,
  "cursor": 10
}

Recent completed queue items:

- trace-auto-001: Lock legacy trace fallback backfill with focused regression test
  result: Implemented as requested (inspect first, then minimal concrete change, backend-first, no retrieval-semantic changes). ### What I inspected first - `apps/api/src/modules/traces/traces.service.ts` - Verified legacy backfill chain for `strategySummary.usedFallback`: - `retrievalMetadata.execution.usedFallback` - `strategySummary.usedFallback` - legacy top-level `retrievalMetadata.usedFallback` - deri
- contract-auto-001: Guard latest trace summary readability fields in web contract
  result: Implemented as requested (smallest additive web-side contract guard alignment after inspecting the three files). ### Inspected code path - `packages/shared/src/trace-contracts.ts` - `apps/web/src/types/api.ts` - `apps/web/test/trace-summary-contract.test.js` ### Smallest concrete change made Updated the web contract guard test to cover already-existing `TraceAnswerAttributionSummary` readability-r
- opencode-model-routing-008: Review OpenCode model split
  result: 已按你的要求执行：先读了 `AGENTS.md` 和三份 OpenCode 配置，再做最小落地改动与快验证。 ### 结论（model split 评估） 当前 `plan / build / explore / review-risk` 的模型分工**仍然合理**，没有出现明确的成本/质量反转信号，因此**保持现状**： - `plan` / `review-risk` → `openai/gpt-5.4`（更高质量的规划与高风险审查） - `build` → `openai/gpt-5.3-codex`（实现效率与代码执行适配） - `explore` → `openai/gpt-5.3-mini`（低成本窄检索） ### 实施的最小改动 我没有改动模型映射本身，只补充了“为何保持该分工”的就地注释（最小 diff）： 1. `opencode.jsonc` 2. `apps/api/
```

