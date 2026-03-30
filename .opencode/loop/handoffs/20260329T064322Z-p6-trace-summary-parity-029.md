# p6-trace-summary-parity-029

- 标题: trace summary web contract parity guard
- 状态: completed
- 代理: rag-build
- 会话: ses_2c7acffa0ffewtJIC2maBr1ywP
- 消息: msg_d385505940014iea26J884r7l5
- 开始: 2026-03-29 14:40:56
- 恢复: 2026-03-29 14:40:56
- 收到: 2026-03-29 14:43:22
- 完成: 2026-03-29 14:43:22

## 结果
Implemented the requested minimal increment after inspecting the three target files first.

### What I changed

I only extended the existing web contract test to tighten scan-first trace-summary guarding:

- **Changed file**
  - `apps/web/test/trace-summary-contract.test.js`

### Why this is the smallest parity increment

- `apps/web/src/types/api.ts` already binds `traceSummary` to shared `TraceSummary`, so no concrete mismatch was exposed there.
- I added focused assertions that the **scan-first diagnostic slice input fields** are present inside the `TraceSummary` type block (not just anywhere in the file), which is tighter against backend drift.

Added guards for:
- `primaryIssue`
- `retrievalModeProvenanceSentence`
- `failureReadabilitySentence`
- `answerStatusSourceReadabilitySentence`
- `missingInformationProvenanceSentence`

### Focused validation (exact command)

```bash
node --test apps/web/test/trace-summary-contract.test.js
```

### Exact command result

```text
✔ web trace summary type guards current backend summary field set (3.969806ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 34.426484
```

### Commit

Committed on current branch (`dev`):

- **Commit**: `1d704f0`
- **Message**: `test(web): guard scan-first trace-summary contract slice`

(Left unrelated pre-existing workspace change `docs/next_steps_rag_project_plan.md` untouched.)

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
Inspect `packages/shared/src/trace-contracts.ts`, `apps/web/src/types/api.ts`, and `apps/web/test/trace-summary-contract.test.js` first. Then make the smallest web-side contract parity increment to tighten trace-summary coverage around the current scan-first field set so recent additive trace summary fields remain guarded from backend drift. Prefer extending the existing contract test and only touch web types if a real mismatch is exposed; do not change backend trace semantics or redesign the summary surface. Run exactly one focused validation command: `node --test apps/web/test/trace-summary-contract.test.js`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

