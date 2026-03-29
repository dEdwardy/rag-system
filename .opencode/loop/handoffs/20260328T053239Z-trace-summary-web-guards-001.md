# trace-summary-web-guards-001

- 标题: Tighten web trace-summary contract guards
- 状态: completed
- 代理: rag-build
- 会话: ses_2cd12e7caffeqOWRR7Tj7IXUzr
- 消息: msg_d32edd8d70016C79002Kq2rLX2
- 开始: 2026-03-28 13:31:32
- 收到: 2026-03-28 13:32:39
- 完成: 2026-03-28 13:32:39

## 结果
已按你的要求执行（先读文档→检查代码路径→做最小改动→跑一次聚焦验证）。

### 已检查的代码路径
- `apps/web/test/trace-summary-contract.test.js`
- `apps/web/src/types/api.ts`
- `packages/shared/src/trace-contracts.ts`（用于对照最新共享契约）

### 实施结果（最小改动）
仅修改了 1 个文件：

1. **`apps/web/test/trace-summary-contract.test.js`**
   - 补充了对最新 additive 可读性字段的契约守卫断言，防止 web 侧 contract drift：
     - `TraceAnswerAttributionSummary.readabilityLabel`
     - `TraceAnswerAttributionSummary.readabilityResolvedLabel`
     - `TraceSummary.strategyReadabilityLabel`
     - `TraceSummary.answerTextSourceReadabilityLabel`
     - `TraceSummary.answerStatusSourceReadabilityLabel`
     - `TraceSummary.failedStageReadabilityLabel`
     - `TraceSummary.candidateCountReadabilityLabel`

### `apps/web/src/types/api.ts` 是否需要改
- **未改动**。  
- 原因：`TraceRecord.traceSummary` 已直接使用共享 `TraceSummary` 类型（`from "@rag-system/shared"`），当前没有类型落后问题。

### 聚焦验证（1条）
执行命令：
```bash
node --test apps/web/test/trace-summary-contract.test.js
```

结果：**通过（1/1）**。

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md, docs/next_steps_rag_project_plan.md, and docs/current-progress.md first.

Target:
- apps/web/test/trace-summary-contract.test.js
- apps/web/src/types/api.ts if the contract still lags

Goal:
Add the narrowest regression or type guard needed so the web contract stays aligned with the latest additive TraceSummary readability fields. Keep the change additive, behavior-preserving, and focused on contract drift only.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

