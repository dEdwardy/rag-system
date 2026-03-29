# planner-auto-refill

- 会话: ses_2cb7eac9affeYNFjBcIuOHP1Qt
- 消息: msg_d34828fb8001MYfBRiGjDEZJuP
- 完成: 2026-03-28 20:54:46
- 生成任务数: 2

## 生成任务
- contract-auto-005: guard ask response readability fields in web contract
- docs-auto-001: sync ask response metadata docs to shipped contract

## 规划结果
[
  {
    "title": "guard ask response readability fields in web contract",
    "family": "contract",
    "prompt": "Inspect the current ask-response contract path first: `apps/web/src/types/api.ts`, `apps/web/test/ask-answering-metadata-contract.test.js`, and the recent backend payload source in `apps/api/src/modules/assistants/ask-assistant.service.ts`. Then make the smallest concrete change to keep the web-side contract guard aligned with the already-shipped additive top-level ask fields from the latest contract wave. Prefer updating the existing ask contract test file instead of adding a new test family. Target the current top-level ask fields that appear to lack explicit web guard coverage, such as `strategyReadabilityLabel`, `retrievalModeProvenanceSentence`, `answerAttributionReadabilitySentence`, `answerEvidenceSource`, `answerEvidenceSourceReadabilityLabel`, `missingInformationSource`, and `missingInformationSourceReadabilityLabel`. Do not broaden into backend refactors or UI work. Run exactly one focused validation command: `node --test apps/web/test/ask-answering-metadata-contract.test.js`. Report the exact changed files and the exact command result.",
    "agent": "rag-build"
  },
  {
    "title": "sync ask response metadata docs to shipped contract",
    "family": "docs",
    "prompt": "Inspect the current ask-response metadata wording first in `docs/current-dev-setup.md` and compare it against the already-shipped ask payload surface in `apps/api/src/modules/assistants/ask-assistant.service.ts` and `apps/web/src/types/api.ts`. Then make the smallest documentation-only alignment change so the `current ask response metadata semantics` section mentions the additive top-level readability/provenance fields that now ship on ask/final-stream payloads, without inventing new contract details. If the behavior description changes materially, append one short aligned note in `docs/current-progress.md`; otherwise keep the change to `docs/current-dev-setup.md` only. Do not touch runtime code. Run exactly one focused validation command: `git diff --check -- docs/current-dev-setup.md docs/current-progress.md`. Report the exact changed files and the exact command result.",
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
  "total": 60,
  "pending": 0,
  "completed": 58,
  "inProgress": 0,
  "cursor": 60
}

Recent completed queue items:

- contract-auto-004: align ask missing-info source label
  result: 已完成实现并提交。 **Commit** - `6a72a5e` - message: `fix: expose ask missing-information source readability` **本次提交实际变更文件（exact）** 1. `apps/api/src/modules/assistants/ask-assistant.service.ts` 2. `apps/api/src/modules/retrieval/strategy-readability.ts` 3. `apps/api/src/modules/traces/traces.service.ts` 4. `apps/api/test/ask-stream-service.test.js` 5. `apps/api/test/ask-success.test.js` 6. `apps/web/src/ty
- contract-auto-003: align ask retrieval-mode provenance sentence
  result: 已按你给定范围完成实现并完成最小验证。 ### 变更文件（精确） - `apps/api/src/modules/assistants/ask-assistant.service.ts` - `apps/api/src/modules/retrieval/strategy-readability.ts` - `apps/api/src/modules/traces/traces.service.ts` - `apps/api/test/ask-stream-service.test.js` - `apps/api/test/ask-success.test.js` - `apps/web/src/types/api.ts` - `docs/current-progress.md` ### 结果说明 - one-shot ask 与 stream final payload 现在都新增顶层字
- metadata-missing-info-source-010: stabilize missing-info source labels
  result: 已按你要求直接实施一个最小增量，并完成一次聚焦验证与提交（当前分支 `dev`）。 ### 我先检查的相关代码路径 - `apps/api/src/modules/traces/traces.service.ts` - `packages/shared/src/trace-contracts.ts` - `apps/api/test/traces.service.test.js` - `apps/web/test/trace-summary-contract.test.js` - 文档对齐：`docs/current-dev-setup.md`、`docs/current-progress.md` ### 选择并实现的最小可读性改进 **改进点：** 为 final answer trace 的 missing-information 来源新增可读标签字段。 **新增字段：** `trac
```

