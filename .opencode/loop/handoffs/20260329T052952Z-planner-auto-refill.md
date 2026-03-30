# planner-auto-refill

- 会话: ses_2c7efbab7ffeZYe1FkEfvn7YWU
- 消息: msg_d38116e3d001MgKsX3ofBLKPB2
- 完成: 2026-03-29 13:29:52
- 生成任务数: 2

## 生成任务
- contract-auto-020: snapshot hotspot empty-case guard
- contract-auto-021: web snapshot comparison contract guard

## 规划结果
[
  {
    "title": "snapshot hotspot empty-case guard",
    "family": "contract",
    "prompt": "Inspect `apps/api/src/modules/document-runs/document-runs.service.ts` and `apps/api/test/document-runs-summary.test.js` first. Then make the smallest backend-first change to lock the snapshot-comparison empty/low-signal contract: when `GET /knowledge-bases/:id/document-runs/comparison` runs in `snapshot` mode with no issue hotspot candidates or no meaningful source-family shift, the response should still keep the additive `issueHotspotSlice` shape stable with `leftHotspot`, `rightHotspot`, and/or `dominantShift` explicitly `null` instead of drifting or disappearing. Prefer a focused regression test in `apps/api/test/document-runs-summary.test.js`; only touch service logic if the current behavior does not already satisfy that contract. Do not change comparison semantics, endpoint shape outside this narrow guard, or broaden observability scope. Run exactly one focused validation command: `pnpm test:api:file -- test/document-runs-summary.test.js`. Report the exact changed files and the exact command result.",
    "agent": "rag-build"
  },
  {
    "title": "web snapshot comparison contract guard",
    "family": "contract",
    "prompt": "Inspect `apps/web/src/types/api.ts`, `apps/web/test/document-run-contract.test.js`, and the current usage-page consumer in `apps/web/src/pages/usage/UsagePage.tsx` first. Then make the smallest web-side contract-alignment change so the web test suite explicitly guards the current snapshot comparison additive fields from backend drift: `sourceFamilyDeltas` and `issueHotspotSlice` on `KnowledgeBaseDocumentRunComparison` snapshot responses. Prefer extending `apps/web/test/document-run-contract.test.js`; only touch `apps/web/src/types/api.ts` if the guard exposes a real type mismatch. Do not change runtime UI behavior or add broader refactors. Run exactly one focused validation command: `node --test apps/web/test/document-run-contract.test.js`. Report the exact changed files and the exact command result.",
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
  "total": 179,
  "pending": 0,
  "completed": 179,
  "deferred": 0,
  "inProgress": 0,
  "cursor": 179
}

Recent completed queue items:

- loop-auto-002: usage snapshot hotspot slice
  result: Implemented on branch `dev` as requested, with a minimal additive web-side contract/UI alignment. ### What I inspected first I inspected the exact requested path: - `apps/api/src/modules/document-runs/document-runs.service.ts` - `apps/web/src/types/api.ts` - `apps/web/src/pages/usage/UsagePage.tsx` - `apps/web/test/ui-review-regressions.test.js` Confirmed: - Backend `snapshot` comparison already r
- p6-observability-docs-020: observability docs sync
  result: Implemented as a **docs-only** increment (no runtime contract changes), then ran the requested focused validation and committed on `dev`. ### Touched files - `docs/current-dev-setup.md` - `docs/current-progress.md` ### What I changed (minimal scope) - In `docs/current-dev-setup.md`, synced observability/usage docs to current scan-first reality: - explicitly documented `GET /knowledge-bases/:id/doc
- p6-document-hotspot-019: document-run hotspot slice
  result: Implemented ✅（backend-first、additive、最小增量），并已完成一次聚焦验证与提交。 ### What I changed Added one **document-run snapshot hotspot slice** to improve issue concentration scanning, reusing existing summary/comparison data only. #### 1) Backend service - **File:** `apps/api/src/modules/document-runs/document-runs.service.ts` - **Change:** - In snapshot mode of `getKnowledgeBaseRunComparison(...)`, added additiv
```

