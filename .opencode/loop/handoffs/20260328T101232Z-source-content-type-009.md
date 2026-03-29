# source-content-type-009

- 标题: Tune content-type handling
- 状态: completed
- 代理: rag-build
- 会话: ses_2cc14195bffe8bHATx3JUzbJ3X
- 消息: msg_d33ee34bc001T5aJu5aXj70Zz0
- 开始: 2026-03-28 18:09:51
- 收到: 2026-03-28 18:12:32
- 完成: 2026-03-28 18:12:32

## 结果
已完成 1 个最小 backend 增量，并已提交到当前分支 `dev`。

### 本次改动（单一增量）
**改进的 response edge case：**
- 目标：`feed` source
- 边界场景：上游返回的是有效 RSS/Atom XML，但 `Content-Type` 被错误标成 `text/plain`（或缺失）
- 之前行为：直接报错 `Unsupported feed content type`
- 现在行为：在该场景下做轻量 payload sniff（`<rss>` / `<feed>`），命中则继续按现有 feed parser 解析；非 feed payload 仍保持原有失败行为

### 修改文件
1. `apps/api/src/infra/feed-source/feed-source.service.ts`
   - 在 `fetchFeed(...)` 中先读取 payload，再进行：
     - 常规 content-type 校验
     - `text/plain`/unknown + feed XML 形态的 fallback 通过
   - 新增两个最小 helper：
     - `isFallbackSniffingContentType(...)`
     - `looksLikeFeedXmlPayload(...)`

2. `apps/api/test/parsing.test.js`
   - 新增 focused 测试：
     - `FeedSourceService accepts RSS payload when upstream content-type is text/plain`

3. `docs/current-progress.md`
   - 追加本次增量与验证记录

### 执行的验证命令（focused）
```bash
pnpm test:api:file -- test/parsing.test.js
```
结果：`24/24` 通过。

### 提交信息
- Commit: `ab40a98`
- Message: `fix: accept text/plain RSS/Atom payload fallback`

如需，我可以继续按同样粒度再做一个 `sitemap` 或 `web page` 的单点 content-type/diagnostics 小增量。

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
Read AGENTS.md and the primary docs.

Implement one minimal external source content-type handling improvement.

Priority guidance:
- focus on one `web page` / `feed` / `sitemap` HTTP response edge case
- prefer clearer content-type checks, fallback parsing, or error reporting
- do not add a new source family
- do not broaden into a connector platform rewrite

Choose one small focused increment, validate it minimally, and report the exact response-edge behavior it improves.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

