# RAG 项目下一步计划

> 文档角色：`current-primary`
> 当前使用方式：当前阶段任务方向、优先级判断、superpowers 使用方式、AI review 策略，以本文档为主；`docs/current-progress.md` 主要承担进度记录和完成状态同步。

更新时间：2026-03-22

## 1. 当前判断

当前项目已经完成：

- 本地优先 RAG MVP 主链路
- ask / stream 的第一轮渐进式聊天体验
- `PC Web` chat 的流处理与原生答案流式生成能力
- external knowledge source 的第一轮最小增量：
  - web page
  - feed
  - sitemap
  - sitemap index

当前阶段不应该再同时开启多个大方向，而应进入：

**单线推进 + 小步增量 + 每轮收口**

## 2. 当前优先级

### P0：external knowledge source expansion

`PC Web chat experience polish` 这一轮收口现在可以视为完成，接下来主线正式切回 `external knowledge source expansion`。

当前已完成的最小 source family：

- one direct `http` / `https` web page source
- one direct RSS / Atom feed source
- one direct sitemap `urlset` source
- one root sitemap `sitemapindex` source that expands child direct sitemaps

这一轮建议优先关注：

- 保持 `backend / API first`
- 在现有 source family 上继续做最小而连续的增量
- 强化 source 级别的可诊断性、失败原因表达和运行边界
- 优先补 source stabilization，而不是继续横向堆更多 source 类型
- 继续复用既有 document creation / ingestion / indexing 主链路

这一轮明确不做：

- 前端大改版
- 移动端适配
- 通用 connector / source 平台化重构
- 调度系统、定时同步、鉴权、多租户能力
- 再开一轮 retrieval / answering 功能扩张

建议的切入顺序：

1. 从现有 source family 中选一个继续推进
2. 一次只补一个稳定性增强点
3. 优先考虑：
   - diagnostics
   - retry / re-sync
   - dedup guards
   - execution boundaries

当前这一轮已经完成的高优先级最小增量：

- source run history / execution observability minimum increment: done
  - document ingestion / external source run 已具备 run-level persistence
  - 当前可通过 `GET /documents/:id/runs` 读取 `upload` / `reindex` / `external_resync` 的执行历史
  - 当前也可通过 `GET /knowledge-bases/:id/document-runs` 在 knowledge-base 级别查看最近 run history
  - knowledge-base 级 run history 已支持最小过滤和 limit，便于直接聚焦失败 run 或某类 source
  - 当前也可通过 `GET /knowledge-bases/:id/document-runs/summary` 读取轻量聚合概览
  - summary 已能直接区分 retryable / non-retryable failures，并按 failed stage 聚合
  - stale ingestion job 也会在 run history 中显式标记为 `skipped`

### P1：retrieval / answering 收敛

retrieval / answering 目前已经具备较多能力，后续更适合做系统化收敛，而不是继续快速堆功能。

建议方向：

- 固定更清晰的默认策略
- 降低配置理解成本
- 提升 trace 与执行 metadata 的可读性
- 让调参与策略选择更可解释

当前不建议优先做：

- 再继续堆更多 retrieval 策略开关
- 再继续扩很多高级回答模式

### P2：PC Web 后续局部收口

只有在新能力接入直接影响当前页面承载时，才继续做局部 UI / UX 收口。

控制原则：

- 只做与当前新增能力直接相关的页面承载优化
- 不再开启新一轮大范围 UI 重构
- 继续坚持 `PC Web` 优先、移动端后置

## 3. 工作方式建议

建议执行方式：

1. 每一轮只推进一个主主题
2. 每一轮先写清楚“做什么 / 不做什么”
3. 优先做最小可验证增量
4. 跑最小必要验证
5. 更新 `docs/current-progress.md`

关键原则：

- 不并行开多个主方向
- 优先严格串行执行
- 不并行跑重型测试或 build
- 不把 AI review 和重型验证叠在一起

## 4. AI Review 策略

保留当前仓库已采用的策略：

- 不默认自动 review
- 只在高风险改动时手动 review diff
- review 重点放在：
  - logic bugs
  - state consistency
  - error handling gaps
  - breaking behavior in the existing pipeline

适合启用 AI review 的改动：

- ask 主链路
- stream
- retrieval
- ingestion
- 接口协议
- 数据库相关行为
- orchestrator

不适合启用 AI review 的改动：

- UI 美化
- 文案调整
- 样式修改
- 小重构
- 一般配置项修改

## 5. 一句话结论

**`PC Web` 这轮 UI 收口已完成；接下来主线正式切回 `external knowledge source expansion`，并继续按 backend-first、小步增量、优先稳定化的方式推进。**
