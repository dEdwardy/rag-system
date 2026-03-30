# planner-auto-refill

- 会话: ses_2cb8807e6ffehqt06jXDbQZ5h9
- 消息: msg_d3478bd2c001t0YZkSZCr5Ila3
- 完成: 2026-03-28 20:44:16
- 生成任务数: 2

## 生成任务
- contract-auto-003: align ask retrieval-mode provenance sentence
- contract-auto-004: align ask missing-info source label

## 规划结果
[
  {
    "title": "align ask retrieval-mode provenance sentence",
    "family": "contract",
    "prompt": "Inspect the existing ask final-payload shaping path first, especially `apps/api/src/modules/assistants/ask-assistant.service.ts`, `packages/shared/src/trace-contracts.ts`, `apps/web/src/types/api.ts`, `apps/api/test/ask-success.test.js`, and `apps/api/test/ask-stream-service.test.js`. Then make the smallest additive contract-alignment change so one-shot ask and stream final payload expose a top-level `retrievalModeProvenanceSentence` that reuses the same wording source already used by trace summary, without changing retrieval behavior or persistence. Update `docs/current-progress.md` if the payload contract changes. Run exactly one focused validation command: `pnpm test:api:file -- test/ask-success.test.js test/ask-stream-service.test.js`. Report the exact changed files and the exact command result; do not bundle refactors or unrelated cleanup.",
    "agent": "rag-build"
  },
  {
    "title": "align ask missing-info source label",
    "family": "contract",
    "prompt": "Inspect the current ask response shaping and missing-information metadata path first, especially `apps/api/src/modules/assistants/ask-assistant.service.ts`, `packages/shared/src/trace-contracts.ts`, `apps/web/src/types/api.ts`, `apps/api/test/ask-success.test.js`, and `apps/api/test/ask-stream-service.test.js`. Then make the smallest additive change so one-shot ask and stream final payload expose top-level missing-information source readability aligned with the existing trace-summary wording (`missingInformationSource` and/or `missingInformationSourceReadabilityLabel` only if directly derivable from current metadata), keeping behavior-preserving semantics and no retrieval/persistence changes. Update `docs/current-progress.md` if the payload contract changes. Run exactly one focused validation command: `pnpm test:api:file -- test/ask-success.test.js test/ask-stream-service.test.js`. Report the exact changed files and the exact command result; no bundled refactors.",
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
  "total": 58,
  "pending": 0,
  "completed": 56,
  "inProgress": 0,
  "cursor": 58
}

Recent completed queue items:

- metadata-missing-info-source-010: stabilize missing-info source labels
  result: 已按你要求直接实施一个最小增量，并完成一次聚焦验证与提交（当前分支 `dev`）。 ### 我先检查的相关代码路径 - `apps/api/src/modules/traces/traces.service.ts` - `packages/shared/src/trace-contracts.ts` - `apps/api/test/traces.service.test.js` - `apps/web/test/trace-summary-contract.test.js` - 文档对齐：`docs/current-dev-setup.md`、`docs/current-progress.md` ### 选择并实现的最小可读性改进 **改进点：** 为 final answer trace 的 missing-information 来源新增可读标签字段。 **新增字段：** `trac
- metadata-retrieval-mode-fallback-009: clarify retrieval fallback mode
  result: Implemented one **minimal, additive, behavior-preserving** retrieval trace readability increment on `dev`. ### What I inspected first - `apps/api/src/modules/traces/traces.service.ts` - `apps/api/src/modules/retrieval/strategy-readability.ts` - `apps/api/test/traces.service.test.js` - `packages/shared/src/trace-contracts.ts` - `apps/web/test/trace-summary-contract.test.js` ### Chosen small gap Tra
- metadata-trace-summary-compact-008: compact trace summary wording
  result: Implemented one **minimal, additive trace-summary readability increment** on `dev` (behavior-preserving, no retrieval semantics changes). ### What I changed 1. **Added new trace-summary field for citation readability sentence** - **File:** `packages/shared/src/trace-contracts.ts` - Added: - `citationCountReadabilitySentence: string` 2. **Populated the new field in backend trace summary projection*
```

