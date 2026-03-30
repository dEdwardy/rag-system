# planner-auto-refill

- 会话: ses_2cb32f380ffe1xwINF81Wrlmbh
- 消息: msg_d34cdfc38001tls7nIEOtutoSv
- 完成: 2026-03-28 22:17:14
- 生成任务数: 1

## 生成任务
- contract-auto-014: surface ask rewrite readability label

## 规划结果
[
  {
    "title": "surface ask rewrite readability label",
    "family": "contract",
    "prompt": "Inspect the existing ask read-model projection path first, especially `apps/api/src/modules/assistants/ask-assistant.service.ts`, `apps/api/src/modules/traces/traces.service.ts`, `apps/api/test/ask-success.test.js`, `apps/api/test/ask-stream-service.test.js`, `apps/web/src/types/api.ts`, `apps/web/test/ask-answering-metadata-contract.test.js`, and `docs/current-dev-setup.md`. Then make the smallest concrete additive change so one-shot ask responses and ask-stream final payloads expose top-level `rewriteReadabilityLabel` aligned with the already-shipped trace-summary wording, preferably by reusing an existing helper path or extracting the narrowest shared helper only if needed. Keep scope behavior-preserving: no retrieval semantic changes, no persistence/schema changes, no unrelated contract cleanup. If the shipped contract surface changes, also update `docs/current-progress.md` and the relevant ask metadata note in `docs/current-dev-setup.md`. Run exactly one focused validation command: `pnpm test:api:file -- test/ask-success.test.js test/ask-stream-service.test.js`. Report the exact changed files and the exact validation command result.",
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
  "total": 74,
  "pending": 0,
  "completed": 72,
  "inProgress": 0,
  "cursor": 74
}

Recent completed queue items:

- docs-auto-003: sync ask contract notes
  result: Implemented as requested (docs-only, minimal diff), then ran exactly one focused validation and committed on the current `dev` branch. ### Inspected code/docs path - `docs/current-progress.md` - `docs/current-dev-setup.md` - `apps/web/test/ask-answering-metadata-contract.test.js` - `apps/web/src/types/api.ts` (to verify shipped ask contract surface) ### Changed files 1. `docs/current-dev-setup.md`
- contract-auto-013: tighten ask web contract guard
  result: Implemented as requested with the smallest scoped change in the existing web contract guard. ### Inspected code path - `apps/web/src/types/api.ts` - `apps/web/test/ask-answering-metadata-contract.test.js` ### Concrete change made Updated the existing contract test to match the current ask response type for the surfaced metadata/readability fields (while keeping the existing metadata coverage intac
- contract-auto-012: surface ask evidence readability sentence
  result: 已按你要求完成本次最小增量实现，并在当前分支提交（未 push / 未开 PR）。 ### 已修改文件（精确） 1. `apps/api/src/modules/assistants/ask-assistant.service.ts` 2. `apps/api/test/ask-success.test.js` 3. `apps/api/test/ask-stream-service.test.js` 4. `apps/web/src/types/api.ts` ### 变更内容（最小范围） - **backend（ask one-shot + ask-stream final）** - 在 two paths 中都先计算并复用： - `answerEvidenceSourceReadabilityLabel` - `answerEvidenceSourceReadabilitySente
```

