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

### P0：read-model / metadata convergence

`PC Web chat experience polish` 这一轮收口现在可以视为完成；当前 external knowledge source 的第一轮最小 source family 也已在现有范围内完成 backend / API 收口。接下来更合适的下一最小增量，不是继续把主线写成 external source expansion，也不是直接改 retrieval 行为语义，而是先做一轮 **read-model / metadata convergence**。

当前已完成的最小 source family：

- one direct `http` / `https` web page source
- one direct RSS / Atom feed source
- one direct sitemap `urlset` source
- one root sitemap `sitemapindex` source that expands child direct sitemaps

当前这一轮建议优先关注：

- 保持 `backend / API first`
- 保持 additive、behavior-preserving 的收口方式
- 统一 ask response、trace summary、shared contract 的策略摘要表达
- 提升 trace 与执行 metadata 的可读性，而不是继续堆新的策略开关
- 让最终生效策略、fallback 原因、回答归因更直接可读

这一轮明确不做：

- retrieval 行为语义调整
- 默认 `topK` / `scoreThreshold` / `rerank` 等策略改写
- 新的 retrieval mode 扩展
- 新一轮 external source family expansion
- schema / persistence 大改
- 前端大改版或新的 UI 主主题

建议的切入顺序：

1. 先收 ask response / trace summary / shared contract 的策略摘要表达
2. 一次只补一个 read-model / metadata clarity 缺口
3. 优先考虑：
   - resolved strategy summary
   - trace readability
   - contract alignment
   - focused validation

当前这一轮已经提供了足够基础，可直接支持这一收口方向：

- source run history / execution observability minimum increment: done
  - document ingestion / external source run 已具备 run-level persistence
  - 当前可通过 `GET /documents/:id/runs` 读取 `upload` / `reindex` / `external_resync` 的执行历史
  - 当前也可通过 `GET /knowledge-bases/:id/document-runs` 在 knowledge-base 级别查看最近 run history
  - knowledge-base 级 run history 已支持最小过滤和 limit，便于直接聚焦失败 run 或某类 source
  - run list 默认已收紧 payload，仅在 `includeDiagnostics=true` 时返回大诊断 JSON
- 当前也可通过 `GET /knowledge-bases/:id/document-runs/summary` 读取轻量聚合概览
- summary 已能直接区分 retryable / non-retryable failures，并按 failed stage 聚合
- list / summary 当前都支持 `sinceHours` 时间窗过滤，更适合最近运行排查
- summary 当前也能直接给出 `latestRetryableFailure` 和 `latestSkipped` 作为诊断锚点
- source-fetch diagnostics 的 `retryable` 判定已按错误边界收口，不再把明显的 invalid payload / content-type 错误误记成可重试
- stale ingestion job 也会在 run history 中显式标记为 `skipped`

### Queue-ready tasks（建议串行执行）

下面这批适合直接丢进 queue，继续保持单线推进、小步增量、每轮收口：

1. 补齐 web contract 对最新 `TraceSummary` 可读字段的守卫
   - 重点看 `apps/web/test/trace-summary-contract.test.js` 和 `apps/web/src/types/api.ts`
   - 目标是让 web 侧继续跟住 backend 新增的可读标签，而不是等接口变了再补
2. 收口 ask response / trace summary 的标签映射逻辑
   - 重点看 `apps/api/src/modules/traces/traces.service.ts` 和 `apps/api/src/modules/assistants/ask-assistant.service.ts`
   - 如果两边还有重复映射，优先抽最窄的共享 helper，保持 additive / behavior-preserving
3. 给 legacy fallback 路径补一轮回归测试
   - 重点看 `answerProvenanceSentence`、`missingInformationProvenanceSentence`、`strategySummary` 的旧数据回填路径
   - 目标是锁住旧 trace 读模型在缺字段时的回填一致性
4. 统一 unknown / fallback 文案风格
   - 重点看 `failedStageReadabilityLabel`、`answerStatusSourceReadabilityLabel`、`answerTextSourceReadabilityLabel`
   - 目标是让诊断文本继续保持一眼可扫、语义一致
5. 同步 `docs/current-dev-setup.md` 的 trace-summary 字段清单
   - 只补当前 contract 已经存在的字段，不引入新契约
   - 目标是让文档和实现保持同一版读模型说明
6. 在 `docs/current-progress.md` 里补一次 closeout 记录
   - 每完成一个 queue item，就顺手记下变更文件和最小验证命令
   - 这样后续回看进度时能直接复盘收口结果
7. 给 opencode loop 补一个面向 read-model / metadata 的专用 prompt 模板
   - 重点看 `.opencode/loop/prompts/` 和 `scripts/opencode-loop.md`
   - 目标是让 queue item 不再复用过于通用的 build prompt
8. 复核 opencode 的模型分工是否还要微调
   - 重点看 `opencode.jsonc`、`apps/api/opencode.jsonc`、`apps/web/opencode.jsonc`
   - 默认保持现有分工，只有在成本/质量有明确收益时才改

### P1：external knowledge source follow-up（后续新波次）

如果后续继续推进 external knowledge source，应视为新的后续增量，而不是当前波次未完成残项。

后续如重开该方向，仍优先保持：

- `backend / API first`
- source stabilization 优先于 source 类型横向扩张
- diagnostics / retry / re-sync / dedup guards / execution boundaries 优先
- 继续复用既有 document creation / ingestion / indexing 主链路

当前不建议把它重新拉回当前主线的原因：

- 当前 source family 已在现有范围内完成 backend / API 收口
- 当前更高价值的最小增量，是把已落地的 retrieval / answering / trace metadata 进一步整理成稳定读模型
- 这样后续无论是否重开 external source，都能在更稳定的 traceability / contract 基础上继续推进

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

**`PC Web` 这轮 UI 收口已完成；当前更合适的下一最小增量是 read-model / metadata convergence：先收口 ask response、trace summary、shared contract 的策略摘要表达，并保持 behavior-preserving，不直接改 retrieval 行为语义。**
