# RAG 项目下一步计划

> 文档角色：`current-primary`
> 当前使用方式：作为现阶段任务方向、优先级判断和阶段边界的主文档；`docs/current-progress.md` 负责记录近期完成情况和验证基线。
> 更新时间：2026-04-26

## 1. 当前判断

当前项目已经完成了以下主开发能力：

- 本地优先 RAG MVP 主链路
- ask / stream 渐进式聊天体验
- `PC Web` 主路径承载
- external knowledge source 第一轮能力
- `P0` read-model / metadata convergence
- `P1` auth/login 最小闭环
- `P2` owner-only ACL baseline
- `P3` external-source family + guardrails
- `P5` eval / regression baseline
- `P6` observability readability

当前阶段不应再把 `P3`、`P5`、`P6` 或最近一轮前端收口继续包装成新的主开发波次。更准确的状态是：

- `P3`：开发完成，进入维护态
- `P4`：当前这一轮 web capability carry-through 已收口完成
- `P5`：工程能力完成，进入治理 / 使用态
- `P6`：已完成 bounded closeout，后续只做小型可读性维护

因此，接下来最合理的推进方式是：

**以现有默认主路径为底座，补一个最小 agent 化增量：让系统先判断问题类型，再走合适的现有处理链路。**

## 2. 当前优先级

### Priority A: minimal agentization on top of the default path

现状：

- 默认助手、默认知识库、默认 retrieval profile 的 bootstrap / repair 已经落地
- 默认路径上的上传、状态反馈、提问、citations、trace 也已收口到可用状态
- 当前系统仍以单路径 RAG 为主，适合在不打散主路径的前提下补一个最小决策层
- 这一步不再是“把链路搭出来”，而是基于现有链路增加“先决策、再执行”的最小 agent 化能力
- 本阶段实现风格固定为高内聚、低耦合：route classifier、route executor、external-source adapter、trace write-back 分开收口，不继续堆成一个超长混合流程

目标：

- 在 ask 入口前引入轻量 route decision
- 先把问题分到少量清晰路径，而不是固定单一路径处理所有问题
- 让 route decision 进入 trace / metadata，便于后续调试和评估
- 保持默认用户上传资料并问答的主路径仍然顺畅可用

边界：

- 优先复用当前 `single primary KB + default assistant` 主路径和现有模块
- 只做最小 router / classifier，不扩成 planner、multi-agent、长任务自治循环
- 不顺势扩成模板系统、多知识库、团队产品化或管理端

建议首个可交付版本：

1. `knowledge-base ask`
2. `external-source route`
3. `deterministic policy reply`

推荐判定方式：

- 先从规则路由或轻量分类做起
- 先覆盖“知识库问答 / 外部来源补充 / 系统策略类问题”这三类
- 等 trace 和 focused validation 稳定后，再决定是否需要更强分类器
- 外部来源路由要保持精确优先级，避免把泛化 `.xml` 误判成 sitemap，优先根据真实来源语义做分流
- 外部来源输入识别要兼容常见复制形态，优先支持 markdown 链接和裸 URL，再考虑其他封装格式

### Priority B: bounded maintenance on the default path

当前要继续关注的点：

1. 默认路径仍然可用且不被新路由打散
2. “先上传资料，再开始提问”的引导继续明确
3. 资料 ready 后的默认聊天路径继续顺畅
4. 回答 citations 和 trace 继续可排查

### Priority C: canonical default assistant behavior

当前要继续关注的点：

1. 默认助手的确定性优先级
2. 默认助手与主知识库绑定的一致性
3. 默认助手 repair / recovery 的异常态处理
4. 默认路径文案和状态面板与实际行为的对齐
5. 默认主路径相关的幂等和回归保护

说明：

- 当前默认助手已经是系统默认路径的一部分，不再是待搭建能力
- 后续重点不是扩模板概念，而是把默认助手生命周期和读路径行为做稳
- 用户看到的是默认助手，不是内部模板

### Priority D: focused validation and regression protection

目标：

- 给最小 agent 化增量和默认主路径补最小必要的回归保护
- 验证行为变化，而不只是类型层面通过

优先验证：

- ask 路由决策
- route decision 写入 trace / metadata
- 不同 route 对应的后续处理链路
- 默认助手初始化 / 恢复
- 默认助手与主知识库关系
- 上传资料后的状态流转
- ask / citations / trace 的 focused 回归

### Priority E: docs freshness only

要求：

- `current-context` / `current-progress` / 本文档保持与代码现实一致
- 文档继续服务当前主线，不再并行维护多个互相竞争的产品方向

## 3. 建议执行顺序

1. 当前队列已完成最小 route decision、trace/metadata surface、external-source route detection、bounded second retrieval pass，以及默认助手 repair / 默认路径 copy / 默认 ask-path orchestration 的窄范围收口
2. 当前最小 agent demo surface 已完成 closeout 补位；后续只继续维护 trace / report / chat inspection surface 上 route choice、execution mode、tool names 的展示与现有契约一致，不扩成单独 agent 平台
3. 保持 ask route / trace / fallback 的 focused tests 和既有契约稳定，不把这轮补位扩成新平台层
4. 默认助手 / 主知识库 / retrieval profile 的 canonical 选择继续做 bounded maintenance
5. 默认路径空态、异常态和 next action 文案继续与 repair/upload-first 行为对齐
6. 在以上都稳定后，再考虑下一条最小 agent 能力增量，并继续保持文档和代码现实同步

## 4. 当前明确不做

- 不做团队接入、workspace / tenant 产品化、完整 SaaS 化
- 不做多知识库交互重构
- 不做 planner、multi-agent、复杂 memory 分层、自治任务系统
- 不做正式模板系统、多模板列表、模板市场、模板审批 / 版本治理
- 不做复杂管理端、复杂权限矩阵、计费外壳
- 不继续优先做 README / demo / setup / source-distribution 包装
- 不做 broad refactor、架构重写、schema / persistence 大改

## 5. 阶段状态

| Phase | Status                        | 说明                                                                 |
| ----- | ----------------------------- | -------------------------------------------------------------------- |
| P0    | done                          | read-model / metadata convergence 已完成                             |
| P1    | done                          | auth/login 最小闭环已完成                                            |
| P2    | done                          | owner-only ACL baseline 已完成                                       |
| P3    | done / maintenance only       | source family 和 guardrails 已落地                                   |
| P4    | done / bounded follow-up only | 当前这一轮 web capability carry-through 已收口完成，后续只做小型维护 |
| P5    | done / governance only        | eval runner / baseline / replay / report / quality gate 已落地       |
| P6    | done / bounded follow-up only | observability readability 已完成，不扩成平台化改造                   |

## 6. focused validation

默认继续使用最小相关验证：

- docs / queue sync
  - `git diff --check -- <files...>`
- API focused test
  - `pnpm test:api:file -- test/<file>.test.js`
- web focused test
  - `pnpm --filter @rag-system/web exec vitest run test/<file>.test.js`
- queue item validation command should stay one-item/one-command and focused; avoid broad chained suites, mixed checks, and fallback command chains in queue prompts
- queue tasks should stay on Vitest-based test commands and should not introduce new raw `node --test` validations or legacy aliases that still resolve to `node:test`
- if recovery is needed, rewrite the queue item back down to one focused Vitest command instead of broadening the validation surface on retry
- queue prompts should prefer explicit file-level Vitest commands over broad convenience aliases so the intended validation scope stays stable across retries
- if the only available check for a target is still legacy `node:test`, the next queue increment should be Vitest migration or replacement first, then the feature/fix item with one focused Vitest command

当前主线路径优先可复用的验证方向：

- ask route / metadata / trace 相关 focused test
- knowledge-base route 与 deterministic route 的边界 test
- external-source route 的最小通路 test
- 默认助手初始化 / OAuth onboarding 相关 focused test
- 主知识库与 assistant 绑定相关 test
- ask / trace / citations 相关 focused test
- 上传状态与文案 / 空态相关 web focused test

## 7. 一句话结论

当前项目的默认主路径已经可用，接下来不再继续并行展开团队、模板、SaaS、源码包装等多条方向；只保留一条清晰新增量：

**在现有 RAG 主路径上补一个最小 agent 化能力，让系统先判断问题类型，再走合适的现有处理链路。**

## Agentic RAG Priority Order

Priority A:

- `rag_search` / `rag_answer` tool APIs: current bounded contract completed
- server-side tool gateway secret plus internal `userId / tenantId` mapping: completed for agent tool input and request headers
- bounded multi-step flow: current bounded backend increment completed with at most one extra retrieval pass plus first-pass / second-pass / merged diagnostics
- stable response contract with `citations`, `confidence`, and `missingInformation`: completed for agent-facing `rag_answer`

Priority B:

- `trace_lookup` / `document_lookup` helpers for inspection and demos: completed with stable not-found handling
- `/agent` UI with chat plus `steps / chunks / trace`: do not open a separate platform page yet; keep using the existing trace/report/chat inspection surface unless a concrete demo gap appears

Priority C:

- only after the above are stable, consider whether the repo needs any broader planning or workflow abstraction

Explicit non-goals:

- planner
- multi-agent
- generic workflow engine
- platform split
