# Current Context

> 文档角色：`current-context`
> 当前使用方式：默认给人和 agent 提供短摘要；只保留当前主线、执行边界、最小验证和高频入口，详细历史按需回看其他文档。
> 更新时间：2026-04-16

## Current Mainline

- 当前默认工作方式仍然是：单线推进、小步增量、每轮收口，不并行展开多个大方向。
- 代码现实已经明显前于旧计划口径：
  - `P0` read-model / metadata convergence：已完成
  - `P1` auth/login 最小闭环：已完成
  - `P2` owner-only ACL baseline：已完成
  - `P3` external-source family + guardrails：开发已完成，进入维护态
  - `P4` web capability carry-through：当前范围内已收口，进入 bounded follow-up
  - `P5` eval / regression baseline：工程能力已完成，进入治理/使用态
  - `P6` observability readability：已完成 bounded closeout
- 当前默认主路径也已经落地并对齐到代码行为：
  - 新用户进入后会得到默认助手 / 默认知识库 / 默认 retrieval profile 的 bootstrap 或 repair
  - 用户会被引导先上传资料，再开始提问
  - 资料 ready 后可直接进入提问与设置路径
  - 回答保留 citations，问题可通过 trace 排查
- 因此，当前最合适的推进方式不是继续扩新产品外壳，而是做 bounded maintenance，并把默认路径上的细小一致性继续收紧。

## Current Product Shape

- 前端主路径已经收口到普通用户可用闭环：`资料库 -> 回答设置 -> 对话`。
- 当前产品交互仍以 `single primary KB` 为主，不展开多 KB / 多租户交互重做。
- Trace / Report / Assistant settings 已经形成可用的治理闭环，适合继续做小步提质，不适合再开一轮大平台化改造。
- 文档上传、解析、切块、检索、回答、引用、trace 持久化都已具备，后续重点不再是“把链路搭出来”，而是“把已有链路做稳、做清楚、做快一点”。
- 当前默认助手基线已经落地：新用户会自动获得默认助手实例；用户看到的是默认助手，而不是内部模板概念。

## Retrieval / Quality Baseline

- 当前仓库对齐后的默认本地 retrieval baseline 是保守配置：
  - `topK = 3`
  - `chunkWindow = 0`
  - `hybrid = OFF`
  - `rerank = OFF`
- 最近一轮 retrieval/answering 修补已经把结构化 Markdown 的“只命中标题、不带正文”问题缩小到了可接受范围。
- 本地 smoke 基线目前是 `37/40` grounded；剩余拒答更像来源内容不足，而不是主链路失效。
- 当前更值得做的是主路径稳定性和默认体验收口，而不是继续放大 retrieval 默认参数或扩展产品外壳。

## Current Priorities

- `bounded maintenance`：在已完成的默认主路径上继续收紧边界一致性，而不是开启新产品波次。
- `single primary KB clarity`：保持单主知识库语义清晰，上传后状态和 next action 更直接。
- `canonical default assistant selection`：维持默认助手的确定性优先级和 repair 行为，避免同库重复数据造成歧义。
- `focused validation`：优先补与默认主路径直接相关的 focused tests 和回归保护。
- `docs freshness`：保持阶段判断、当前状态和入口文档与代码现实一致。

## Execution Order

1. 继续收紧默认助手 / 主知识库 / retrieval profile 的 canonical 选择与 repair 语义。
2. 继续收口默认路径的状态反馈和 next action 文案。
3. 补主路径需要的 focused validation。
4. 保持 docs、阶段判断和代码现实对齐。

## Do Not Do

- 不把团队接入、workspace / tenant 产品化、SaaS 化当成当前主线。
- 不展开多知识库交互、多模板系统、模板 marketplace、复杂权限矩阵。
- 不把 README / demo / setup / source-distribution 包装继续当作当前优先项。
- 不做 broad refactor、架构重写、schema / persistence 大改。
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
