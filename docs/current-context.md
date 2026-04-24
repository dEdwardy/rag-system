# Current Context

> 文档角色：`current-context`
> 当前使用方式：默认给人和 agent 提供短摘要；只保留当前主线、执行边界、最小验证和高频入口，详细历史按需回看其他文档。
> 更新时间：2026-04-25

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
- 因此，当前最合适的推进方式不是继续扩新产品外壳，而是做 bounded maintenance，并在现有 RAG 底座上补一个最小 agent 化增量。

## Current Product Shape

- 前端主路径已经收口到普通用户可用闭环：`资料库 -> 回答设置 -> 对话`。
- 当前产品交互仍以 `single primary KB` 为主，不展开多 KB / 多租户交互重做。
- Trace / Report / Assistant settings 已经形成可用的治理闭环，适合继续做小步提质，不适合再开一轮大平台化改造。
- 文档上传、解析、切块、检索、回答、引用、trace 持久化都已具备，后续重点不再是“把链路搭出来”，而是“把已有链路做稳、做清楚、做快一点”。
- 当前默认助手基线已经落地：新用户会自动获得默认助手实例；用户看到的是默认助手，而不是内部模板概念。
- 当前系统仍然主要是单路径 RAG 应用，而不是完整 agent 系统；后续增量应优先补轻量决策/路由层，而不是直接扩复杂 planner 或 multi-agent。

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

- `high cohesion / low coupling`：当前阶段把高内聚、低耦合作为硬约束；route classifier、source fetch、answer orchestration、trace persistence 不继续堆进同一块实现。
- `bounded maintenance`：在已完成的默认主路径上继续收紧边界一致性，而不是开启新产品波次。
- `minimal agentization increment`：在 ask 入口前补一个最小决策层，让系统能先判断问题类型，再决定走哪条现有处理路径。
- `single primary KB clarity`：保持单主知识库语义清晰，上传后状态和 next action 更直接。
- `canonical default assistant selection`：维持默认助手的确定性优先级和 repair 行为，避免同库重复数据造成歧义。
- `focused validation`：优先补与默认主路径直接相关的 focused tests 和回归保护。
- `docs freshness`：保持阶段判断、当前状态和入口文档与代码现实一致。

## Execution Order

1. 先定义并落地一个最小 agent 化增量：在 ask 入口前增加轻量分类/路由决策。
2. 将路由决策接到现有处理链路上，优先复用现有 KB ask、external-source family 或 deterministic reply。
3. 把 route decision 写入 trace / metadata，并补对应 focused validation。
4. 继续收紧默认助手 / 主知识库 / retrieval profile 的 canonical 选择与 repair 语义。
5. 继续收口默认路径的状态反馈和 next action 文案。
6. 保持 docs、阶段判断和代码现实对齐。

## Do Not Do

- 不把团队接入、workspace / tenant 产品化、SaaS 化当成当前主线。
- 不展开多知识库交互、多模板系统、模板 marketplace、复杂权限矩阵。
- 不一上来做 planner、multi-agent、长任务自治循环、复杂 memory 分层。
- 不把 README / demo / setup / source-distribution 包装继续当作当前优先项。
- 不做 broad refactor、架构重写、schema / persistence 大改。
- 不为了少量质量提升就全局拉大 retrieval 默认参数。

## Minimal Agentization Task

- 实现约束：
  - route decision 保持独立收口
  - external-source adapter 保持独立收口
  - route-specific execution 保持独立收口
  - 新增逻辑优先降低耦合，不把更多分支继续堆进单一大方法
- 目标：在现有 RAG 主链路上补一个最小 agent 化能力，让系统从“固定单路径问答”升级到“先决策、再执行”的 AI 应用。
- 推荐首个增量：
  - `knowledge-base ask`：问题命中知识库问答路径时，继续走现有 retrieval + answering
  - `external-source route`：问题更适合走现有 external-source family 时，切到现有 `web page` / `feed` / `sitemap` 能力或其受限变体
  - `deterministic policy reply`：系统策略类、能力边界类问题直接走确定性回复，避免无意义检索
- 最小完成标准：
  - ask 入口前存在一个轻量 route decision
  - route decision 会显式影响后续处理链路
  - trace / metadata 能看到本次 route decision
  - 至少补一条 focused test 锁定该行为
- 约束：
  - 优先规则路由或轻量分类，不引入复杂 planner
  - 优先复用现有模块，不新开平行架构
  - 保持默认用户主路径不被打散

## Validation Baseline

- focused 文档/脚本检查：`git diff --check -- <files...>`
- API focused test：`pnpm test:api:file -- test/<file>.test.js`
- queue item validation should use exactly one small focused command; avoid chaining broad suites in queue prompts
- new queue tasks should use `vitest run` for test validation; do not add new raw `node --test` commands to future queue items. If a legacy `node:test` file is still in the way, migrate or replace it before queueing the task.
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
- `default-path first-token orchestration thin pass` 已落地：问答链路现在会把 retrieval 和 early stream status 发送并行化，先做一轮 pre-generation 瘦身且不改 retrieval 语义。
- `default-path first-token thin pass final follow-up` 也已落地：`generating` status 发送改为 eager non-blocking 边界，继续削减首字节前等待且不改 retrieval/answering 语义。
- 下一步优先级：继续做会话加载瘦身、用户消息写库后移或并发、retrieval 子阶段拆分、复杂题才启用重 rerank。
- 后续优化继续保持回答质量不变，只削减模型前的编排开销。

## Agentic RAG Priority Order

If we want this repo to be interview-ready for agent development, the next increment should be ordered like this:

1. `rag_search` / `rag_answer` tool APIs
2. server-side tool gateway secret plus internal `userId / tenantId` mapping
3. bounded multi-step flow: `query rewrite -> second retrieval -> answer`
4. stable response contract with `citations`, `confidence`, and `missingInformation`
5. `trace_lookup` / `document_lookup` helpers for inspection and demos
6. `/agent` UI with chat plus `steps / chunks / trace`

Scope guardrails for this increment:

- do not jump to `planner` or `multi-agent`
- do not add a generic workflow engine
- do not split the current mainline into a separate platform layer
- do not weaken the default KB / default assistant / ACL baselines

## Codex / OpenCode Behavior Alignment

The loop runtime now treats OpenCode as the baseline executor and Codex as a backend-compatible variant.

| Area            | OpenCode                      | Codex executor                                      |
| --------------- | ----------------------------- | --------------------------------------------------- |
| Entry point     | `opencode` CLI                | `@openai/codex-sdk` first, CLI fallback second      |
| Session model   | CLI session id                | SDK thread id or CLI session id                     |
| Prompt intake   | plain text queue prompt       | same queue prompt shape                             |
| Result contract | normalized loop result object | same normalized loop result object                  |
| Runner impact   | baseline behavior             | runner stays backend-agnostic                       |
| Output format   | native CLI stdout/stderr      | SDK result normalized into loop stdout/stderr shape |

Important difference: the loop runtime behavior is intentionally aligned, but not guaranteed to be byte-for-byte identical. The goal is interchangeable execution semantics for queue processing, not identical internal agent mechanics.

## Future Loop-Runtime Direction

Once the current rag-system mainline is finished, the loop runtime can be extended into a planning-first execution loop:

- LLM first expands a coarse user request into a detailed plan
- LLM can ask clarifying questions until the requirement is explicit enough to execute
- the resulting plan can be split into sequential and parallel queue items
- the runtime then executes those queue items with the existing `loop-runtime` backend abstraction
- failure or partial completion can be routed back into an LLM replan step instead of being handled only by manual review

This direction is intentionally deferred until the current rag-system work is settled. The current repo should keep `loop-runtime` as the execution substrate, while the future planning layer can be added on top later.
