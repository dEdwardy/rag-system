# p3-web-feed-partial-diagnostics-059

- 标题: web-feed partial diagnostics
- 状态: completed
- 代理: rag-build
- 会话: ses_2c66777ebffeFemYICbgmmOuB3
- 消息: msg_d399c2b09001aO4YbNaXgVTitK
- 开始: 2026-03-29 20:36:30
- 恢复: 2026-03-29 20:36:30
- 收到: 2026-03-29 20:40:49
- 完成: 2026-03-29 20:40:49

## 结果
Implemented as requested (backend-only, narrow scope, one consistency pass), then committed on current branch `dev`.

### What I inspected first (implementation + focused tests)

Implementation paths:
- `apps/api/src/infra/web-page/web-page.service.ts`
- `apps/api/src/infra/feed-source/feed-source.service.ts`
- `apps/api/src/modules/documents/documents.service.ts` (partial diagnostics shaping/messages)

Focused tests:
- `apps/api/test/parsing.test.js`
- `apps/api/test/fetch-with-retry.test.js`

### Narrow consistency change made

Goal: keep `web page` + `feed` partial diagnostics readable/aligned without changing the diagnostics contract shape.

#### Changed behavior (small and targeted)
For fallback-sniffed content-type diagnostics in both web and feed:
- Normalize `upstreamContentType` formatting to a consistent readable form:
  - from possible `text/plain;charset=utf-8`
  - to `text/plain; charset=utf-8`
- Preserve existing contract fields and semantics (`sourceKind`, `schemaVersion`, `partial`, etc.) unchanged.

#### Exact changed files
- `apps/api/src/infra/web-page/web-page.service.ts`
- `apps/api/src/infra/feed-source/feed-source.service.ts`
- `apps/api/test/parsing.test.js`

### Validation (exactly one focused command, exactly as requested)

Command run:
```bash
pnpm test:api:file -- test/parsing.test.js && pnpm test:api:file -- test/fetch-with-retry.test.js
```

Result:
- `test/parsing.test.js`: **33 passed**
- `test/fetch-with-retry.test.js`: **13 passed**
- Overall: command succeeded.

### Commit

Committed on current branch `dev`:

- **Commit**: `b8e4a27`
- **Message**: `api: align web/feed fallback content-type diagnostics`

No push / PR performed.

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
Inspect the current partial-diagnostics behavior for `web page` and `feed` sources in both implementation and focused tests first. Then make one narrow consistency pass so partial success / partial failure surfaces remain readable and aligned for those two source families without drifting away from the existing backend diagnostics contract. Keep scope narrow: web/feed partial-diagnostics closeout only; do not add source families, do not redesign UI, and do not rewrite retry semantics. Run exactly one focused validation command: `pnpm test:api:file -- test/parsing.test.js && pnpm test:api:file -- test/fetch-with-retry.test.js`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

