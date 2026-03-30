# planner-auto-refill

- 会话: ses_2cb5702d5ffeKvvJYYo3ZyERKO
- 消息: msg_d34aa165d001HRd1vtWw77S7Oj
- 完成: 2026-03-28 21:37:58
- 生成任务数: 2

## 生成任务
- trace-auto-004: share ask/trace answer-source readability helper
- contract-auto-010: align web ask answering metadata to shared trace types

## 规划结果
[
  {
    "title": "share ask/trace answer-source readability helper",
    "family": "trace",
    "prompt": "Inspect the current answer-source readability code path first in `apps/api/src/modules/assistants/ask-assistant.service.ts` and `apps/api/src/modules/traces/traces.service.ts`. Then make the smallest backend-first, behavior-preserving change to remove remaining wording drift risk by extracting one narrow shared helper for the existing `answerTextSource*` / `answerStatusSource*` readability label + sentence/provenance wording, reusing it from both ask final payload shaping and trace-summary projection. Keep scope tight: no retrieval semantics changes, no schema/persistence changes, no unrelated refactor. If a new helper file is needed, keep it under the existing answering/readability area and only touch the focused API tests needed to guard the shared path. Run exactly one validation command: `pnpm test:api:file -- test/traces.service.test.js test/ask-success.test.js test/ask-stream-service.test.js`. Report exact changed files and the exact command result.",
    "agent": "rag-build"
  },
  {
    "title": "align web ask answering metadata to shared trace types",
    "family": "contract",
    "prompt": "Inspect the current web ask contract path first in `apps/web/src/types/api.ts` and `apps/web/test/ask-answering-metadata-contract.test.js`. Then make the smallest contract-only change to replace duplicated ask answering metadata literal unions with the already-imported shared trace types where they match current backend semantics, and tighten the existing contract guard so this shared-type linkage stays explicit. Keep scope to web typing/contract only: no backend edits, no UI changes, no bundled cleanup. Run exactly one validation command: `node --test apps/web/test/ask-answering-metadata-contract.test.js`. Report exact changed files and the exact command result.",
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
  "total": 67,
  "pending": 0,
  "completed": 65,
  "inProgress": 0,
  "cursor": 67
}

Recent completed queue items:

- docs-auto-002: sync ask contract docs
  result: Done — I inspected the current ask contract guard first, made a minimal docs-only sync, ran the single required validation command, and committed on the current `dev` branch. ### Inspected code path first - `apps/web/test/ask-answering-metadata-contract.test.js` ### Changed files 1. `docs/current-dev-setup.md` - Updated **current ask response metadata semantics** list to include already-shipped to
- contract-auto-009: tighten ask web contract guard
  result: Implemented the increment directly with the smallest scoped change in the existing test family. ### Inspected code path - `apps/web/src/types/api.ts` - `apps/web/test/ask-answering-metadata-contract.test.js` ### Change made Updated **only** the existing contract guard test to explicitly assert newly surfaced `AskResponse` fields while keeping existing metadata coverage intact. #### Changed files -
- contract-auto-008: surface ask provenance readability fields
  result: Implemented on `dev` with a minimal additive ask-contract increment and committed. ### ✅ What changed 1. **Backend ask payload surfacing** - **File:** `apps/api/src/modules/assistants/ask-assistant.service.ts` - Added top-level fields to both one-shot `askAssistant` result and `askAssistantStream` final payload: - `answerTextSource` - `answerTextSourceReadabilityLabel` - `answerTextSourceReadabili
```

