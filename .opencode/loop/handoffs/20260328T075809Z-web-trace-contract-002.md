# web-trace-contract-002

- 标题: Guard web trace-summary contract
- 状态: completed
- 代理: rag-build
- 会话: ses_2cc8f619fffeMnYmQPb7uq2fUF
- 消息: msg_d3372f427001sakGg3FAQpxm3l
- 开始: 2026-03-28 15:55:11
- 收到: 2026-03-28 15:58:09
- 完成: 2026-03-28 15:58:09

## 结果
Implemented the increment directly with minimal, additive web-only changes.

### What I inspected first (before editing)
Per your requirement, I read:

- `AGENTS.md`
- `docs/next_steps_rag_project_plan.md`
- `docs/current-progress.md`
- `docs/current-dev-setup.md`
- `README.md`
- `apps/web/AGENTS.md`
- `apps/web/test/trace-summary-contract.test.js`
- `apps/web/src/types/api.ts`
- `packages/shared/src/trace-contracts.ts`
- trace display path: `apps/web/src/pages/traces/TraceDetailPage.tsx`

---

### Files changed

1) **`apps/web/test/trace-summary-contract.test.js`**
- Kept existing contract-guard approach.
- Expanded assertions so the web contract test now guards the **full current `TraceSummary` field set** (including newer readability/provenance fields and remaining summary fields).
- Test title updated to reflect “current backend summary field set” guarding.

2) **`apps/web/src/pages/traces/TraceDetailPage.tsx`**
- Additive display-only change (no redesign):
  - Read `trace.traceSummary` into `traceSummary`.
  - Added a small metadata section in the existing “Execution summary” panel to show readable fields:
    - `strategyReadabilityLabel`
    - `rewriteReadabilityLabel`
    - `candidateCountReadabilityLabel`
    - `citationCountReadabilityLabel`
- This is behavior-preserving and uses existing layout classes/components.

---

### Notes on `apps/web/src/types/api.ts`
- **No edit needed**: it already imports and uses `TraceSummary` from `@rag-system/shared` (`traceSummary: TraceSummary;`), which is the correct contract-aligned path.

---

### Focused validation run

Command:
```bash
node --test apps/web/test/trace-summary-contract.test.js
```

Result:
- `1 passed, 0 failed`  
- Test: `web trace summary type guards current backend summary field set` passed successfully.

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, and the web trace contract tests before editing.

Task: keep the web contract aligned with the latest readable `TraceSummary` fields.

Focus files:
- `apps/web/test/trace-summary-contract.test.js`
- `apps/web/src/types/api.ts`
- any trace display component that consumes the readable fields

Rules:
- keep the change additive and behavior-preserving
- do not introduce a UI redesign
- only touch the current contract surface and the smallest related display path

Deliverable:
- web types and tests should guard the current trace summary field set
- run one small web-focused validation command and report the result
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

