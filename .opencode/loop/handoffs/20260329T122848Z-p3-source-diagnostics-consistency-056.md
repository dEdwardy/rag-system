# p3-source-diagnostics-consistency-056

- 标题: source diagnostics consistency
- 状态: completed
- 代理: rag-build
- 会话: ses_2c67998e5ffeKkzCSu5PXNHWvn
- 消息: msg_d39908a30001wJHjf6b9uznXIv
- 开始: 2026-03-29 20:16:42
- 恢复: 2026-03-29 20:27:47
- 收到: 2026-03-29 20:28:48
- 完成: 2026-03-29 20:28:48

## 结果
已按你给的范围完成这次最小后端一致性增量（基于当前 `dev` 分支，且已提交）。

### 先检查的代码路径
- `apps/api/src/infra/web-page/web-page.service.ts`
- `apps/api/src/infra/feed-source/feed-source.service.ts`
- `apps/api/src/infra/sitemap-source/sitemap-source.service.ts`
- `apps/api/src/modules/documents/documents.service.ts`
- `apps/api/src/infra/http/fetch-with-retry.ts`
- `apps/api/test/parsing.test.js`
- `apps/api/test/fetch-with-retry.test.js`

### 最小改动（仅 consistency/guard/readability）
1. `apps/api/src/infra/sitemap-source/sitemap-source.service.ts`
   - 为 sitemap 路径补齐并对齐 content-type fallback 诊断信号（与 web/feed 保持一致语义）：
     - `contentTypeFallbackApplied`
     - `upstreamContentType`
   - 仅在 fallback 实际触发时写入上述字段（不改重试策略、不改抓取语义）。
   - 保持 retryable 判定边界不变。

2. `apps/api/src/modules/documents/documents.service.ts`
   - `buildSitemapPartialDiagnosticsMessage(...)` 增加 fallback 文案分支：
     - `"Sitemap source completed with content-type fallback sniffing."`
   - 用于与现有 web/feed 的 partial readability wording 对齐。

3. `apps/api/test/parsing.test.js`
   - 在 sitemap content-type fallback 用例里补充严格 diagnostics 断言，锁定上述一致性行为。

---

### 精确验证命令（按你要求只跑这一条）
```bash
pnpm test:api:file -- test/parsing.test.js && pnpm test:api:file -- test/fetch-with-retry.test.js
```

### 精确命令结果
- `test/parsing.test.js`: **32 passed**
- `test/fetch-with-retry.test.js`: **13 passed**
- 整条命令成功退出（green）

---

### 精确变更文件
- `apps/api/src/infra/sitemap-source/sitemap-source.service.ts`
- `apps/api/src/modules/documents/documents.service.ts`
- `apps/api/test/parsing.test.js`

### 提交信息
- Commit: `67043ab`
- Message: `api: align sitemap fallback diagnostics wording`

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
Inspect the current external-source parsing/fetch diagnostics paths across `web page`, `feed`, and `sitemap`, plus `test/parsing.test.js` and `test/fetch-with-retry.test.js`, first. Then make the smallest backend-first consistency pass so partial diagnostics, retryable markers, readability labels, and error wording stay aligned across the existing source families without rewriting retry policy. Keep scope narrow: consistency/guard/readability only; do not add a new source family, do not broaden fetch semantics, and do not change unrelated ingestion flows. Run exactly one focused validation command: `pnpm test:api:file -- test/parsing.test.js && pnpm test:api:file -- test/fetch-with-retry.test.js`. Report the exact changed files and the exact command result.
```

## 备注
- The loop resumed an existing OpenCode session after an interrupted run.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

