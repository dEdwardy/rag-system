# trace-fallback-regressions-003

- 标题: Backfill legacy fallback regression coverage
- 状态: completed
- 代理: rag-build
- 会话: ses_2cc8caa30ffep28Zu79S3Mbhl2
- 消息: msg_d3374b5390010rpmFGmkZ2hmQx
- 开始: 2026-03-28 15:58:09
- 收到: 2026-03-28 15:59:50
- 完成: 2026-03-28 15:59:50

## 结果
Implemented with a minimal additive change after reading the required docs/tests/code path.

### Files inspected before editing
- `AGENTS.md`
- `apps/api/AGENTS.md`
- `docs/next_steps_rag_project_plan.md`
- `docs/current-progress.md`
- `apps/api/test/traces.service.test.js`
- `apps/api/src/modules/traces/traces.service.ts` (fallback/read-model path)

### Files changed
- `apps/api/test/traces.service.test.js`

### What I added (regression coverage)
I added **2 focused tests** for legacy fallback backfill/readability behavior:

1. **Legacy payload with only top-level fallback clues**
   - `retrievalMetadataJson` contains only:
     - `fallbackReason: "vector_error"`
     - `usedFallback: true`
   - Asserts backfill to:
     - `traceSummary.fallbackReason`
     - `traceSummary.strategySummary.fallbackReason`
     - `traceSummary.strategySummary.usedFallback`
     - `traceSummary.strategyReadabilityLabel` (`... fallback: vector_error; fallback used: yes.`)

2. **Legacy payload missing optional fields but still readable**
   - `retrievalMetadataJson` only has `fallbackReason: "vector_error"`
   - `answeringMetadataJson` only has `missingInformationCount: 1` (other provenance fields missing)
   - Asserts:
     - fallback-derived `strategySummary.usedFallback === true`
     - readable fallback sentences remain stable:
       - `answerProvenanceSentence`
       - `missingInformationProvenanceSentence`
     - missing source labels remain readable:
       - `answerTextSourceReadabilityLabel === "answer text source unavailable"`
       - `answerStatusSourceReadabilityLabel === "answer status source unavailable"`

### Focused validation run
Command:
```bash
pnpm --filter @rag-system/api test:file -- test/traces.service.test.js
```

Result:
- `1` test file passed
- `26/26` tests passed

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, and the trace service tests before editing.

Task: add regression coverage for legacy fallback read-model backfill paths.

Focus files:
- `apps/api/test/traces.service.test.js`
- any small helper used to shape trace summary fallback wording

Rules:
- keep the change additive and behavior-preserving
- cover at least one legacy payload that only has top-level fallback clues
- cover at least one payload that is missing fields but should remain readable

Deliverable:
- add focused tests that lock the backfill behavior
- report exact scenarios covered and the validation command used
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

