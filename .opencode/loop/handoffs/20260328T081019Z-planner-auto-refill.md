# planner-auto-refill

- 会话: ses_2cc8302daffeKXh4WsHLfXzjvH
- 消息: msg_d337de979001fh5zhGMbFOZb5x
- 完成: 2026-03-28 16:10:19
- 生成任务数: 2

## 生成任务
- embedding-auto-001: embedding partial-config diagnostics
- source-auto-001: source fetch transient-error retry guard

## 规划结果
[
  {
    "title": "embedding partial-config diagnostics",
    "family": "embedding",
    "prompt": "First inspect `apps/api/src/infra/embedding/embedding-runtime-config.ts` and `apps/api/test/embedding-runtime-config.test.js` to confirm the current OpenAI/Ollama embedding selection and error wording. Then make the smallest additive diagnostics change so partially configured embedding envs are easier to identify at runtime (especially when OpenAI embedding env values are present but the provider is not actually usable, or when the default embedding-model path is what really won). Keep this behavior-preserving: do not change provider order, retrieval behavior, schema, or persistence. If the resulting runtime wording or workflow expectations change, append one short aligned note to `docs/current-progress.md`. Run exactly one focused validation command: `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/embedding-runtime-config.test.js`. Report exact changed files and the command result; no bundled refactors.",
    "agent": "rag-build"
  },
  {
    "title": "source fetch transient-error retry guard",
    "family": "source",
    "prompt": "First inspect `apps/api/src/infra/http/fetch-with-retry.ts` and `apps/api/test/fetch-with-retry.test.js` to confirm the current retry boundary for HTTP `408` / `429` / `5xx` versus thrown fetch exceptions. Then make the smallest concrete backend change so clearly transient network exceptions continue through the existing retry path while preserving the current URL-attributed diagnostics wording. Keep scope tight: no source-family expansion, no retry-budget config redesign, no persistence changes, and no broad retry-policy rewrite. If behavior wording changes, append one short aligned note to `docs/current-progress.md`. Run exactly one focused validation command: `pnpm test:api:file -- test/fetch-with-retry.test.js`. Report exact changed files and the command result; no bundled refactors.",
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
  "total": 22,
  "pending": 0,
  "completed": 20,
  "inProgress": 0,
  "cursor": 22
}

Recent completed queue items:

- p0-complete-010: Mark P0 complete
  result: Implemented as requested (doc-only, minimal scope) after reading the required files. ### Updated files 1. `docs/next_steps_rag_project_plan.md` - Updated timestamp: `更新时间：2026-03-28` - Under `### P0：read-model / metadata convergence`, added explicit status: - `状态：✅ 已完成（2026-03-28，P0 closeout queue 已按既定顺序收口）` - Under `### Queue-ready tasks`, added short closeout note: - `> 完成说明：本批 closeout queue 已完
- eval-regression-baseline-008: Write eval regression baseline
  result: 已按你的执行模式直接落地，先读了指定路径再做最小改动。 ### 已先检查的文件（编辑前） - `AGENTS.md` - `docs/next_steps_rag_project_plan.md` - `docs/current-progress.md` - `docs/current-dev-setup.md`（用于确认现有 focused test 命令入口） ### 最小改动 1. **`docs/next_steps_rag_project_plan.md`** - 在 P0 closeout queue 的 **item 8（eval/regression baseline）** 下新增了可复用最小基线： - `pnpm test:api:file -- test/traces.service.test.js` - `pnpm test:api:file -- test/ask-
- progress-closeout-006: Add progress closeout note
  result: 已按你的要求直接实施，先阅读再最小改动并完成快验证。 ### 读取的相关路径（先检查） - `AGENTS.md` - `docs/next_steps_rag_project_plan.md` - `docs/current-progress.md` ### 已做的最小改动 - **仅修改**：`docs/current-progress.md` - 在 `补充进展（2026-03-28）` 下**追加 1 条简短 closeout 记录**，内容包含： - 本轮改了什么（只追加进展记录） - 本轮没改什么（未改 backend/web/shared 实现与语义） - 通过了什么验证（见下） ### 聚焦验证（已通过） - 命令：`git diff --check -- "docs/current-progress.md"` - 结果：通过（无 diff 格式/空白错误） ### 未改动
```

