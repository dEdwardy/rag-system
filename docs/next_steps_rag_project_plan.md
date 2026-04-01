# RAG 项目下一步计划

> 文档角色：`current-primary`
> 当前使用方式：作为现阶段任务方向、优先级判断和阶段边界的主文档；`docs/current-progress.md` 负责记录近期完成情况和验证基线。
更新时间：2026-04-01

## 1. 当前判断

当前项目已经完成了以下主开发能力：

- 本地优先 RAG MVP 主链路
- ask / stream 渐进式聊天体验
- `PC Web` chat 的主要承载
- external knowledge source 第一轮能力：
  - web page
  - feed
  - sitemap
  - sitemap index
- `P0` read-model / metadata convergence
- `P1` auth/login 最小闭环
- `P2` owner-only ACL baseline
- `P3` external-source family + guardrails 主开发
- `P5` eval / regression baseline 工程能力主开发

当前阶段不应再把 `P3` 或 `P5` 当作默认下一条主开发波次。
更准确的状态是：

- `P3`：开发完成，进入维护态
- `P5`：工程完成，进入基线治理 / 使用态
- `P6`：已完成一轮 bounded closeout，后续只做小型可读性维护

因此，接下来应保持：

**单线推进 + 小步增量 + 每轮收口**

## 2. 当前优先级

### Priority A: 阶段判断与文档同步

目标：

- 先把代码现实、项目状态、计划文档保持一致
- 避免继续把已完成阶段描述成“当前主线”

边界：

- 只做状态判断、文档和最小 bookkeeping 对齐
- 不借机扩写新 roadmap，不引入新的大架构方案

### Priority B: P4 web capability carry-through

如果继续做产品增量，最合适的下一条主线是 `P4`，但要严格收窄为“承接已有 backend 能力”，不是新的 backend 扩展。

推荐切入：

1. 补齐 `DocumentsPage` 对现有 source family 的自然承载
   - `web page` URL 入口
   - `feed` URL 入口
   - `sitemap` URL 入口
2. 保持现有 API contract，不重做 source 管理后台
3. 保持 `PC Web` 优先，不展开移动端适配

不做：

- 不新增 source family
- 不做 source platform / plugin 化
- 不重写现有 backend ingestion contract

### Priority C: bounded maintenance only

以下方向仍允许继续做，但只作为维护位，不作为主开发波次：

- `P3` source-family 内稳定性修补
- `P5` baseline / replay / report 使用侧维护
- `P6` readability / docs sync

要求：

- 必须是窄范围、回归导向、可验证的小改
- 不得重新包装成新的 feature wave

## 3. 阶段状态

| Phase | Status | 说明 |
| --- | --- | --- |
| P0 | done | read-model / metadata convergence 已完成 |
| P1 | done | auth/login 最小闭环已完成 |
| P2 | done | owner-only ACL baseline 已完成 |
| P3 | done / maintenance only | source family 和 guardrails 已落地 |
| P4 | next likely wave | 更适合承接已有 backend 能力到 web |
| P5 | done / governance only | eval runner / baseline / replay / report / quality gate 已落地 |
| P6 | done / bounded follow-up only | observability readability 已完成，不扩成平台化改造 |

## 4. 不做什么

- 不把 `P3` / `P5` 重新当作默认下一条 feature wave
- 不做 broad refactor、架构重写、schema / persistence 大改
- 不做新的 source family 扩展，除非已有 family 内能力被证明无法满足明确需求
- 不把 observability 扩成新的平台方向
- 不把 docs / queue / backlog bookkeeping 扩成独立产品方向
- 不在没有明确收益时改 retrieval 语义、默认策略开关或模型分工

## 5. focused validation

默认继续使用最小相关验证：

- loop harness smoke test：
  - `node .opencode/loop/cli.mjs --self-test`
- docs / queue sync：
  - `git diff --check -- <files...>`
- API focused test：
  - `pnpm test:api:file -- test/<file>.test.js`
- web focused test：
  - `node --test --test-name-pattern "<name>" apps/web/test/<file>.test.js`

当前维护态复用基线：

- `P3` source-family maintenance：
  - `pnpm test:api:file -- test/external-source-sync.test.js`
  - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - `pnpm test:api:file -- test/parsing.test.js`
- `P6` observability maintenance：
  - `pnpm test:api:file -- test/traces.service.test.js`
  - `pnpm test:api:file -- test/ask-success.test.js`
  - `node --test apps/web/test/trace-summary-contract.test.js`
  - `node --test --test-name-pattern "document run" apps/web/test/document-run-observability.test.js`

## 6. 一句话结论

`P0`、`P1`、`P2` 已完成，`P3` 和 `P5` 的主开发也已完成；当前最合理的下一步不是继续把它们当成主线，而是先保持文档与阶段判断一致，再从 `P4 web capability carry-through` 或一个新批准的窄范围产品波次继续推进。
