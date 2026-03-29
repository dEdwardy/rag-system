# planner-auto-refill

- 会话: ses_2cb6d41c1ffen7SxtT6A91tlBo
- 消息: msg_d34943422001W0KsqGWRKZmLUQ
- 完成: 2026-03-28 21:14:06
- 生成任务数: 2

## 生成任务
- contract-auto-006: share ask/trace missing-info label helper
- contract-auto-007: add ask missing-info provenance sentence

## 规划结果
[
  {
    "title": "share ask/trace missing-info label helper",
    "family": "contract",
    "agent": "rag-build",
    "prompt": "Inspect the existing missing-information readability path first in `apps/api/src/modules/assistants/ask-assistant.service.ts`, `apps/api/src/modules/traces/traces.service.ts`, and any nearby helper modules. Then make the smallest behavior-preserving change to stop ask/trace from carrying duplicate `missingInformationSourceReadabilityLabel` wording logic—prefer extracting or reusing one narrow backend helper instead of editing wording in two places. Keep scope to this one convergence increment only; do not refactor unrelated readability builders. Add or adjust only the most relevant focused tests in `apps/api/test/ask-success.test.js`, `apps/api/test/ask-stream-service.test.js`, and/or `apps/api/test/traces.service.test.js`. Run exactly one validation command: `pnpm test:api:file -- test/traces.service.test.js test/ask-success.test.js test/ask-stream-service.test.js`. Report the exact changed files and the command result."
  },
  {
    "title": "add ask missing-info provenance sentence",
    "family": "contract",
    "agent": "rag-build",
    "prompt": "Inspect the current ask-response readability path first in `apps/api/src/modules/assistants/ask-assistant.service.ts`, `apps/api/src/modules/traces/traces.service.ts`, `apps/web/src/types/api.ts`, and `apps/web/test/ask-answering-metadata-contract.test.js`. Then make the smallest additive contract-alignment change to expose top-level `missingInformationProvenanceSentence` on ask one-shot and ask-stream final payloads by reusing the existing trace/read-model wording path instead of inventing new wording. Update `docs/current-dev-setup.md` and `docs/current-progress.md` only if the shipped ask contract changes. Keep scope to this single field; no bundled refactors or extra metadata additions. Add focused coverage in `apps/api/test/ask-success.test.js`, `apps/api/test/ask-stream-service.test.js`, and the existing web contract guard. Run exactly one validation command: `pnpm test:api:file -- test/ask-success.test.js test/ask-stream-service.test.js`. Report the exact changed files and the command result."
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
  "total": 62,
  "pending": 0,
  "completed": 60,
  "inProgress": 0,
  "cursor": 62
}

Recent completed queue items:

- docs-auto-001: sync ask response metadata docs to shipped contract
  result: 已按你的要求执行（先检查代码路径 → 最小文档改动 → 仅一次指定验证 → 提交）。 ### 已检查的对照路径 1. `docs/current-dev-setup.md`（`current ask response metadata semantics` 段落） 2. `apps/api/src/modules/assistants/ask-assistant.service.ts` 3. `apps/web/src/types/api.ts` 对照结果：ask one-shot 与 ask-stream final 的实际 payload 已包含多项顶层可读性/溯源字段（如 `strategyReadabilityLabel`、`retrievalModeProvenanceSentence`、`answerAttributionReadabilitySentence`、`answer
- contract-auto-005: guard ask response readability fields in web contract
  result: Implemented the increment directly with the smallest diff after inspecting the requested contract path. ### Inspected code path 1. `apps/web/src/types/api.ts` 2. `apps/web/test/ask-answering-metadata-contract.test.js` 3. `apps/api/src/modules/assistants/ask-assistant.service.ts` ### Concrete change made Updated the existing web ask contract guard test to explicitly cover the additive top-level ask
- contract-auto-004: align ask missing-info source label
  result: 已完成实现并提交。 **Commit** - `6a72a5e` - message: `fix: expose ask missing-information source readability` **本次提交实际变更文件（exact）** 1. `apps/api/src/modules/assistants/ask-assistant.service.ts` 2. `apps/api/src/modules/retrieval/strategy-readability.ts` 3. `apps/api/src/modules/traces/traces.service.ts` 4. `apps/api/test/ask-stream-service.test.js` 5. `apps/api/test/ask-success.test.js` 6. `apps/web/src/ty
```

