# p3-external-resync-error-code-consistency-070

- 标题: external resync error-code consistency
- 状态: completed
- 代理: rag-build
- 会话: ses_2c6386e45ffeQEH79MtqlT2mpu
- 消息: msg_d39cb884b001Vkg2fvvWwi5eQq
- 开始: 2026-03-29 21:27:53
- 恢复: 2026-03-29 21:27:53
- 收到: 2026-03-29 21:32:25
- 完成: 2026-03-29 21:32:25

## 结果
Implemented as requested: inspected the existing external resync config-failure path and `test/external-source-sync.test.js`, then made a **small backend-only consistency pass** for config-failure code/readability without changing recovery semantics.

### What I changed

1. **Aligned unrecoverable config-failure readability by source family** while keeping code/semantics unchanged:
   - Still uses `code: "EXTERNAL_SOURCE_CONFIG_INVALID"`
   - Still `failedStage: "source_fetch"`, `retryable: false`
   - Only made failure messages more readable/consistent by family (`feed`, `sitemap`, `web page`) when available

2. **Extended focused regression coverage** to include the missing web-page unrecoverable legacy path:
   - Added one new test for unrecoverable `web_page` config-loss recovery failure
   - Updated existing feed/sitemap expectations to the new family-readable messages

### Exact changed files

- `apps/api/src/modules/documents/documents.service.ts`
- `apps/api/test/external-source-sync.test.js`

### Exact validation command run (single focused command)

- `pnpm test:api:file -- test/external-source-sync.test.js`

### Exact validation result

- `✓ test/external-source-sync.test.js (32 tests) 11ms`
- `Test Files  1 passed (1)`
- `Tests  32 passed (32)`

### Commit

Committed on current branch (`dev`) as requested:

- `a287ef4` — `api: align external resync config-failure readability`

No push/PR was performed.

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
Inspect the current external resync config-failure mapping and its readable diagnostics, especially the cross-family `EXTERNAL_SOURCE_CONFIG_INVALID` consistency noted in the planning docs, plus `test/external-source-sync.test.js`, first. Then make the smallest backend consistency pass that keeps unrecoverable config failures readable and aligned across existing source families without changing recovery semantics. Keep scope narrow: error-code/readability consistency only; do not add new source families, do not change sync architecture, and do not reopen expansion policy. Run exactly one focused validation command: `pnpm test:api:file -- test/external-source-sync.test.js`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

