# p2-auth-surface-route-027

- 标题: auth surface route guard expansion
- 状态: completed
- 代理: rag-build
- 会话: ses_2c7b04736ffe0nkrUsjG70EnwU
- 消息: msg_d3850a8e4001x5qT5NBWRbXT53
- 开始: 2026-03-29 14:37:21
- 恢复: 2026-03-29 14:37:21
- 收到: 2026-03-29 14:38:33
- 完成: 2026-03-29 14:38:33

## 结果
Implemented directly on `dev` with the smallest regression-coverage change after inspecting the requested files.

### Inspected first (as requested)
- `apps/api/test/auth-surface-route-policy.test.js`
- `apps/api/test/auth-provider-boundary.test.js`
- `apps/api/src/modules/knowledge-bases/knowledge-bases.controller.ts`
- `apps/api/src/modules/documents/documents.controller.ts`

### Concrete change made
Expanded the lightweight auth-surface route-policy test to explicitly include:
- `KnowledgeBasesController`
- `DocumentsController`

alongside the existing business controllers.

### Changed files
- `apps/api/test/auth-surface-route-policy.test.js`

### Focused validation run (exactly one command)
```bash
pnpm test:api:file -- test/auth-surface-route-policy.test.js
```

### Exact command result
- Result: **pass**
- Key output:
  - `✔ business controllers require authenticated routes`
  - `ℹ tests 1`
  - `ℹ pass 1`
  - `ℹ fail 0`

### Commit
Committed on current branch `dev`:
- **Commit:** `718bbdb`
- **Message:** `test(api): include kb/document controllers in auth surface policy`

Note: there is one unrelated pre-existing working tree change still unstaged/uncommitted:
- `docs/next_steps_rag_project_plan.md`

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
Inspect `apps/api/test/auth-surface-route-policy.test.js`, `apps/api/test/auth-provider-boundary.test.js`, `apps/api/src/modules/knowledge-bases/knowledge-bases.controller.ts`, and `apps/api/src/modules/documents/documents.controller.ts` first. Then make the smallest guard expansion so the lightweight auth-surface route-policy test explicitly locks `KnowledgeBasesController` and `DocumentsController` into the current authenticated-route baseline alongside the already-covered business controllers. Keep scope to route-policy regression coverage only; do not redesign auth decorators, controller behavior, or ACL semantics. Run exactly one focused validation command: `pnpm test:api:file -- test/auth-surface-route-policy.test.js`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

