# planner-auto-refill

- 会话: ses_2cc32cd41ffeAuyump6ROCIZI2
- 消息: msg_d33cdb9a8001Yl0F5ARP03jnaI
- 完成: 2026-03-28 17:37:28
- 生成任务数: 2

## 生成任务
- source-auto-003: source fetch timeout wording
- embedding-auto-003: embedding unusable-model hint

## 规划结果
[
  {
    "title": "source fetch timeout wording",
    "family": "source",
    "agent": "rag-build",
    "prompt": "Inspect the existing source-fetch retry path first in `apps/api/src/infra/http/fetch-with-retry.ts` and its focused coverage in `apps/api/test/fetch-with-retry.test.js`, then make the smallest concrete diagnostics-only change. Target the current timeout/abort failure path so source fetch timeouts produce a clearer normalized error that includes the source URL and timeout boundary, without changing retry policy, redirect handling, source-family scope, or persistence behavior. Add or update only the narrowest focused test coverage in `apps/api/test/fetch-with-retry.test.js`. Update `docs/current-progress.md` only if the wording change needs a short progress note. Run exactly one validation command: `pnpm test:api:file -- test/fetch-with-retry.test.js`. Report the exact changed files and the exact command result."
  },
  {
    "title": "embedding unusable-model hint",
    "family": "embedding",
    "agent": "rag-build",
    "prompt": "Inspect the current OpenAI embedding config path first in `apps/api/src/infra/embedding/embedding-runtime-config.ts` and the focused tests in `apps/api/test/embedding-runtime-config.test.js`, then make the smallest concrete diagnostics-only change. Target the existing error path where `OPENAI_EMBEDDING_MODEL` is configured but `OPENAI_API_KEY` is missing, and extend it so the message also echoes the configured embedding model value while preserving current provider order, selection behavior, and existing `OPENAI_BASE_URL` hinting. Keep scope strictly additive; no retrieval/runtime behavior changes. Update `docs/current-progress.md` only if the behavior wording change needs a short note. Run exactly one validation command: `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/embedding-runtime-config.test.js`. Report the exact changed files and the exact command result."
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
  "total": 26,
  "pending": 0,
  "completed": 24,
  "inProgress": 0,
  "cursor": 26
}

Recent completed queue items:

- source-auto-001: source fetch transient-error retry guard
  result: Implemented end-to-end with a minimal backend diff. ### 1) Current retry boundary (confirmed from inspected code/tests) From `apps/api/src/infra/http/fetch-with-retry.ts` before change: - **HTTP response retry boundary**: `status === 408 || status === 429 || status >= 500` - **Thrown fetch exceptions**: previously all exceptions in `catch` would continue retry loop until attempts exhausted (then t
- embedding-auto-001: embedding partial-config diagnostics
  result: 已按你的要求执行：先检查代码路径，再做最小增量改动，并只跑了你指定的一条 focused 验证命令。 ### 先检查确认（现状） 我先检查了这两个文件： - `apps/api/src/infra/embedding/embedding-runtime-config.ts` - `apps/api/test/embedding-runtime-config.test.js` 确认到当前行为（改动前）是： 1. **provider 选择顺序固定**：`ollama -> openai -> fallback` 2. **OpenAI embedding 启用条件**： - 有 `OPENAI_API_KEY`（即使没显式模型，也会走默认模型）或 - 显式设置了 `OPENAI_EMBEDDING_MODEL`（但若没 key 会报错） 3. **默认模型路径**：`OPENAI_EMBED
- p0-complete-010: Mark P0 complete
  result: Implemented as requested (doc-only, minimal scope) after reading the required files. ### Updated files 1. `docs/next_steps_rag_project_plan.md` - Updated timestamp: `更新时间：2026-03-28` - Under `### P0：read-model / metadata convergence`, added explicit status: - `状态：✅ 已完成（2026-03-28，P0 closeout queue 已按既定顺序收口）` - Under `### Queue-ready tasks`, added short closeout note: - `> 完成说明：本批 closeout queue 已完
```

