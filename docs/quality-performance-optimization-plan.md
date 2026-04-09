# RAG Quality And Performance Optimization Plan

> 文档角色：`current-analysis`
> 当前使用方式：基于现有代码，给出一份以“回答质量优先，但必须控制响应延迟”为前提的可实施优化方案；重点覆盖 retrieval / answering / trace / ingestion 主链路，不扩成新的大架构波次。
> 更新时间：2026-04-09

## 1. 目标与约束

这份方案面向当前仓库已经落地的 ask 主链路：

- `assistant -> retrieval profile -> retrieval -> answering -> trace`
- 现有 trace / eval / report 能力继续复用，不重做治理平台
- 现有 source family、ingestion、quality governance 保持 bounded maintenance 边界

当前优化目标不是单独追求“更高质量”或“更低延迟”，而是让系统在以下约束下取得更好的综合结果：

1. 对用户可见的问题，优先减少无依据回答、漏召回、summary/list 漏项。
2. 不能为了质量把主路径延迟拉高到不可接受。
3. 不默认引入新的重型外部组件或大规模重构。
4. 优先使用现有 trace / test / retrieval profile 能力形成可验证闭环。

## 2. 当前代码现状判断

### 已经做得较好的部分

- retrieval 已支持 `vector / hybrid / lexical fallback / rerank / chunkWindow`
  - 入口：`apps/api/src/modules/retrieval/retrieval.service.ts`
- answering 已有较完整的质量元数据
  - `coverageSummary`
  - `citationAttribution`
  - `missingInformation`
  - `qualityEvaluation`
  - 入口：`apps/api/src/modules/answering/answering.service.ts`
- ask 链路已有较细粒度 trace 和 timing
  - 入口：`apps/api/src/modules/assistants/ask-assistant.service.ts`
  - 读取：`apps/api/src/modules/traces/traces.service.ts`
- 测试分层较清楚，已经具备做小步质量优化的基础
  - `pnpm test:api:fast:retrieval`
  - `pnpm test:api:fast:llm`
  - `pnpm test:api:focus:llm-retrieval`

### 当前真正的短板

1. query rewrite 虽然有 schema、prompt 和 ask 链路接入，但在质量/延迟权衡下已经被临时关闭。
   - 这说明它不是“没有能力”，而是“默认实现的收益/成本比不够高”。
2. rerank 仍然是启发式 lexical boost，不是更强的二阶段 reranker。
3. chunking 目前主要是按段落/句长切块，对表格、列表、FAQ、半结构化内容不够敏感。
4. prompt context 仍以原始 chunk 文本拼接为主，summary/list 问题容易引入 prompt 噪声。
5. lexical fallback 仍偏 `ILIKE` 风格匹配，规模增长后成本和效果都会变差。
6. embedding cache 只是进程内短 TTL Map，无法覆盖重启、多实例或更高 QPS 场景。

## 3. 当前最重要的产品判断

在当前阶段，不建议直接把 query rewrite 重新默认打开。

原因不是它永远没价值，而是当前实现存在三个问题：

1. rewrite 会额外引入一次 LLM 调用，直接拉长 ask 主路径。
2. 当前 rewrite 是单步、无历史、无问题分型的统一策略，不是所有问题都值得 rewrite。
3. 现有 trace 虽然记录了 rewrite 元数据，但还没有形成足够稳定的“开启 rewrite 是否真提升质量”的自动评估闭环。

因此，本方案的原则是：

- 先优化“不开 rewrite 时”的主路径质量和性能
- 再把 rewrite 从“全量默认能力”改成“按条件触发的受控增强”

## 4. 优化优先级总览

### P0：短期最优先，低风险高收益

1. retrieval 结果质量与延迟的可观测性补齐
2. lexical fallback 升级
3. prompt context 压缩与 summary/list 定向优化
4. retrieval 结果缓存
5. query rewrite 改成条件触发，而不是全量默认开启

### P1：中期推进，收益高但需要更多验证

1. 结构化 chunking
2. 二阶段 rerank
3. answer citation 约束收紧
4. retrieval profile 策略细化

### P2：后续收益项

1. 文档级摘要索引
2. 更细的问题类型路由
3. 更强的共享缓存或异步预计算

## 5. 详细方案

### 5.1 补齐质量与性能观测闭环

这是后续一切优化的前提。当前 trace 已经记录了很多字段，但仍缺少几个足够直接的决策指标。

#### 现状

当前已有：

- retrieval execution summary
- candidate counts
- fallback reason
- answer quality summary
- timing summary

但仍缺少：

- prompt context 体积估算
- retrieval 召回分布统计
- rewrite 开关前后收益对比口径
- answer 质量与延迟的统一聚合视图

#### 建议改动

在 `apps/api/src/modules/assistants/ask-assistant.service.ts` 构建 `retrievalMetadataJson` / `answeringMetadataJson` 时补充：

- `promptContextChars`
- `promptContextApproxTokens`
- `primaryChunkScoreAvg`
- `primaryChunkScoreMin`
- `contextGroupAvgLength`
- `rewriteSkippedReason`
  - 例如：`disabled_by_default`
  - `not_summary_or_complex_question`
  - `query_too_short`
  - `latency_budget_exceeded`

并在 `apps/api/src/modules/traces/traces.service.ts` 的 `traceSummary` 中提升几个高频指标：

- `promptContextApproxTokens`
- `primaryChunkScoreAvg`
- `rewriteSkippedReason`

#### 预期收益

- 后续可以明确判断“慢在哪一段”
- 可以区分“召回差”还是“召回太多导致 prompt 噪声”
- 为 rewrite 的受控恢复提供数据基础

#### 验证

- focused test：`pnpm test:api:fast:assistants`
- focused test：`pnpm test:api:fast:infra`
- 必要时补 trace summary contract test

### 5.2 升级 lexical fallback，避免质量和性能一起吃亏

当前 lexical fallback 在无向量、向量失败、或无有效 ranked candidates 时非常关键。

#### 现状问题

`apps/api/src/modules/retrieval/retrieval.service.ts` 中 lexical 匹配主要基于：

- term tokenize
- phrase / term 命中加权
- SQL 中 `ILIKE '%term%'`

这有两个问题：

1. 数据量变大后慢
2. 对词形变化、中文短词、弱语义匹配不够稳

#### 建议改动

第一步，保持 schema 小改动原则，优先做数据库级增强，而不是替换整套 retrieval：

1. 给 `DocumentChunk` 增加可维护的全文检索列或表达式索引
   - 英文优先可用 `to_tsvector`
   - 中文如果当前先不引入额外词典，也至少保留现有启发式作为 fallback
2. lexical retrieval 路径改成：
   - 优先全文检索得分
   - 再叠加 sectionTitle boost
   - 最后保留当前 phrase exact boost
3. 对 lexical 结果补充 `matchSource`
   - `fts`
   - `section_title`
   - `like_fallback`

#### 预期收益

- vector 不可用时，质量退化更温和
- no-ranked-candidates 的比例应下降
- 较大 KB 下 lexical fallback 延迟更可控

#### 风险

- 涉及 schema / SQL，需要 focused migration 和 query 验证
- 中文效果不会立刻跃迁，需要分阶段做

#### 验证

- `pnpm test:api:fast:retrieval`
- 增补 retrieval SQL 路径测试
- 如果涉及 schema，额外跑 `pnpm --filter @rag-system/api build`

### 5.3 优化 summary/list 问题，而不是全局拉高 topK

当前仓库已经识别到 summary/list 是薄弱点，并做了：

- `coverageSummary`
- `summaryMainItems` 实验入口，但默认关闭
- summary prompt 加强

这说明最值得做的是“定向增强 summary/list”，而不是把所有问题都加大 topK、chunkWindow 和 prompt。

#### 现状问题

1. summary/list 问题经常需要多个并列主项
2. 当前 prompt 仍以原始 chunk 文本为主
3. topK 继续拉大只会增加噪声和延迟

#### 建议改动

在 `apps/api/src/modules/answering/answering.service.ts` 和 `apps/api/src/infra/llm/prompt-manager.service.ts` 上做小步增强：

1. 保持 `summaryMainItems` 默认关闭，但新增一个更便宜的非 LLM 预提取路径
   - 基于 sectionTitle
   - 基于 heading
   - 基于列表项首句
2. 仅对 summary/list 问题，在 prompt 中增加“并列主项清单”
   - 不要求额外一次 LLM 调用
   - 先使用 retrieval 结果里的结构化线索
3. 对 summary/list 问题单独调整 context packing
   - 优先每个 context group 取“标题 + 前几句 + 命中句”
   - 而不是整段 1200 字截断内容全塞入 prompt
4. 对 fact 问题保持当前更轻路径，不额外扩上下文

#### 预期收益

- summary/list 漏项下降
- prompt token 降低
- 延迟不需要为所有问题付出 rewrite 成本

#### 验证

- `pnpm test:api:file -- test/answering.test.js`
- `pnpm test:api:focus:llm-retrieval`
- 用现有 eval 集单独比较 summary/list 题型

### 5.4 让 rewrite 从“默认关闭”变成“条件触发”

这部分要明确：不是恢复旧方案，而是重做启用策略。

#### 现状判断

当前 rewrite 太弱的核心不是 prompt 本身，而是启用条件过粗：

- 所有问题统一走一遍 rewrite，不值
- rewrite 成功率和收益没有按问题类型区分
- rewrite 增加了一次 LLM 往返，直接伤害首 token 时间

#### 建议改动

在 `apps/api/src/modules/assistants/ask-assistant.service.ts` 中，为 `retrievalStrategy.queryRewrite.enabled` 增加一道本地 gating：

只在以下问题上尝试 rewrite：

1. 问题长度超过阈值，例如 `>= 18` 字符或 `>= 6` 个 term
2. 含明显 summary/compare/troubleshooting 信号词
3. 含多个限定条件或实体
4. 非最近重复 query

不在以下情况上开启：

1. 短 fact 问题
2. 明显文件名/ID/命令式直接查询
3. latency budget 已经偏高时
4. 当前 assistant profile 标记为低延迟优先

同时增加 retrieval profile 可选策略字段：

- `queryRewrite.mode`
  - `off`
  - `heuristic_only`
  - `always`
- `queryRewrite.maxAddedLatencyMs`

默认建议：

- 全局默认 `off`
- 仅在特定 profile 上开启 `heuristic_only`

#### 为什么这样更适合当前代码

- 现有 ask 链路已经有 rewrite 元数据和 strategy summary
- 现有 trace 已经能承接“开启了没、用了没、fallback 了没”
- 不需要引入新架构，只要扩展策略解析和 ask 主链路条件判断

#### 验证

- `pnpm test:api:fast:assistants`
- `pnpm test:api:fast:llm`
- 增加 ask orchestration test，验证 rewrite gating

### 5.5 引入 retrieval result cache，优先解决热点延迟

这是对当前代码最现实的性能优化之一。

#### 现状

- assistant 有 `ResultCache`
- embedding 有本地 cache
- 但 retrieval 结果本身没有面向 ask 的 query 级缓存

#### 建议改动

在 `AskAssistantService` 或 retrieval 层增加短 TTL retrieval cache：

缓存 key 建议至少包含：

- `assistantId`
- `kbId`
- `retrievalProfileId`
- `retrievalProfile.updatedAt` 或 version-like 指纹
- normalized query
- `documentVersions` hash

缓存 value：

- `retrievedChunks`
- `contextGroups`
- `execution`
- `embedding diagnostics`

TTL 建议：

- 默认 15 到 60 秒
- 先只缓存无 rewrite 的主路径

#### 预期收益

- 热门问题、多次重复追问、评测回放时延迟明显下降
- 减少 embedding 与向量检索重复开销

#### 风险

- 文档更新后的 cache 失效必须保守
- `documentVersions` 必须进 key，不能错答旧内容

#### 验证

- `pnpm test:api:fast:assistants`
- `pnpm test:api:fast:retrieval`
- 增加缓存命中/失效测试

### 5.6 结构化 chunking：中期质量收益最大

#### 现状

`apps/api/src/infra/parsing/chunking.service.ts` 当前策略是：

- heading paragraph
- oversized paragraph split
- sentence / line / hard split

这对普通 markdown 文本够用，但对半结构化内容还不够。

#### 建议改动

保持当前服务边界不变，只增强 chunk metadata 和切块规则：

1. 保留 heading path，而不只保留当前 `sectionTitle`
2. 对以下 block 单独处理：
   - 列表
   - 表格
   - FAQ 问答对
   - 代码块
   - 引用块
3. chunk metadata 增加：
   - `headingPath`
   - `blockType`
   - `listOrdinal`
   - `isTableLike`
4. retrieval 打分中对 blockType 做轻量加权
   - summary/list 问题提高列表和 heading 块权重
   - fact 问题提高短说明块、FAQ 块权重

#### 预期收益

- summary/list / FAQ 问题质量提升明显
- citation snippet 更容易准确
- 后续做 doc-level summary 也更容易

#### 风险

- 需要谨慎保持现有 chunk contract 兼容
- 需要同步更新 indexing / retrieval tests

#### 验证

- `pnpm test:api:fast:documents`
- `pnpm test:api:fast:retrieval`
- 增加 chunking + retrieval 联动测试

### 5.7 二阶段 rerank：优先用轻量实现，不直接引入重型模型

#### 现状

当前 rerank 是本地启发式：

- lexical boost
- exact phrase boost
- title boost

这能改善部分问题，但对复杂 query 的区分度有限。

#### 建议改动

分两步做：

第一步：

- 保留现有 rerank 作为 `local_heuristic`
- 扩展 strategyJson：
  - `rerank.mode = off | local_heuristic | llm_judge`

第二步：

- 只对 top 8 到 top 12 候选做可选 `llm_judge` rerank
- 仅用于：
  - summary/list
  - compare
  - troubleshooting
- fact 问题默认仍用 local heuristic

#### 为什么不建议一开始就全量引入更强 reranker

1. 当前最大痛点是延迟，不是没有任何排序能力
2. 二阶段 rerank 直接上强模型，主路径会更慢
3. 先把启用条件做窄，收益更符合当前阶段

#### 验证

- `pnpm test:api:fast:retrieval`
- `pnpm test:api:focus:llm-retrieval`
- eval 集按题型对比

### 5.8 收紧 citation 可信度，减少“看起来有引用但其实偏弱”的情况

#### 现状

当前 citation 允许：

- structured
- inline markers
- heuristic
- none

这对可用性友好，但会让“explicit grounding”和“系统兜底引用”混在一起。

#### 建议改动

1. 在默认用户路径里保留 heuristic citation，但在质量评估和 trace 里更显式降权。
2. 对 `qualityEvaluation` 增加一个更明确的信号：
   - `citationReliability = explicit | inferred | none`
3. 对报告和 trace 的默认 readout：
   - explicit 与 inferred 分开显示
4. 若 citationMode 为 `required` 且只有 heuristic citation：
   - `qualityOverall` 不应轻易维持 `strong`

#### 预期收益

- 用户看到的“有引用”更可信
- 质量治理报告更能区分回答问题是 retrieval 不足还是 citation 机制不足

## 6. 建议的实施顺序

建议按以下顺序推进，避免一次改太多高风险链路：

1. trace / timing / prompt context 指标补齐
2. retrieval result cache
3. lexical fallback 升级
4. summary/list 的 context packing 与主项覆盖优化
5. rewrite gating 改造，受控恢复
6. 结构化 chunking
7. 可选二阶段 rerank

这个顺序的好处是：

- 前三步先稳住性能和诊断能力
- 中间两步先提升最明显的质量痛点
- 后两步再进入更深的 retrieval 优化

## 7. 具体文件落点建议

### 核心后端文件

- `apps/api/src/modules/assistants/ask-assistant.service.ts`
  - rewrite gating
  - retrieval cache
  - trace metadata 扩展
- `apps/api/src/modules/retrieval/retrieval.service.ts`
  - lexical retrieval 升级
  - score / execution metadata 扩展
  - rerank mode 扩展
- `apps/api/src/modules/answering/answering.service.ts`
  - summary/list 覆盖优化
  - citation 可信度信号
- `apps/api/src/infra/llm/prompt-manager.service.ts`
  - summary/list prompt packing
- `apps/api/src/infra/parsing/chunking.service.ts`
  - 结构化 chunking
- `apps/api/src/modules/traces/traces.service.ts`
  - traceSummary 提升高频指标
- `apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts`
  - strategyJson 扩展

### 测试优先落点

- `apps/api/test/retrieval.test.js`
- `apps/api/test/answering.test.js`
- `apps/api/test/prompt-manager.test.js`
- `apps/api/test/chunking.test.js`
- `apps/api/test/ask-success.test.js`
- `apps/api/test/ask-stream-service.test.js`
- 如涉及缓存，新增 focused cache tests

## 8. 每阶段的最小验证建议

### 阶段一：trace / cache / lexical fallback

- `pnpm test:api:fast:retrieval`
- `pnpm test:api:fast:assistants`
- `pnpm test:api:fast:infra`

### 阶段二：summary/list 质量优化

- `pnpm test:api:file -- test/answering.test.js`
- `pnpm test:api:focus:llm-retrieval`

### 阶段三：chunking / rerank / rewrite gating

- `pnpm test:api:fast:documents`
- `pnpm test:api:fast:retrieval`
- `pnpm test:api:fast:llm`
- 必要时 `pnpm --filter @rag-system/api build`

## 9. 明确不建议现在做的事

1. 不建议立刻重新默认打开 rewrite。
2. 不建议为了 summary/list 直接全局继续增大 `topK` 和 `chunkWindow`。
3. 不建议现在把 retrieval 重构成全新多阶段平台。
4. 不建议在当前阶段把问题扩大成“多模型路由平台”。
5. 不建议把 observability / quality report 再扩成新的产品方向。

## 10. 一句话结论

当前最合理的方向不是“恢复旧 rewrite”或“继续堆更多 retrieval 开关”，而是先把不开 rewrite 时的主路径质量和延迟一起拉稳：优先补 trace 指标、上 retrieval cache、升级 lexical fallback、优化 summary/list 的 context packing；然后再把 rewrite 作为按条件触发的受控增强能力逐步恢复，而不是重新回到默认全量开启。
