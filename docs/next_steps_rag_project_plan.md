# RAG 项目下一步计划

> 文档角色：`current-primary`
> 当前使用方式：当前阶段任务方向、优先级判断、superpowers 使用方式、AI review 策略，以本文档为主；`docs/current-progress.md` 主要承担进度记录和完成状态同步。

更新时间：2026-03-28

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

状态：✅ 已完成（2026-03-28，P0 closeout queue 已按既定顺序收口）

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

> 完成说明：本批 closeout queue 已完成，本段保留为本轮收口记录。

下面这批适合直接丢进 queue，继续保持单线推进、小步增量、每轮收口。

#### P0 closeout queue（推荐按顺序执行）

Queue 短标题版（可直接作为 loop item title 使用）：

- `ask/trace contract align`
- `web trace contract guard`
- `legacy fallback regressions`
- `unknown/fallback wording unify`
- `trace-summary doc sync`
- `progress closeout note`
- `third-party boundary note`
- `eval/regression baseline`
- `opencode model split review`
- `mark P0 complete`

1. 收口 ask response / trace summary 的标签映射逻辑
   - 重点看 `apps/api/src/modules/traces/traces.service.ts`、`apps/api/src/modules/assistants/ask-assistant.service.ts`、`packages/shared/src/trace-contracts.ts`
   - 目标是确认 `ask` 最终 payload 与 `traceSummary` 在 `strategySummary`、`answerAttributionSummary`、`answerEvidenceSourceReadabilityLabel`、`rewriteReadabilityLabel` 上继续使用同一组术语
   - 只允许 additive / behavior-preserving 收口，不改 retrieval 语义、不改持久化格式
   - 交付物：必要时抽一个最窄共享 helper，并补 1 组 focused regression tests

2. 补齐 web contract 对最新 `TraceSummary` 可读字段的守卫
   - 重点看 `apps/web/test/trace-summary-contract.test.js`、`apps/web/src/types/api.ts`、`apps/web/src/components/trace/*`（如有对应展示位）
   - 目标是让 web 侧继续跟住 backend 新增的可读标签，而不是等接口漂移后再补
   - 需要确认 web 类型、测试、实际展示文案三者一致
   - 交付物：补齐 contract guard 后跑一组最小 web 相关测试

3. 给 legacy fallback 路径补一轮回归测试
   - 重点看 `answerProvenanceSentence`、`missingInformationProvenanceSentence`、`strategySummary`、`usedFallback` 的旧数据回填路径
   - 目标是锁住旧 trace 读模型在缺字段时的回填一致性，尤其是历史 trace 里只存了部分 fallback 元信息的情况
   - 要覆盖至少一条“老数据只带 top-level fallback 线索”的路径，以及一条“字段缺失但应继续可读”的路径
   - 交付物：focused regression test + 文档更新说明

4. 统一 unknown / fallback 文案风格
   - 重点看 `failedStageReadabilityLabel`、`answerStatusSourceReadabilityLabel`、`answerTextSourceReadabilityLabel`、`answerAttributionSummary.readabilitySentence`
   - 目标是让诊断文本继续保持一眼可扫、语义一致，并让 unknown/fallback 的措辞能直接对齐读模型语境
   - 只改文案，不改语义；遇到 raw value 时仍保留原始诊断信息
   - 交付物：必要时收敛到一个更窄的 label helper，并补测试

5. 同步 `docs/current-dev-setup.md` 的 trace-summary 字段清单
   - 只补当前 contract 已经存在的字段，不引入新契约
   - 重点是让文档中的字段列表与 `packages/shared/src/trace-contracts.ts`、`apps/api/src/modules/traces/traces.service.ts` 保持同一版说明
   - 如果字段已经在文档里但说明不够清晰，优先补一句用途而不是展开大段解释
   - 交付物：文档与实现对齐记录

6. 在 `docs/current-progress.md` 里补一次 closeout 记录
   - 每完成一个 queue item，就顺手记下变更文件和最小验证命令
   - 把“做了什么、没做什么、验证了什么”三件事写清楚，方便后续复盘 phase closeout
   - 交付物：一条简短但可追踪的完成记录

7. 整理第三方集成边界说明
   - 重点看 `README.md`、`docs/current-dev-setup.md`、`docs/next_steps_rag_project_plan.md`
   - 目标是明确产品依赖哪些可替换层：模型、向量、chunking、外部 source、评估/诊断；哪些是当前产品核心：orchestration、traceability、fallback、regression
   - 避免把项目叙述成必须自研全栈 RAG 才有价值
   - 交付物：一段可以直接给后续开发/部署参考的边界说明

8. 补一个稳定的 eval / regression 基线说明
    - 重点看现有测试入口、focused test 习惯、trace/ask 的关键断言
    - 目标是把“如何判断这轮收口真的没退化”写成一套最小可复用说明
    - 优先采用已有测试命令，不要引入重型新框架
    - 交付物：一页可直接执行的最小验证清单

    最小可复用基线（closeout wave）：

    - `pnpm test:api:file -- test/traces.service.test.js`
    - `pnpm test:api:file -- test/ask-success.test.js`
    - `node --test apps/web/test/trace-summary-contract.test.js`

    回归确认口径（本轮收口）

    - 三条命令全部通过，视为 ask/trace 读模型与 web trace contract 未出现本轮回归。
    - 若失败，先按失败文件定位到 `trace summary` / `ask final payload` / `web contract guard` 对应路径修复，再重跑同一组命令，不直接升级到重型全量测试。

9. 复核 opencode 的模型分工是否还要微调
   - 重点看 `opencode.jsonc`、`apps/api/opencode.jsonc`、`apps/web/opencode.jsonc`
   - 默认保持现有分工，只有在成本/质量有明确收益时才改
   - 如果不改，也要在进度文档里把“为什么不改”写清楚，避免后续重复讨论
   - 交付物：明确的保留/调整结论

10. 在当前计划里标记 `P0` 已收口
    - 重点确认以上 closeout task 完成后，是否可以把 `P0: read-model / metadata convergence` 标记为完成
    - 只做状态更新和结论记录，不再把新方向混进同一波次
    - 交付物：更新本文件的状态结论，以及 `docs/current-progress.md` 的 phase closeout 说明

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

### 边界说明：产品核心 vs 第三方集成

- 当前产品核心不是“自研所有底层组件”，而是：稳定的 orchestration、可读可追踪的 trace/read-model、可预期的 fallback 语义、以及可复用的 regression 基线。
- 第三方/可替换层包括：模型与 embedding 提供方、向量实现、chunking/parsing 适配、external source 接入、eval/diagnostics 工具。
- 后续迭代原则：允许替换上述集成层，但默认保持 core contract 与行为语义不变，不把“换 provider”扩展成新架构改造任务。

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
