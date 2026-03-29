# p3-source-diagnostics-consistency-003

- 标题: source diagnostics consistency
- 状态: completed
- 代理: rag-build
- 会话: ses_2c867761affeclNwg5g2zd7xgZ
- 消息: msg_d379b6b060018zG1o1sn8fb5KX
- 开始: 2026-03-29 11:17:16
- 恢复: 2026-03-29 11:17:16
- 收到: 2026-03-29 11:20:33
- 完成: 2026-03-29 11:20:33

## 结果
已按你要求完成一个**最小后端增量**并已提交到当前 `dev` 分支。

### 本次改动（最小范围）
1. `apps/api/src/infra/http/fetch-with-retry.ts`
   - 统一 fetch 失败/超时文案前缀为 `Failed to fetch ...`
   - 保持重试边界与语义不变（仅文案）
   - `withRetryAttemptContext` 的附加条件同步为匹配新前缀

2. `apps/api/test/fetch-with-retry.test.js`
   - 更新 3 处精确断言文案，与新统一 wording 对齐

### 执行的 focused validation
- 命令：
  - `pnpm --filter @rag-system/api test:file test/fetch-with-retry.test.js`
- 结果：
  - 1 file passed
  - 13 tests passed

### 提交信息
- Commit: `a508504`
- Message: `fix(api): align source-fetch retry and timeout diagnostics wording`

### 当前分支状态
- `dev...origin/dev [ahead 9]`
- 工作区干净（仅本次提交，无残留未提交改动）

如果你要，我可以继续下一增量（例如 connector 层 upstream/partial diagnostics wording 的小步对齐）并同样做单点验证后再单独提交。

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.
Commit each completed increment on the current branch, but keep push and PR decisions for a stable wave closeout point after validation is green.
Prefer `dev` for backend work unless the task explicitly requires a different branch transition.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Align retry, timeout, and source diagnostics wording across the existing connector paths. Keep execution-boundary semantics stable, improve error readability, and add focused backend consistency validation.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

