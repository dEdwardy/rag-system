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

### Priority A: default path hardening

目标：

- 让新用户进入后能稳定拿到默认助手
- 让用户明确知道先上传资料，再开始提问
- 让资料 ready 后的默认聊天路径更顺
- 让回答带 citations，问题可通过 trace 排查

边界：

- 只围绕当前 `single primary KB + default assistant` 主路径做收口
- 不顺势扩成模板系统、多知识库、团队产品化或管理端

完成标准：

- 默认用户第一次使用时，主路径没有明显断点
- 默认助手存在且语义清晰
- 资料状态和 next action 明确
- 首轮提问、引用、trace 路径可理解

### Priority B: default assistant lifecycle

优先做的功能点：

1. 默认助手恢复机制
2. 默认助手唯一性规则
3. 默认助手与主知识库绑定收口
4. 默认助手空态 / 异常态闭环
5. 默认助手初始化与幂等规则补齐

说明：

- 当前默认助手已经作为系统默认路径的一部分存在
- 后续重点不是再扩模板概念，而是把默认助手生命周期做稳
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

1. 默认助手恢复机制
2. 默认助手唯一性和主知识库绑定规则
3. 默认助手相关空态 / 异常态闭环
4. 主知识库上传后状态与 next action 收口
5. 聊天首轮成功路径和可理解性收口
6. 补主路径 focused tests

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

当前项目接下来不再继续并行展开团队、模板、SaaS、源码包装等多条方向；只保留一条主线：

**把“默认用户上传资料并问出可信答案”这条默认路径做稳。**
