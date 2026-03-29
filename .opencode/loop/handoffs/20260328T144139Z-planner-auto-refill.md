# planner-auto-refill

- 会话: ses_2cb1d7ff2ffeLC0W5aeh3upPWg
- 消息: msg_d34e441eb001VFcnHWtMKC36VO
- 完成: 2026-03-28 22:41:39
- 生成任务数: 2

## 生成任务
- embedding-auto-004: guard embedding base-url envs with explicit http/https errors
- source-auto-007: preserve raw redirect target in source-fetch diagnostics

## 规划结果
[
  {
    "title": "guard embedding base-url envs with explicit http/https errors",
    "family": "embedding",
    "prompt": "Inspect the current embedding runtime config path first: `apps/api/src/infra/embedding/embedding-runtime-config.ts`, `apps/api/test/embedding-runtime-config.test.js`, `docs/current-dev-setup.md`, and `docs/current-progress.md`. Then make the smallest concrete backend-first change for one narrow gap only: if `OPENAI_BASE_URL` or `OLLAMA_BASE_URL` is configured with a malformed or non-http(s) URL, fail fast with an explicit embedding config error instead of letting the bad base URL drift into later request failures. If there is no corresponding embedding superpowers spec/plan yet, add the smallest matching spec/plan note first and keep it scoped to this one guardrail. Add or adjust the smallest focused regression coverage in `apps/api/test/embedding-runtime-config.test.js`, and update `docs/current-progress.md` only if the shipped behavior/diagnostic note changes. Run exactly one focused validation command: `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/embedding-runtime-config.test.js`. Report exact changed files and the exact command result. No bundled refactors, no provider-order changes, no broader embedding redesign.",
    "agent": "rag-build"
  },
  {
    "title": "preserve raw redirect target in source-fetch diagnostics",
    "family": "source",
    "prompt": "Inspect the current source fetch redirect path first: `apps/api/src/infra/http/fetch-with-retry.ts`, `apps/api/test/fetch-with-retry.test.js`, and `docs/current-progress.md`. Then make the smallest concrete diagnostics-only change for one gap only: when redirect follow fails because the `Location` value is invalid or non-http(s), keep the raw redirect target visible in the error message in a bounded readable way so run diagnostics are easier to interpret. If there is no corresponding source-fetch superpowers spec/plan yet, add the smallest matching spec/plan note first and keep it scoped to this one diagnostics increment. Add one focused regression in `apps/api/test/fetch-with-retry.test.js`, and update `docs/current-progress.md` only if the shipped diagnostic wording needs recording. Run exactly one focused validation command: `pnpm test:api:file -- test/fetch-with-retry.test.js`. Report exact changed files and the exact command result. No retry-policy rewrite, no source-family expansion, no unrelated cleanup.",
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
  "total": 76,
  "pending": 0,
  "completed": 74,
  "inProgress": 0,
  "cursor": 76
}

Recent completed queue items:

- contract-auto-015: align ask quality/status web enums to shared trace contract
  result: Done — I followed your requested path inspection first, then verified the increment state and ran the single focused validation. ### Inspected code path - `apps/web/src/types/api.ts` - `apps/web/test/ask-quality-evaluation-contract.test.js` - `packages/shared/src/trace-contracts.ts` ### Result of inspection This contract-alignment increment is **already implemented** on current branch: - `AskQuali
- contract-auto-014: surface ask rewrite readability label
  result: []
- docs-auto-003: sync ask contract notes
  result: Implemented as requested (docs-only, minimal diff), then ran exactly one focused validation and committed on the current `dev` branch. ### Inspected code/docs path - `docs/current-progress.md` - `docs/current-dev-setup.md` - `apps/web/test/ask-answering-metadata-contract.test.js` - `apps/web/src/types/api.ts` (to verify shipped ask contract surface) ### Changed files 1. `docs/current-dev-setup.md`
```

