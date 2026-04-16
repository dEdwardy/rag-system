# RAG 项目下一步计划

> 文档角色：`current-primary`
> 当前使用方式：作为现阶段任务方向、优先级判断和阶段边界的主文档；`docs/current-progress.md` 负责记录近期完成情况和验证基线。
> 更新时间：2026-04-16

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

**只围绕默认主路径做一条明确主线：让默认用户上传资料并问出可信答案。**

## 2. 当前优先级

### Priority A: bounded maintenance on the default path

现状：

- 默认助手、默认知识库、默认 retrieval profile 的 bootstrap / repair 已经落地
- 默认路径上的上传、状态反馈、提问、citations、trace 也已收口到可用状态
- 这一步不再是“把链路搭出来”，而是维护 canonical 行为并减少歧义

目标：

- 维持新用户进入后默认路径可用
- 维持“先上传资料，再开始提问”的引导明确
- 维持资料 ready 后的默认聊天路径顺畅
- 维持回答 citations 和 trace 可排查

边界：

- 只围绕当前 `single primary KB + default assistant` 主路径做收口
- 不顺势扩成模板系统、多知识库、团队产品化或管理端

### Priority B: canonical default assistant behavior

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

### Priority C: focused validation and regression protection

目标：

- 给默认主路径补最小必要的回归保护
- 验证行为变化，而不只是类型层面通过

优先验证：

- 默认助手初始化 / 恢复
- 默认助手与主知识库关系
- 上传资料后的状态流转
- ask / citations / trace 的 focused 回归

### Priority D: docs freshness only

要求：

- `current-context` / `current-progress` / 本文档保持与代码现实一致
- 文档继续服务当前主线，不再并行维护多个互相竞争的产品方向

## 3. 建议执行顺序

1. 默认助手 / 主知识库 / retrieval profile 的 canonical 选择继续收紧
2. 默认路径空态、异常态和 next action 文案继续对齐
3. 补主路径 focused tests
4. 保持文档和代码现实同步

## 4. 当前明确不做

- 不做团队接入、workspace / tenant 产品化、完整 SaaS 化
- 不做多知识库交互重构
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
  - `node --test --test-name-pattern "<name>" apps/web/test/<file>.test.js`

当前主线路径优先可复用的验证方向：

- 默认助手初始化 / OAuth onboarding 相关 focused test
- 主知识库与 assistant 绑定相关 test
- ask / trace / citations 相关 focused test
- 上传状态与文案 / 空态相关 web focused test

## 7. 一句话结论

当前项目的默认主路径已经可用，接下来不再继续并行展开团队、模板、SaaS、源码包装等多条方向；只保留一条维护主线：

**把“默认用户上传资料并问出可信答案”这条默认路径继续做稳。**
