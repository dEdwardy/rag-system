# Current Context

> 文档角色：`current-context`
> 当前使用方式：默认给人和 agent 提供短摘要；只保留当前主线、执行边界、最小验证和高频入口，详细历史按需回看其他文档。
> 更新时间：2026-04-13

## Current Mainline

- 当前默认工作方式仍然是：单线推进、小步增量、每轮收口，不并行展开多个大方向。
- 当前代码现实已经明显前于旧计划口径：
  - `P0` read-model / metadata convergence：已完成
  - `P1` auth/login 最小闭环：已完成
  - `P2` owner-only ACL baseline：已完成
  - `P3` external-source family + guardrails：开发已完成，进入维护态
  - `P4` web capability carry-through：当前范围内已收口，进入 bounded follow-up
  - `P5` eval / regression baseline：工程能力已完成，进入治理/使用态
  - `P6` observability readability：已完成 bounded closeout
- 因此，接下来更合适的做法是：
  - 在已完成区域内继续做 bounded maintenance
  - 或者先明确下一条新的单线产品增量，再推进最小收口 increment

## Current Product Shape

- 前端主路径已经收口到普通用户可用闭环：`资料库 -> 回答设置 -> 对话`。
- 当前产品交互仍以 `single primary KB` 为主，不展开多 KB / 多租户交互重做。
- Trace / Report / Assistant settings 已经形成可用的治理闭环，适合继续做小步提质，不适合再开一轮大平台化改造。
- 文档上传、解析、切块、检索、回答、引用、trace 持久化都已具备，后续重点不再是“把链路搭出来”，而是“把已有链路做稳、做清楚、做快一点”。
- 最近一轮前端 bounded maintenance 已把几个最明显的大列表边界补齐：`DocumentsPage` 真分页、`TraceListPage` 真分页、聊天侧边栏按需“加载更多”会话、`ReportResultsTable` 分页、`DocumentDetailChunksPanel` 分页。

## Retrieval / Quality Baseline

- 当前仓库对齐后的默认本地 retrieval baseline 是保守配置：
  - `topK = 3`
  - `chunkWindow = 0`
  - `hybrid = OFF`
  - `rerank = OFF`
- 最近一轮 retrieval/answering 修补已经把结构化 Markdown 的“只命中标题、不带正文”问题缩小到了可接受范围。
- 本地 smoke 基线目前是 `37/40` grounded；剩余拒答更像来源内容不足，而不是主链路失效。
- 当前更值得做的是轻量自适应 retrieval，而不是直接把默认参数重新放大。

## Current Priorities

- `bounded stability maintenance`：继续修当前已完成区域内的高频回归，但不再把 `P3/P5/P6` 包装成新的 feature wave。
- `docs freshness`：保持阶段判断、当前状态和入口文档与代码现实一致。
- `next product increment selection`：如果继续做产品增量，优先先选定下一条明确主线，再推进最小可验证增量。
- `performance follow-up`：当前性能优化优先盯 `first token pre-generation`，而不是继续把主要精力投到模型输出层。

## Execution Order

1. 维护 `P3/P4/P5/P6` 范围内的 bounded maintenance。
2. 保持 docs、阶段判断和代码现实对齐。
3. 如果开启新的产品波次，先明确主线，再做最小收口 increment。

## Do Not Do

- 不把已经完成主开发的 `P3/P5/P6` 重新包装成新的主 wave。
- 不把当前 `P4` 收口重新写回“待开发主线”。
- 不做 broad refactor、架构重写、schema / persistence 大改。
- 不在没有明确收益时重开 source expansion、benchmark framework redesign、observability platform 化。
- 不为了少量质量提升就全局拉大 retrieval 默认参数。

## Validation Baseline

- focused 文档/脚本检查：`git diff --check -- <files...>`
- API focused test：`pnpm test:api:file -- test/<file>.test.js`
- web focused test：`node --test --test-name-pattern "<name>" apps/web/test/<file>.test.js`
- 只有在当前增量确实跨范围时，才升级到更重的 `pnpm build` / `pnpm lint` / `pnpm typecheck`

## Key Docs

- 方向与优先级：[docs/next_steps_rag_project_plan.md](D:\FeProjects\rag-system\docs\next_steps_rag_project_plan.md)
- 当前进展摘要：[docs/current-progress.md](D:\FeProjects\rag-system\docs\current-progress.md)
- 项目状态总览：[docs/project-status-overview.md](D:\FeProjects\rag-system\docs\project-status-overview.md)
- 本地开发与验证：[docs/current-dev-setup.md](D:\FeProjects\rag-system\docs\current-dev-setup.md)
- retrieval / answering 后续优先级：[docs/retrieval-answering-next-steps-2026-04-13.md](D:\FeProjects\rag-system\docs\retrieval-answering-next-steps-2026-04-13.md)
- 本地 smoke 结果：[docs/local-smoke-eval-2026-04-13.md](D:\FeProjects\rag-system\docs\local-smoke-eval-2026-04-13.md)

## Performance Note

- 最新 trace 说明当前瓶颈已经从回答质量/模型输出，转到了 request orchestration。
- `LLM first token` 已经不是主瓶颈，真正需要优先压缩的是 `first token pre-generation` 这段同步链路。
- 下一步优先级：会话加载瘦身、用户消息写库后移或并发、retrieval 子阶段拆分、复杂题才启用重 rerank。
- 后续优化继续保持回答质量不变，只削减模型前的编排开销。
