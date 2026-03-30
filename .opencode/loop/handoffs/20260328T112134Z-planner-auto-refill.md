# planner-auto-refill

- 会话: ses_2cbd39251ffe3Cs5s7z56enyVB
- 消息: msg_d342d3319001UQXWLySNJz6dTD
- 完成: 2026-03-28 19:21:34
- 生成任务数: 2

## 生成任务
- contract-auto-002: share answer-evidence label helper
- trace-auto-003: trace detail provenance summary rows

## 规划结果
[
  {
    "title": "share answer-evidence label helper",
    "family": "contract",
    "prompt": "Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, `docs/current-dev-setup.md`, and `README.md` first. Then inspect the current code path before changing anything: `apps/api/src/modules/assistants/ask-assistant.service.ts`, `apps/api/src/modules/traces/traces.service.ts`, and the existing shared readability helpers under `apps/api/src/modules/retrieval/` / `apps/api/src/modules/answering/`. Make the smallest behavior-preserving backend-first change to remove drift risk between ask final payload and trace summary for `answerEvidenceSourceReadabilityLabel` by reusing one shared helper instead of separate local implementations. Keep wording identical to current behavior; do not change retrieval semantics, payload shape, or persistence. Update `docs/current-progress.md` only if the completed increment changes implementation/workflow notes enough to warrant it. Run exactly one focused validation command: `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js test/ask-stream-service.test.js`. Report the exact changed files and the exact command result.",
    "agent": "rag-build"
  },
  {
    "title": "trace detail provenance summary rows",
    "family": "trace",
    "prompt": "Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, `docs/current-dev-setup.md`, and `README.md` first. Then inspect the relevant code path before changing anything: `apps/web/src/pages/traces/TraceDetailPage.tsx`, `apps/web/src/types/api.ts`, `apps/web/test/ui-review-regressions.test.js`, and `packages/shared/src/trace-contracts.ts`. Make the smallest additive UI/read-model closeout change to surface already-existing trace-summary provenance readability fields in the trace detail execution-summary area (prefer `answerProvenanceSentence` and `missingInformationProvenanceSentence`, and only add the minimal rows needed). Do not change backend contracts or redesign the page. Add or adjust one focused web regression guard in `apps/web/test/ui-review-regressions.test.js`, and update `docs/current-progress.md` only if this user-visible trace-summary surfacing needs a status note. Run exactly one focused validation command: `node --test apps/web/test/ui-review-regressions.test.js`. Report the exact changed files and the exact command result.",
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
  "total": 46,
  "pending": 0,
  "completed": 44,
  "inProgress": 0,
  "cursor": 46
}

Recent completed queue items:

- trace-summary-doc-sync-005: trace-summary doc sync
  result: Implemented as requested (smallest scoped increment, docs-only), after reading required docs and inspecting the live contract path. ### What I inspected first - `AGENTS.md` - `docs/current-dev-setup.md` - `packages/shared/src/trace-contracts.ts` (source of `TraceSummary` contract) - `apps/api/src/modules/traces/traces.service.ts` (actual trace-summary shaping + readability sentence formats) - `app
- metadata-unknown-labels-004: unknown/fallback wording unify
  result: 已完成这个最小增量并已提交（当前分支，未 push）。 ### 本次实现（单一增量） 目标：为 ask 一次性响应和 stream final 响应新增顶层 `strategyReadabilityLabel`，并与 trace summary 的生成语义保持一致（加法改动，不改检索行为）。 #### 变更文件 1. `apps/api/src/modules/retrieval/strategy-readability.ts` - 新增共享 helper：`buildStrategyReadabilityLabel(...)` - 复用 trace 现有文案语义： `"<mode> retrieval via <querySource>; fallback: <reason|none|unspecified>; fallback used: <yes|no|unknown>."` 2. 
- metadata-fallback-regressions-003: legacy fallback regressions
  result: Implemented one **minimal fallback-clarity increment** on `dev` (backend-first, additive, behavior-preserving). ### What I changed 1. **Improved resolved strategy summary wording for legacy fallback traces** - File: `apps/api/src/modules/traces/traces.service.ts` - Change: in `buildStrategyReadabilityLabel(...)`, when: - `strategyUsedFallback === true` - and `fallbackReason === null` - it now rend
```

