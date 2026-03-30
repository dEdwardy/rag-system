# planner-auto-refill

- 会话: ses_2ccc7b3abffeAyD3r96LYAf2WX
- 消息: msg_d3338619a001KSJKty0JSPRbiB
- 完成: 2026-03-28 14:54:07
- 生成任务数: 2

## 生成任务
- contract-auto-001: Guard latest trace summary readability fields in web contract
- trace-auto-001: Lock legacy trace fallback backfill with focused regression test

## 规划结果
[
  {
    "title": "Guard latest trace summary readability fields in web contract",
    "family": "contract",
    "prompt": "Inspect the current trace-summary contract path first by comparing `packages/shared/src/trace-contracts.ts`, `apps/web/src/types/api.ts`, and `apps/web/test/trace-summary-contract.test.js`. Then make the smallest additive contract-alignment change so the web-side type/test guard covers any already-existing `TraceSummary` readability fields that are still missing on the web side; do not introduce new backend fields or refactor unrelated API types. If the change affects the documented field list, update only the relevant line(s) in `docs/current-progress.md` as a closeout note. Run exactly one focused validation command: `node --experimental-strip-types --test apps/web/test/trace-summary-contract.test.js`. Report the exact changed files and the exact command result.",
    "agent": "rag-build"
  },
  {
    "title": "Lock legacy trace fallback backfill with focused regression test",
    "family": "trace",
    "prompt": "Inspect the legacy trace-summary backfill path first in `apps/api/src/modules/traces/traces.service.ts` and existing coverage in `apps/api/test/traces.service.test.js`. Then make the smallest concrete change to add or fix one focused regression around legacy fallback/backfill consistency for `strategySummary.usedFallback`, `answerProvenanceSentence`, or `missingInformationProvenanceSentence` when older trace metadata is incomplete; prefer a test-only change unless inspection shows a minimal code fix is required. Keep the scope behavior-preserving and do not touch retrieval semantics. If behavior or coverage meaningfully changes, append a concise closeout note to `docs/current-progress.md`. Run exactly one focused validation command: `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`. Report the exact changed files and the exact command result.",
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
  "total": 8,
  "pending": 0,
  "completed": 8,
  "inProgress": 0,
  "cursor": 8
}

Recent completed queue items:

- opencode-model-routing-008: Review OpenCode model split
  result: 已按你的要求执行：先读了 `AGENTS.md` 和三份 OpenCode 配置，再做最小落地改动与快验证。 ### 结论（model split 评估） 当前 `plan / build / explore / review-risk` 的模型分工**仍然合理**，没有出现明确的成本/质量反转信号，因此**保持现状**： - `plan` / `review-risk` → `openai/gpt-5.4`（更高质量的规划与高风险审查） - `build` → `openai/gpt-5.3-codex`（实现效率与代码执行适配） - `explore` → `openai/gpt-5.3-mini`（低成本窄检索） ### 实施的最小改动 我没有改动模型映射本身，只补充了“为何保持该分工”的就地注释（最小 diff）： 1. `opencode.jsonc` 2. `apps/api/
- opencode-loop-prompt-template-007: Add read-model loop prompt template
  result: Implemented — I inspected the loop prompt path first, then made the smallest scoped increment. ### Changed files 1. **`scripts/opencode-loop.md`** - Updated queue example to use a metadata-specific prompt: - `promptFile: "prompts/read-model-metadata.md"` - example title now matches metadata task intent. - Added a new **Prompt Family Guidance** section: - `prompts/build.md` for generic build increm
- current-progress-closeout-006: Add progress closeout notes
  result: Done — implemented the increment directly in `docs/current-progress.md` with a concise closeout note. ### Changed file - `docs/current-progress.md` ### What I added Under `补充进展（2026-03-28）`, appended a short closeout entry including: - changed files - focused validation command ### Focused validation run - Attempted (failed due missing tool): - `pnpm exec prettier --check "docs/current-progress.md
```

