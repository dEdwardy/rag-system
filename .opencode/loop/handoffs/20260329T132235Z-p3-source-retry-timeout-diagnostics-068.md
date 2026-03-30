# p3-source-retry-timeout-diagnostics-068

- 标题: source retry/timeout diagnostics
- 状态: completed
- 代理: rag-build
- 会话: ses_2c640e595ffeYmxU1Xhair6hmL
- 消息: msg_d39c27084001vfXOe0tkm11MVP
- 开始: 2026-03-29 21:18:38
- 恢复: 2026-03-29 21:18:38
- 收到: 2026-03-29 21:22:35
- 完成: 2026-03-29 21:22:35

## 结果
Implemented the requested **backend-only diagnostics consistency pass** after inspecting the current code path first.

### Inspected first (as requested)
- `apps/api/src/infra/http/fetch-with-retry.ts`
- `apps/api/src/infra/web-page/web-page.service.ts`
- `apps/api/src/infra/feed-source/feed-source.service.ts`
- `apps/api/src/infra/sitemap-source/sitemap-source.service.ts`
- `apps/api/test/fetch-with-retry.test.js`

### Smallest concrete change made
Goal: keep retry policy unchanged, but align retryable/non-retryable classification and timeout/abort wording presentation consistency across web/feed/sitemap wrappers.

#### Changed files
1. `apps/api/src/infra/http/fetch-with-retry.ts`
   - Exported retryability helper:
     - `isRetryableFetchException(error: unknown)`
   - Added exported message normalizer:
     - `normalizeSourceFetchFailureMessage(message: string)`
   - Internal retry check now reuses the exported helper (no policy change).

2. `apps/api/src/infra/web-page/web-page.service.ts`
   - Fetch catch now uses a unified helper to:
     - strip duplicated `Failed to fetch <url>:` prefix from lower-level message
     - map exception type by retryability:
       - retryable -> `BadGatewayException`
       - non-retryable -> `BadRequestException`

3. `apps/api/src/infra/feed-source/feed-source.service.ts`
   - Same consistency update as web-page service.

4. `apps/api/src/infra/sitemap-source/sitemap-source.service.ts`
   - Same consistency update in both sitemap fetch paths (`fetchSitemap` and `fetchSitemapXml`).

### Focused validation run (exactly one command)
Command:
```bash
pnpm test:api:file -- test/fetch-with-retry.test.js
```

Exact result:
- `✓ test/fetch-with-retry.test.js (13 tests) 64ms`
- `Test Files  1 passed (1)`
- `Tests  13 passed (13)`

### Commit
Committed on current branch `dev`:

- **Commit:** `37c3b7f`
- **Message:** `api: align external source fetch failure diagnostics`

No push/PR done.

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
Inspect the current external-source fetch/retry/timeout/abort diagnostics across web page, feed, and sitemap handling, plus `test/fetch-with-retry.test.js`, first. Then make the smallest backend consistency pass so retryable vs non-retryable failures and timeout/abort wording stay aligned without changing the retry policy or expanding source scope. Keep scope narrow: diagnostics consistency only; do not add new source families, do not rewrite fetch semantics, and do not alter unrelated ingestion flows. Run exactly one focused validation command: `pnpm test:api:file -- test/fetch-with-retry.test.js`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

