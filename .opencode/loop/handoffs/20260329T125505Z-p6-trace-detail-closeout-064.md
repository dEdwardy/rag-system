# p6-trace-detail-closeout-064

- 标题: trace detail closeout
- 状态: completed
- 代理: rag-build
- 会话: ses_2c65891f9ffe28RYkePp4VoMBL
- 消息: msg_d39a9404b001S2YqoF52BzqbOC
- 开始: 2026-03-29 20:52:47
- 恢复: 2026-03-29 20:52:47
- 收到: 2026-03-29 20:55:05
- 完成: 2026-03-29 20:55:05

## 结果
已按你的要求执行：先检查了 `Trace Detail` 代码路径、`traceSummary` contract/readability 面，以及最新 focused web tests，然后做了一个**单一窄增量**并完成提交。

### 本次最小改动（1 个增量）
目标：提升 trace-detail 现有 summary-slice 的可读性，不改 trace 语义/契约。

- 在 `Trace Detail` 的 `diagnostic summary slice` 中，把 `primaryIssue` 从原始枚举值展示改为可读文案映射（如 `no_retrieval_hits -> No retrieval hits / 检索未命中`）。
- 保持边界不变：未改 trace contract、未改 trace semantics、未改 quick-jump 结构、未耦合 usage/report payload。

### 变更文件（exact）
1. `apps/web/src/pages/traces/TraceDetailPage.tsx`
2. `apps/web/test/ui-review-regressions.test.js`
3. `docs/current-progress.md`

### 执行的验证命令（exact）
```bash
node --test --test-name-pattern "trace detail" apps/web/test/ui-review-regressions.test.js && node --test apps/web/test/trace-summary-contract.test.js
```

### 验证结果（exact output）
```text
✔ chat and trace detail surface higher-level workspace summaries before diagnostics (1.786258ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 39.133498
✔ web trace summary type guards current backend summary field set (3.729839ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 34.983869
```

### 提交信息
- Branch: `dev`
- Commit: `b02f6bf`
- Message: `web: make trace detail primary-issue wording scan-friendly`

未执行 push / PR（按你的 closeout 策略保留到稳定波次）。

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.
Commit each completed increment on the current branch, but keep push and PR decisions for a stable wave closeout point after validation is green.
Prefer `dev` for backend work unless the task explicitly requires a different branch transition.

Repository build policy:
基于已确认的最小计划执行实现。先检查相关代码路径和现有模式，再做最小具体改动。优先 backend-first、小步增量、快验证；运行一个最相关验证，并明确报告改动文件和验证命令；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。若需求不清晰或存在冲突，不要猜；直接 fail fast 并报告不确定点。

Task:
Inspect the current `Trace Detail` page, related `traceSummary` contract/readability surfaces, and the latest focused web tests first. Then make one narrow closeout increment that improves summary-slice, quick-jump, or wording readability within the existing trace-detail surface without changing trace semantics or expanding into a full observability platform. Keep scope narrow: current trace-detail UX/guard only; do not redesign the page, do not add dashboard architecture, and do not couple trace-detail to unrelated usage/report payloads. Run exactly one focused validation command: `node --test --test-name-pattern "trace detail" apps/web/test/ui-review-regressions.test.js && node --test apps/web/test/trace-summary-contract.test.js`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

