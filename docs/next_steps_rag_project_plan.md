# RAG 项目下一步计划

> 文档角色：`current-primary`
> 当前使用方式：作为现阶段任务方向、优先级判断和阶段边界的主文档；`docs/current-progress.md` 负责记录近期完成情况和验证基线。
更新时间：2026-04-05

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
- `P4`：当前这一轮 web capability carry-through 收口已完成
- `P5`：工程完成，进入基线治理 / 使用态
- `P6`：已完成一轮 bounded closeout，后续只做小型可读性维护

因此，接下来应保持：

**单线推进 + 小步增量 + 每轮收口**

## 2. 当前优先级

### Priority A: bounded maintenance and docs freshness

目标：

- 保持代码现实、项目状态、计划文档持续一致
- 避免继续把已完成阶段描述成“当前主线”
- 对 `P3/P4/P5/P6` 已完成区域只做窄范围维护

边界：

- 只做状态判断、文档和最小 bookkeeping 对齐，或已完成区域内的小型回归修补
- 不借机扩写新 roadmap，不引入新的大架构方案

完成标准：

- `current-context` / `current-progress` / `project-status-overview` / 本文档口径一致
- 明确 `P3/P4/P5/P6` 的当前边界，避免把已完成收口重新写成待开发主线
- 明确后续若开启新产品波次，需要先完成主线选择，避免重新回到“多方向并行”的模糊状态

### Priority B: next product increment selection

当前这轮 `P4 web capability carry-through` 收口已经完成。如果继续做产品增量，下一步更适合先选择一个新的明确小波次，而不是继续把当前这轮 `P4` 收口写成待完成主线。

当前代码现实：

1. `DocumentsPage` 对现有 source family 的基础承载和第一轮收口已经落地
   - `web page` URL 入口
   - `feed` URL 入口
   - `sitemap` URL 入口
2. `Document Detail / Usage / Trace` 与 `Report center / eval` 的当前一轮阅读路径、参数 carry-through 和 focused regression 也已完成收口
   - 其中 `Document Detail` 已将 ingestion / run 状态与下一步动作收敛到单一主状态区域，保持 scan-first 阅读路径不变
   - `Documents` 工作台主状态 readout 已补齐失败 / 进行中 / 就绪三态的单一下一步跳转，分别指向失败文档诊断、进行中 run 观察与 trace 结果路径
     - 失败态文案契约进一步收紧为“一行失败摘要 + 既有 trace follow-up”，优先产品语言，后端底层字段保持次级诊断位
      - Report Center pre-run context 已补齐 URL carry-through 预览，运行前可核对 question set / assistant / baseline snapshot 与即将写入 URL 的参数
      - Report Center result readout 已补齐 summary-before-details 速读顺序：先看 current inputs / summary / diff / weakest-item / next action，再进入详细图表与表格
      - Report Center regression follow-up 文案已补齐可读性：回归原因标签使用产品语言，next action 明确落在现有 Run diff summary 与 Regression weakest items 路径
3. 因此，后续更适合做的是：
   - 已完成区域内的 bounded maintenance
   - 或基于现有产品状态选择新的明确小波次
4. 保持现有 API contract，不重做 source 管理后台
5. 保持 `PC Web` 优先，不展开移动端适配
 6. 在当前个人/单工作区使用方式下，前端先按 `single primary KB` 收敛；多 KB / 多租户交互留到后续明确 workspace 语义后再处理

建议执行顺序：

1. 在 `P3/P4/P5/P6` 已完成区域内继续做 bounded maintenance
2. 如果开启新的产品增量，先明确单一主线和最小收口目标
3. 对新主线采用 focused contract / regression 先行，而不是同时打开多个并行方向

不做：

- 不把当前这轮 `P4` 已完成收口重新写成待开发 backlog
- 不新增 source family
- 不做 source platform / plugin 化
- 不重写现有 backend ingestion contract

### Priority C: bounded maintenance only

以下方向仍允许继续做，但只作为维护位，不作为主开发波次：

- `P3` source-family 内稳定性修补
- `P5` baseline / replay / report 使用侧维护
- `P6` readability / docs sync
- API best-practices hardening follow-up（后续仅保留剩余小项，如扩大 pipe 化覆盖面、异常映射一致性维护、少量安全加固）

要求：

- 必须是窄范围、回归导向、可验证的小改
- 不得重新包装成新的 feature wave
- 已完成的本轮 API hardening 收口包括：streaming pre-start 错误语义修正、公开 auth 路由限流、OAuth onboarding 事务边界、auth/bootstrap/queue 运行时配置收敛，以及一轮 `ZodValidationPipe + 参数 pipe` 校验迁移
- 后续继续做后端输入校验 hardening 时，优先保留现有 `Zod` 作为单一 schema / type source，通过自定义 `ZodValidationPipe` 承接 `@Body()` / `@Query()` 校验，并按仓库实际主键形态为 `id` 等路由参数补合适的参数 pipe；当前仓库多数资源主键是 `cuid`，不应默认套用 `ParseUUIDPipe`。也不默认把当前 API 校验体系整体迁回 `class-validator` / `class-transformer` DTO 栈。

## 3. 阶段状态

| Phase | Status | 说明 |
| --- | --- | --- |
| P0 | done | read-model / metadata convergence 已完成 |
| P1 | done | auth/login 最小闭环已完成 |
| P2 | done | owner-only ACL baseline 已完成 |
| P3 | done / maintenance only | source family 和 guardrails 已落地 |
| P4 | done / bounded follow-up only | 当前这轮 web capability carry-through 收口已完成，后续只做小型维护 |
| P5 | done / governance only | eval runner / baseline / replay / report / quality gate 已落地 |
| P6 | done / bounded follow-up only | observability readability 已完成，不扩成平台化改造 |

## 4. 不做什么

- 不把 `P3` / `P5` 重新当作默认下一条 feature wave
- 不把当前这轮 `P4` 收口重新当作默认下一条 feature wave
- 不做 broad refactor、架构重写、schema / persistence 大改
- 不做新的 source family 扩展，除非已有 family 内能力被证明无法满足明确需求
- 不把 observability 扩成新的平台方向
- 不把 docs / queue / backlog bookkeeping 扩成独立产品方向
- 不在没有明确收益时改 retrieval 语义、默认策略开关或模型分工

## 5. focused validation

默认继续使用最小相关验证：

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

`P0`、`P1`、`P2` 已完成，`P3`、当前这轮 `P4`、`P5`、`P6` 均已完成当前范围内的主开发或收口；接下来最合理的推进方式是维持 bounded maintenance，并在需要新增量时先选择一条新的明确单线主线。
