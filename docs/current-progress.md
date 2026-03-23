# Current Progress

> 文档角色：`current-status`
> 当前使用方式：用于记录当前实现进度、已完成增量、未完成方向和验证快照；现阶段优先级判断以 `docs/next_steps_rag_project_plan.md` 为主。

更新时间：2026-03-23

> 当前说明：
> 现阶段任务方向、优先级判断、superpowers 使用方式、AI review 策略，以 `docs/next_steps_rag_project_plan.md` 为主。
> 本文档主要用于记录当前实现进度、已完成增量、未完成方向和验证快照。

补充进展（2026-03-23）：

- trace 读取接口现在会直接返回 additive `traceSummary`，把 `answerStatus`、`qualityOverall`、`primaryIssue`、`retrievalMode`、`generationMode`、`rewriteApplied`、`retrievedChunkCount`、`citationCount`、`usedFallback` 从持久化 trace JSON 中归一化提取出来
- 这样 `GET /traces/:id` 与 `GET /conversations/:id/traces` 不再要求上层自己拼接这几项执行结论
- answering / retrieval backend 收口继续推进中
- strong quality summary 现在也会单独区分 `required citation` 下由 backend heuristic 回填的引用路径，不再与普通 `retrieved without citations` 共用同一条文案
- 上述 heuristic-citation strong summary 现已补齐最小 `en` / `zh` 回归覆盖
- `fallback_generation + low_retrieval_score` 的 grounded partial 组合现在也已对齐 `primaryIssue` 优先级：主因继续锚定 `fallback_generation`，而不是被低检索分覆盖
- grounded fallback answer 在 `missing_information` 组合下的 `primaryIssue` 现在也继续锚定 `fallback_generation`，不再被信息缺口标记覆盖
- `POST /assistants/:id/ask` 的 deterministic no-hit `say_insufficient_context` 旁路结果现在已复用 answering 层统一结果构造，不再在 ask service 内手写英文 `missingInformation` / `qualityEvaluation.summary`
- 这使 one-shot no-hit deterministic answer 的 answer 文本、`missingInformation`、弱质量总结在 `en` / `zh` 下保持一致本地化语义
- one-shot no-hit deterministic bypass 现在也会在 assistant 未显式配置 `answerPolicyJson` 时生效，和 backend 默认 `noAnswerBehavior=say_insufficient_context` 语义保持一致
- `POST /assistants/:id/ask/stream` 的 deterministic no-hit 旁路现在也直接复用同一 centralized insufficient-context result shaping，不再先旁路 provider stream 再绕回 streamed finalization
- `best_effort` 的 no-hit ask-service 编排语义现已补齐回归覆盖：one-shot 仍走 answer generation，stream 仍走 streamed generation + finalization，不会误落到 deterministic insufficient-context bypass
- `insufficient_context` 且模型漏掉 `missingInformation` 时，backend 现在也会按 retrieval 实际命中情况区分默认理由：`no hits` 与 `hit but still insufficient` 不再共用同一条“没检索到来源”的默认文案
- 上述 hit-aware 默认 `missingInformation` 理由现已补齐中文回归覆盖，和已有的 `no-hit` 中英文分支一起构成最小 `en` / `zh` 闭环
- weak `insufficient_context` summary 现在也会在已有 `low_retrieval_score` flag 时显式带出“检索置信度偏低”，不再只停留在“上下文仍不足”的单因文案
- 上述 weak low-confidence insufficient-context summary 现已补齐中文回归覆盖，和英文分支保持一致
- 中文回归覆盖继续补齐到另一条弱 insufficient-context 组合路径：`hit but still insufficient` + `missing_information` + `low_retrieval_score`
- partial summary 的另一条双因路径 `missing_information + low_retrieval_score` 现也已补齐中文回归覆盖

## 1. 状态总览

### 当前结论

项目已经完成本地优先 RAG MVP 的主链路，当前可以稳定跑通：

- 文档上传
- 异步 ingestion
- chunking
- embedding
- indexing
- retrieval
- ask
- conversation / message / trace 持久化
- Web 核心页面联调

当前阶段已经不再是骨架或纯设计稿，适合继续按小步增量推进。

### 当前阶段判断

- 当前主线状态：`MVP 可运行 + 第一版可诊断 + 第一版可配置`
- 当前最适合继续推进的方向：
  - `PC Web chat experience polish` 这一轮收口已完成，可先视为 done
  - `external knowledge source expansion` 在当前限定范围内已完成 backend / API 收口
  - 下一步更适合切到新的 backend-first 增量，而不是继续在现有 source family 上重复补洞
  - 继续保持 `PC Web` 优先、移动端后置
- 当前本地执行约束：
  - 优先严格串行执行
  - 不并行跑重型测试或 build
  - 不把 AI review 和重型验证叠在一起

---

## 2. 第一版已完成

本节表示“已经落地并可用”，但不代表该方向已经 fully done。

### 2.1 工程与基础设施

- ✅ `pnpm` monorepo 已落地
- ✅ 仓库结构已拆分为：
  - `apps/api`
  - `apps/web`
  - `packages/shared`
  - `docs`
- ✅ PostgreSQL 已接入
- ✅ Redis 已接入
- ✅ Docker 本地开发基础设施已提供
- ✅ 本地开发文档已提供：
  - [README.md](/D:/FeProjects/rag-system/README.md)
  - [docs/current-dev-setup.md](/D:/FeProjects/rag-system/docs/current-dev-setup.md)
  - [docs/local-dev-infra.md](/D:/FeProjects/rag-system/docs/local-dev-infra.md)

### 2.2 后端骨架

- ✅ NestJS API 已初始化
- ✅ 全局异常过滤已接入
- ✅ 健康检查接口可用：`GET /health`
- ✅ 核心模块边界已建立：
  - `knowledge-bases`
  - `documents`
  - `assistants`
  - `retrieval-profiles`
  - `conversations`
  - `messages`
  - `traces`
  - `ingestion`
  - `indexing`
  - `retrieval`
  - `answering`
  - `infra/database`
  - `infra/storage`
  - `infra/queue`
  - `infra/llm`
  - `infra/vector-store`

### 2.3 数据库与默认数据

- ✅ Prisma schema 已建立
- ✅ migration 已建立
- ✅ seed 脚本已建立
- ✅ 默认数据已固定：
  - tenant: `default-tenant`
  - user: `default-user`
  - knowledge base: `default-kb`
  - retrieval profile: `default-retrieval-profile`
  - assistant: `default-assistant`

### 2.4 文档链路第一版

- ✅ 文档上传
- ✅ 原始文件本地存储
- ✅ 文档元数据入库
- ✅ Redis 队列异步处理
- ✅ Markdown 解析
- ✅ TXT 解析
- ✅ text-based PDF 解析
- ✅ chunking 第一版
  - 标题感知切分
  - 超长段落切分
  - 更稳定的 chunk 长度控制
- ✅ chunk 落库
- ✅ indexing 接入
- ✅ embedding 生成
- ✅ 本地 file-backed vector store 写入
- ✅ 文档状态流转：
  - `pending`
  - `processing`
  - `ready`
  - `failed`
- ✅ document run history 第一版
  - run 级持久化已覆盖 `upload` / `reindex` / `external_resync`
  - 当前每次 run 会记录：
    - `documentId`
    - `version`
    - `trigger`
    - `status`
    - `failedStage`
    - `diagnosticsJson`
    - `startedAt` / `finishedAt`
  - stale ingestion job 当前也会把旧 run 显式落为 `skipped`
- ✅ `reindex`

当前相关 API：

- ✅ `GET /knowledge-bases/:id/documents`
- ✅ `GET /knowledge-bases/:id/document-runs`
- ✅ `POST /knowledge-bases/:id/documents`
- ✅ `POST /knowledge-bases/:id/documents/upload`
- ✅ `GET /documents/:id`
- ✅ `GET /documents/:id/runs`
- ✅ `GET /documents/:id/chunks`
- ✅ `DELETE /documents/:id`
- ✅ `POST /documents/:id/reindex`

### 2.5 Retrieval 第一版

- ✅ 默认优先向量召回
- ✅ lexical fallback
- ✅ chunk window 扩展第一版
- ✅ hybrid retrieval 第一版
- ✅ rerank 第一版
- ✅ query rewrite 第一版
- ✅ RetrievalProfile metadata filter 第一版
  - `documentIds`
  - `sectionTitles`
  - `pageNumbers`
- ✅ retrieval score breakdown 持久化第一版
  - `score`
  - `vectorScore`
  - `lexicalScore`
  - `hybridScore`
  - `rerankScore`

### 2.6 Ask / Answering / Trace 第一版

- ✅ `assistant -> retrieval profile -> retrieval -> answering` 主链路打通
- ✅ conversation 持久化
- ✅ message 持久化
- ✅ trace 持久化
- ✅ citation-aware prompt 第一版
- ✅ citations 返回
- ✅ retrievedChunks 返回
- ✅ `AnswerTrace.rewrittenQuery` 持久化
- ✅ ask 失败诊断增强第一版
  - `ASK_PIPELINE_FAILED`
  - `traceId`
  - `details`
- ✅ 全局 HTTP exception filter 保留结构化错误字段

当前相关 API：

- ✅ `GET /assistants`
- ✅ `GET /assistants/:id`
- ✅ `PATCH /assistants/:id`
- ✅ `POST /assistants/:id/ask`
- ✅ `GET /retrieval-profiles`
- ✅ `GET /retrieval-profiles/:id`
- ✅ `POST /retrieval-profiles`
- ✅ `PATCH /retrieval-profiles/:id`
- ✅ `GET /conversations`
- ✅ `GET /conversations/:id`
- ✅ `GET /conversations/:id/messages`
- ✅ `GET /conversations/:id/traces`
- ✅ `GET /traces/:id`

### 2.7 LLM / Embedding 第一版

- ✅ Ollama 生成接入
- ✅ OpenAI 生成接入
- ✅ 本地 fallback answer
- ✅ Ollama embedding 接入
- ✅ OpenAI embedding 接入
- ✅ deterministic fallback embedding

### 2.8 Web MVP 第一版

- ✅ `Chat` 页面接真实 API
- ✅ `Documents` 页面接真实 API
- ✅ `Knowledge Base` 页面接真实 API
- ✅ `Assistant` 页面接真实 API
- ✅ Web i18n 第一版：`zh` / `en`
- ✅ App shell 语言切换器
- ✅ 文档详情页
- ✅ trace 详情页
- ✅ citation -> 文档 chunk 深链跳转
- ✅ 文档详情 trace 上下文高亮
- ✅ Documents / Chat 更清晰的 loading / empty / error 状态第一版
- ✅ Knowledge Base 页面运营概览增强第一版
- ✅ Assistant 页面已暴露 retrieval 基础配置字段：
  - `topK`
  - `chunkWindow`
  - `enableHybrid`
  - `enableRerank`
  - `scoreThreshold`

### 2.9 测试与验证第一版

- ✅ `pnpm typecheck`
- ✅ `pnpm build`
- ✅ `pnpm test:api`
- ✅ 最小 API 测试底座已建立
- ✅ 当前已覆盖：
  - PDF parsing
  - DOCX parsing
  - chunking
  - retrieval chunk window
  - hybrid retrieval
  - rerank
  - ingestion orchestrator
  - ask success orchestrator
  - citation-aware answering
  - ask failure diagnostics
  - retrieval profile filters
  - upload -> ready -> ask -> trace HTTP integration
  - document chunks / conversation messages / conversation traces integration assertions
- ✅ API integration tests 已支持 `QUEUE_PREFIX` 隔离，避免 Redis worker 串扰
- ✅ API 测试命令已串行执行，避免共享数据库状态的 HTTP 集成测试并发互相干扰
- ✅ web page source ingestion E2E
- ✅ feed source ingestion E2E
- ✅ sitemap source ingestion E2E
- ✅ sitemap index source ingestion E2E

---

## 3. 增强版未完成

本节表示“第一版已经有，但后续增强版还没做完”。

### 3.1 Retrieval 增强版未完成

- ✅ metadata filter 更完整的策略化能力
  - 已支持向后兼容的策略化过滤：
    - `documentIds.include` / `documentIds.exclude`
    - `sectionTitles.include` / `sectionTitles.exclude` / `sectionTitles.contains`
    - `pageNumbers.include` / `pageNumbers.exclude` / `pageNumbers.min` / `pageNumbers.max`
- ✅ chunk window 扩展后的更强拼接 / 组织策略
  - `ask` 响应现已新增 `contextGroups`
  - 连续且同文档的 window chunks 会按 `chunkIndex` 组织为 context group
  - group 当前返回：
    - `startChunkIndex` / `endChunkIndex`
    - `chunkIds` / `primaryChunkIds`
    - `mergedContent`
    - `pageNumbers` / `sectionTitles`
- ✅ 更系统的 retrieval 策略配置与演进能力
  - `RetrievalProfile.strategyJson` 已支持第一版系统化检索策略配置
  - 当前支持：
    - `queryRewrite.enabled`
    - `candidateSelection.mode`: `vector` / `hybrid` / `lexical`
    - `candidateSelection.candidateMultiplier`
    - `candidateSelection.minCandidates`
    - `hybrid.vectorWeight` / `hybrid.lexicalWeight`
    - `rerank.enabled`
  - 保持兼容既有 `enableHybrid` / `enableRerank` 平铺字段
  - `ask` 已按解析后的 retrieval strategy 决定是否 query rewrite
  - retrieval 已按策略控制候选池规模，以及 lexical / vector / hybrid 模式与 hybrid merge 权重

### 3.2 Answering 增强版未完成

- ✅ 更系统的 prompt 管理
  - 已新增 backend `PromptManagerService`
  - answer / rewrite prompt 已从 `LlmService` 内联字符串中抽离
  - 当前已支持版本化 prompt 标识：
    - `answer.v2`
    - `rewrite-query.v1`
  - Ollama / OpenAI 的 answer 与 rewrite 路径已统一经由 prompt manager 构造 prompt
- ✅ 输出结构约束
  - LLM structured answer JSON 已新增显式 schema 校验与标准化
  - 当前会约束并标准化：
    - `answer`
    - `status`
    - `citations`
    - `missingInformation`
  - `citations` 已支持 numeric string -> integer 归一化与去重
  - 非法 structured payload 仍会安全回退到 plain-text 解析路径
- ✅ 引用片段与答案的严格结构化对齐
- ✅ 回答质量评估
- ✅ 更完整的 assistant / answer policy 配置能力
- ✅ retrieval / answering execution metadata
  - ask 响应现已返回：
    - `retrievalMetadata`
    - `answeringMetadata`
  - `AnswerTrace` 现已持久化：
    - `retrievalMetadataJson`
    - `answeringMetadataJson`

### 3.3 Web 增强版未完成

- ✅ 更完整的 assistant / config 管理
  - RetrievalProfile `filtersJson` 前端编辑能力
  - 更完整的 answering / assistant policy 配置
- ✅ `PC Web` Chat 体验增强第一轮
  - NDJSON-based streamed ask rendering 第一轮
  - answer generation native text streaming 已升级完成
  - chat workspace UI / UX polish 第一轮
- ✅ 更多联调级自动化验证
- 当前客户端范围：`PC Web` 优先，移动端适配后置到功能和验证覆盖更稳定之后再推进

### 3.4 测试增强版未完成

- ✅ orchestrator / 模块集成测试
- ✅ 更完整的文档链 E2E
- ✅ 更完整的 ask 链路 E2E
- ✅ 前后端联调级自动化验证

### 3.5 Next Controlled Increment

- ✅ retrieval / answering systematic evolution
- [x] `PC Web` chat experience polish
  - NDJSON transport and progressive answer rendering: done
  - native answer-generation text streaming: done
  - chat workspace UI / UX polish: done
- [x] external knowledge source expansion
  - web page source ingestion minimum increment: done
  - feed source ingestion minimum increment: done
  - sitemap source ingestion minimum increment: done
  - sitemap index source ingestion minimum increment: done
  - backend / API consistency, recovery semantics, partial diagnostics, and run-summary coverage for the current source family are now closed in the current scope
- keep backend / API first
- keep `PC Web` as the current client priority
- do not expand mobile work yet

---

## 4. 仍未完整支持

- ✅ DOCX 支持
- ✅ 网页内容抓取 / 网页知识源接入
- ✅ 外部知识源接入第一轮最小增量

说明：

- 这里的 `[x]` 表示“外部知识源接入的第一轮最小可用能力已经落地”，不代表该方向已经整体完成
- 当前已完成的最小增量主要是：
  - one direct `http` / `https` web page source
  - one direct RSS / Atom feed source
  - one direct sitemap `urlset` source
  - one root sitemap `sitemapindex` source that expands child direct sitemaps
- 当前 source family 的 backend / API 收口已完成；后续如再继续外部知识源方向，应视为新的后续增量而不是当前这一轮未完成残项

---

## 5. 暂未开始且不属于当前主优先级

- [ ] 鉴权
- [ ] 用户登录
- [ ] 多租户隔离
- [ ] ACL / 文档权限
- [ ] 企业级审计与治理能力

---

## 6. 已过期旧状态

以下说法已经被后续实现推翻，仅保留作历史纠正：

- ~~hybrid retrieval 尚未实现~~
- ~~rerank 尚未实现~~
- ~~query rewrite 尚未实现~~
- ~~RetrievalProfile metadata filter 尚未实现~~
- ~~文档详情页尚未完成~~
- ~~trace 详情页尚未完成~~
- ~~Knowledge Base 页面只是最小占位摘要~~
- ~~ask 失败时只有原始异常信息~~

如果旧文档中仍出现这些表述，应以本文档当前内容为准。

---

## 7. 当前已知限制

- 当前向量存储仍是本地轻量 file-backed 实现
- ask 结果质量仍较依赖 chunk 切分质量
- embedding 模型选择和维度管理仍未完全配置化
- 未配置可用 embedding 模型时会退回 fallback embedding，语义召回上限有限
- 当前更适合本地开发和单用户验证
- 当前 worker 与 API 仍在同一进程模型下运行，后续可再拆分
- Web 构建目前有 bundle size warning，但不阻塞开发

---

## 8. 当前优先级

### 8.1 已完成优先级项

- ✅ 接入真实 embedding
- ✅ 落地第一版 vector store
- ✅ 打通 indexing -> retrieval 的真实向量链路
- ✅ RetrievalProfile metadata filter 第一版

### 8.2 当前推荐下一步

- [x] `PC Web` chat experience polish
  - chat streaming transport and native answer-generation streaming: done
  - workspace UI / UX polish and final收口: done
- [x] external knowledge source expansion
  - source stabilization phase 1: done
  - source run history / execution observability minimum increment: done
  - sitemap / sitemap-index partial-failure tolerance + structured partial diagnostics: done
  - feed partial invalid-entry tolerance + structured partial diagnostics: done
  - backend consistency / recovery / direct-failure coverage for the current source family: done
  - current completed backend consistency scope includes:
    - direct failed-document persistence for invalid `web page` / `feed` / `sitemap` inputs
    - same-URL recovery cleanup for retryable and non-retryable external-source failures
    - same-URL recovery cleanup for partial-ready diagnostics
    - latest-activity document ordering
    - run-history retention after recovery
    - run-summary cleanup after recovery
    - latest partial-failure summary selection for a document with older failed history
    - source-level partial diagnostics normalization for repeated `feed` / `sitemap` syncs
  - recommended next increment:
    - choose a new backend-first direction
    - do not reopen UI refactor
    - do not expand into a generic connector / source-center platform rewrite
- 后续自动推进时，默认继续保持严格串行执行，避免本地机器在验证阶段卡死

### 8.3 后续再往后

- ✅ 前后端联调级自动化验证
- ✅ 更完整的文档链 E2E
- ✅ 更完整的 ask 链路 E2E
- ✅ retrieval / answering 更系统化演进
- [ ] 外部知识源扩展
- [ ] 更细的移动端适配
- [ ] auth / 多租户 / ACL
- [ ] 企业能力

---

## 9. 最近完成的关键增量

### 2026-03-23

- ✅ no-hit one-shot deterministic bypass
  - `POST /assistants/:id/ask` 在 `no hits + say_insufficient_context` 时，现在也会直接跳过 answer generation
  - backend 会直接返回 deterministic insufficient-context answer，而不是先调用 provider / fallback answer generation 再在末尾覆盖文本
  - 这样 one-shot 和 stream 两条 deterministic no-answer 路径的执行语义已经对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/ask-success.test.js`
    - `node --test apps/api/test/ask-stream-service.test.js apps/api/test/answering.test.js`

- ✅ no-hit ask-stream deterministic bypass
  - `POST /assistants/:id/ask/stream` 在 `no hits + say_insufficient_context` 时，现在会直接跳过 provider streaming
  - backend 会直接发出 deterministic insufficient-context delta，并让最终 `final.answer` 复用同一文本
  - 这样 no-hit deterministic policy 不再先流出 provider / fallback 自由文本，再在 final payload 改写成另一版答案
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/ask-stream-service.test.js`
    - `node --test apps/api/test/ask-success.test.js apps/api/test/llm-answer-stream.test.js`

- ✅ quality-summary localization alignment
  - backend 生成的 deterministic `qualityEvaluation.summary` 现在也会按问题语言和 policy 做最小 `en` / `zh` 分流
  - 当前至少已对齐：
    - strong cited / retrieved summary
    - partial missing-information / low-retrieval-score / fallback-generation summary
    - weak no-hit / hit-but-insufficient summary
  - 这样中文场景下，`answer`、`missingInformation`、`qualityEvaluation.summary` 不再出现中英混杂
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`
    - `node --test apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ no-hit stream fallback answer alignment
  - native stream path 在 `no hits + say_insufficient_context` 时，fallback delta 文本现在和最终 `final.answer` 使用同一 deterministic insufficient-context reply
  - 这样流式渲染不再先显示一版 “couldn't find relevant information” 再在最终 payload 里切成另一版 backend fallback answer
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/llm-answer-stream.test.js`
    - `node --test apps/api/test/ask-stream-service.test.js apps/api/test/ask-success.test.js`

- ✅ heuristic-citation strong-summary alignment
  - 当 `citationMode=required` 且 backend 因模型未显式给 citation 而回填 heuristic citations 时，`qualityEvaluation.summary` 不再误称答案“grounded in cited sources”
  - 当前只有模型显式提供的 structured citations 或 inline markers 才会触发 cited-sources 强文案
  - 如果 citation 只是 backend 为兼容 required-citation 路径补出来的，strong summary 会回到 grounded in retrieved sources 的表述
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`
    - `node --test apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ insufficient-context missing-information localization alignment
  - `insufficient_context` 场景下，backend 补的 deterministic `missingInformation` reason 不再固定为英文
  - 当前无论是：
    - `AnsweringService` 在模型省略 `missingInformation` 时补值
    - `LlmService` zero-hit local fallback 直接产出的 `missingInformation`
  - 都会按问题语言和 policy 走同一套最小 `en` / `zh` 分流
  - 这样 answer 文本与结构化 `missingInformation` 字段在中文场景下不再语言错位
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js apps/api/test/llm.test.js`
    - `node --test apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ grounded fallback quality-evaluation alignment
  - 当回答仍然是 `grounded`，但 answer generation 实际走了本地 fallback 路径时，`qualityEvaluation` 不再继续给出 `strong`
  - 当前会降级为 `partial`，并暴露：
    - `primaryIssue: fallback_generation`
    - `flags: ["fallback_generation"]`
    - fallback-specific summary
  - 这样 `qualityEvaluation` 与既有的 `answeringMetadata.usedFallback` 语义保持一致，上层不必自行把执行路径再解释一遍
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`
    - `node --test apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ partial dual-cause quality summary alignment
  - 当 `missing_information` 和 `low_retrieval_score` 同时出现时，`qualityEvaluation.summary` 现在会合并表达两个风险点
  - 这样 partial 场景不再只暴露“信息缺失”而丢掉 retrieval confidence 偏低这一层信号
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ quality-evaluation primary-issue exposure
  - `qualityEvaluation` 现已新增 `primaryIssue`，用于给上层稳定表达当前质量评估的主因，而不必自行解释 `flags` 优先级
  - 当前已覆盖的主因包括：`none`、`no_retrieval_hits`、`insufficient_context`、`missing_information`、`low_retrieval_score`、`other`
  - one-shot answering、ask orchestration、stream final payload / trace 相关断言现已对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ weak insufficient-context summary alignment
  - `qualityEvaluation.summary` 现在会区分两类 weak answering 场景：
    - 完全没有 retrieval hits
    - 已有 retrieval context，但证据仍不足以支持回答
  - 这让 `insufficient_context` 的弱场景文案与实际 retrieval 执行结果保持一致
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ low-retrieval-score quality downgrade alignment
  - grounded answers 在 supporting context 的 top retrieval score 偏低时，`qualityEvaluation.overall` 现在会从 `strong` 降为 `partial`
  - 同时 summary 会明确指出是 retrieval confidence 偏低，而不是沿用泛化的缺失信息文案
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ optional-citation strong-summary wording alignment
  - optional-citation 下的 `strong` quality summary 现在不会再错误声称回答“grounded in cited sources”
  - 当回答没有 citation 但仍然 grounded / strong 时，summary 现会改为基于 retrieved sources 的表述
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ optional-citation quality evaluation alignment
  - `citationMode=optional` 的 grounded answers 现在不会再因为缺少 citation 被自动打上 `no_citations`
  - 当没有其他 gap 或 retrieval-risk 信号时，这类回答的 `qualityEvaluation` 现在可以保持 `strong`
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ answering metadata fallback-path exposure
  - `answeringMetadata` 现已显式返回 `usedFallback`，用于区分 provider-backed answer generation 和本地 fallback 路径
  - one-shot ask、native stream final payload，以及持久化 trace 中的 `answeringMetadataJson` 语义现已对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`
    - `node --test apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ answering metadata prompt-context count exposure
  - `answeringMetadata` 现在也会显式返回 `promptContextCount`，用于表示实际送进 answer generation 的上下文单元数
  - 该字段与 `contextMode` 对齐：
    - `chunks` 模式下等于 raw `inputChunkCount`
    - `context_groups` 模式下等于 merged context group 数，而不再需要上层自己从 `contextMode` 和 `contextGroupCount` 推断
  - one-shot、native stream final payload、以及持久化 trace 中的 `answeringMetadataJson` 语义现已一起补齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ answering citation-attribution metadata exposure
  - `answeringMetadata` 现在也会显式返回 `citationAttribution`，用于区分最终 citation 是 `explicit`、`heuristic` 还是 `none`
  - 这样上层不再需要从 `qualityEvaluation.summary` 或 grounded wording 间接反推 citation 来源
  - one-shot、native stream final payload、以及持久化 trace 中的 `answeringMetadataJson` 语义现已对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ answering missing-information count exposure
  - `answeringMetadata` 现在也会显式返回 `missingInformationCount`，用于表达最终响应里保留了多少条缺失信息项
  - 这样上层不再需要从 `missingInformation.length` 自己推导 metadata 统计，也能更直接地读 trace persistence
  - one-shot、native stream final payload、以及持久化 trace 中的 `answeringMetadataJson` 语义现已对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ answering resolved-language exposure
  - `answeringMetadata` 现在也会显式返回 `resolvedLanguage`，用于表达 backend 最终把 `auto` / `same_as_question` 解析成了哪种实际语言
  - 这样上层不再需要结合 policy 与问题文本自己推断当前回答链路到底按 `en` 还是 `zh` 落地
  - one-shot、native stream final payload、以及持久化 trace 中的 `answeringMetadataJson` 语义现已对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

  - ✅ answering generation-mode exposure
  - `answeringMetadata` 现在也会显式返回 `generationMode`，用于区分当前回答是正常走了 answer generation，还是在 no-hit `say_insufficient_context` 路径上直接走了 deterministic bypass
  - 当前值收口为 `generated` / `deterministic_bypass`，对应 one-shot 与 native stream 的最终 payload，以及 trace 持久化里的 `answeringMetadataJson`
    - 这样上层不再需要结合 `noAnswerBehavior`、retrieval hit 情况和 orchestration 逻辑，自己反推这一轮是否实际绕过了 provider generation
    - focused validation rerun:
      - `pnpm --filter @rag-system/api build`
      - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`
  - ✅ answering citation-truncation and gap-provenance exposure
    - `answeringMetadata` 现在也会显式返回 `citationCountBeforeLimit` 与 `citationLimitHit`，用于区分最终 citation 数量到底是天然较少，还是被 `maxCitations` 截断过
    - `answeringMetadata` 同时显式返回 `missingInformationSource`，当前值收口为 `none` / `model` / `deterministic_default` / `suppressed_by_policy`
    - 这样上层不再需要从 `maxCitations`、最终 citation 数量和 `missingInformation` 本体去反推 citation 截断或 advisory gap 的来源
    - one-shot、native stream final payload、以及 trace 持久化里的 `answeringMetadataJson` 语义现已对齐
    - focused validation rerun:
      - `pnpm --filter @rag-system/api build`
      - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`
  - ✅ answering answer-text-source and insufficient-context-reason exposure
    - `answeringMetadata` 现在也会显式返回 `answerTextSource`，当前值收口为 `model` / `deterministic_policy`
    - `answeringMetadata` 同时显式返回 `insufficientContextReason`，当前值收口为 `no_retrieval_hits` / `retrieved_context_insufficient` / `null`
    - 这样上层不再需要结合 `noAnswerBehavior`、最终 answer text、以及 retrieval hit 情况，自己反推这轮回答是否被 deterministic policy 覆盖，以及 `insufficient_context` 到底来自 no-hit 还是 hit-aware 证据不足
    - one-shot、native stream final payload、以及 trace 持久化里的 `answeringMetadataJson` 语义现已对齐
  - ✅ answering citation-source and status-source provenance
    - `answeringMetadata` 现在也会显式返回 `citationSelectionSource`，当前值收口为 `structured` / `inline_markers` / `heuristic` / `none`
    - `answeringMetadata` 同时显式返回 `answerStatusSource`，当前值收口为 `model` / `inferred_from_retrieval` / `deterministic_policy`
    - 这样上层不再需要自己判断 citation 是来自 structured output、plain-text marker 解析还是 heuristic backfill，也不需要再从结果形态反推 `answerStatus` 是模型明确给出的还是 backend 推断出来的
    - one-shot、native stream final payload、以及 trace 持久化里的 `answeringMetadataJson` 语义现已对齐
    - focused validation rerun:
      - `pnpm --filter @rag-system/api build`
      - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`
    - focused validation rerun:
      - `pnpm --filter @rag-system/api build`
      - `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ local grounded fallback answer language alignment
  - 当没有可用模型 provider、但 retrieval 已命中内容时，`LlmService` 本地 grounded fallback answer 不再固定使用英文前缀
  - 当前会按 `answerPolicy.language` 和问题文本做最小 `en` / `zh` 分流，让 hitful local fallback 与 no-hit local fallback 的语言策略保持一致
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/llm.test.js`

- ✅ local no-hit fallback answer language alignment
  - 当没有可用模型 provider 且 retrieval 命中为空时，`LlmService` 本地 fallback answer 不再固定返回英文
  - 当前会按 `answerPolicy.language` 和问题文本做最小 `en` / `zh` 分流，和已有 insufficient-context backend fallback 语言策略保持一致
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/llm.test.js`

- ✅ plain-text citation-marker dedup in answering fallback path
  - 当模型没有返回 structured citations、backend 退回到解析答案内联 marker（如 `[1][1][2]`）时，当前会按首次出现顺序去重同一 source
  - 这样最终 citation 列表和 `answeringMetadata.citationCount` 不再因为重复 marker 被虚增
  - 当前改动只收在 answering backend fallback normalization，不改 API shape
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ retrieval execution metadata actual-path exposure
  - `ask` / trace retrieval metadata `execution` 现在除了 query、threshold 和 chunk counts 之外，也会显式暴露：
      - `actualMode`: `vector` / `hybrid` / `lexical`
      - `usedFallback`: 当前结果是否是从请求的向量路径回退得到
      - `fallbackReason`: 当前 lexical fallback 是由向量错误触发，还是因为没有留下可排序候选
      - `rerankApplied`: 当前结果是否按 rerank 路径完成最终排序
      - `chunkWindowApplied`: 当前结果是否实际走过 chunk-window 扩展
      - `vectorCandidateLimitHit` / `lexicalCandidateLimitHit`: 当前向量/词法候选是否打满了 candidate budget
      - `rankingTopKHit`: 当前 ranking 结果是否打满了最终 `topK` 上限
      - `candidateLimit`: 当前 candidate-selection 策略最终解析出的候选预算
      - `vectorCandidateCount` / `lexicalCandidateCount`: merge 之前各自拿到了多少候选
      - `mergedCandidateCount`: hybrid merge 或 lexical fallback 之后还保留了多少候选
    - `rankedCandidateCount`: threshold + ranking 之后、chunk-window 扩展之前剩余多少候选
    - `neighborChunkCount`: 最终返回 chunk 里，有多少是 chunk-window 扩展出来的邻接块，而不是 direct primary hit
  - 这样当前 retrieval metadata 不再只表达“想要的策略”，也能表达“最终实际走到的检索路径”
  - 当前改动保持 API 向后兼容，只是在既有 `retrievalMetadata.execution` 里增加字段
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/retrieval.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ retrieval rewrite-source and search-attempt diagnostics
  - `retrievalMetadata.queryRewrite` 现在也会显式返回 `finalQuerySource`，当前值收口为 `rewritten` / `original_disabled` / `original_unchanged`
  - `retrievalMetadata.execution` 现在也会显式返回 `vectorSearchAttempted` / `lexicalSearchAttempted`
  - 这样上层不再需要从最终 query、strategy mode 和 fallback 状态自己反推“原问题为什么被保留”以及“这一轮实际尝试过哪些检索路径”
  - one-shot ask、native stream final payload、以及 trace persistence 里的 retrieval metadata 语义现已对齐
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/retrieval.test.js apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js`

- ✅ structured missing-information normalization dedup
  - LLM structured-answer schema 现在会对 `missingInformation` 做和 `citations` / `citationEvidence` 一致的收口：trim、去空、按首次出现顺序去重
  - 这避免模型输出重复 gap item 时把同一缺失原因在最终响应里重复展开
  - 当前变更只在 backend structured-answer normalization 层收口，不改 API shape
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/llm.test.js`

- ✅ answering missing-information normalization for insufficient-context
  - `includeMissingInformation=false` 当前只对 grounded 回答继续生效，不再把 `insufficient_context` 场景的缺失原因一并清空
  - 当最终回答是 `insufficient_context` 时，backend 现在会优先保留模型返回的 `missingInformation`
  - 如果模型没有提供缺失原因，backend 会补一个稳定默认值：`No relevant supporting sources were retrieved.`
  - 这样当前响应里的 `missingInformation`、`qualityEvaluation.flags` 与 `answerStatus=insufficient_context` 语义保持一致
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ retrieval no-hit fallback tightening
  - retrieval 在 vector 不可用时仍会回退 lexical scoring，但当前不会再在“所有候选都低于阈值”时额外塞入 knowledge base 的前几个任意 chunk
  - backend 现在会在这种 no-hit 情况下直接返回空 retrieval result，让 answering 走既有 `insufficient_context` 语义，而不是基于无关 chunk 做低质量 best-effort 猜测
  - 这一轮保持在 retrieval backend 内部收口，没有改 API shape、前端承载或 retrieval profile 配置结构
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/retrieval.test.js`

- ✅ answering no-answer policy backend enforcement
  - `answerPolicyJson.noAnswerBehavior` 不再只是 prompt-level 软约束，当前 backend 已在 `AnsweringService` 收口成确定性语义
  - 当最终 `answerStatus=insufficient_context` 且策略为 `say_insufficient_context` 时，backend 会用统一兜底文案替换模型自由文本，避免不足上下文时把猜测性回答直接透出
  - 当前兜底文案已支持最小语言分流：
    - `language=en` -> 英文固定回复
    - `language=zh` -> 中文固定回复
    - `language=auto` / `same_as_question` -> 按问题文本做最小中英文检测
  - 当策略为 `best_effort` 时，backend 继续保留模型返回的原始回答文本，仅通过现有 `answerStatus` / `missingInformation` / `qualityEvaluation` 表达不确定性
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/answering.test.js`

- ✅ external knowledge source expansion backend / API consistency closeout
  - current scoped source family:
    - `web page`
    - `feed`
    - `sitemap`
    - `sitemap index`
  - this closeout round stayed strictly inside backend / API validation and did not reopen:
    - UI refactor
    - mobile work
    - source center / connector platformization
  - newly locked focused gaps in this round:
    - unsupported `web page` failure now has explicit same-URL recovery coverage
    - all-invalid `feed` failure now has explicit same-URL recovery coverage
    - all-unsupported `sitemap` failure now has both direct-failure and same-URL recovery coverage
    - run-summary selection now explicitly prefers a newer partial-ready run over the same document's older terminal failure
    - repeated `feed` / `sitemap` sync unit tests now explicitly assert normalized `EXTERNAL_SOURCE_PARTIAL_SUCCESS` diagnostics with the new reserved version
  - focused validation rerun during this round:
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`
    - `node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js`
    - `node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js`
    - `node --test apps/api/test/document-runs-summary.test.js`
    - `node --test apps/api/test/external-source-sync.test.js`
  - full API regression rerun after closeout:
    - `pnpm test:api`
  - current result:
    - `116 / 116` API tests passed
    - the current external knowledge source expansion round can now be treated as backend / API complete within the present scope

### 2026-03-22

- ✅ external source reindex / resync chunk-count consistency follow-up
  - when an existing `web page` / `feed` / `sitemap` document is reused for a new `external_resync` version, the document now clears `chunkCount` immediately on the pending transition instead of temporarily exposing the previous ready-version count
  - this keeps document-level reindex state consistent with the existing upload-document `reindex` path without adding new API fields or opening a new source-management surface
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js`
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`

- ✅ external source reindex invalid-config failure normalization
  - when a persisted external source document no longer has a valid `sourceConfigJson`, `POST /documents/:id/reindex` no longer fails before run creation
  - the backend now queues a new `external_resync` version first, then records a structured non-retryable failure on both the document and run using the existing diagnostics path
  - this keeps document/run history consistent for corrupted or legacy external-source records without adding new API fields or expanding source-platform scope
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js`

- ✅ document-run summary latest-anchor ordering normalization
  - `latestFailure`, `latestRetryableFailure`, and `latestSkipped` are now selected by the latest matching completed run timestamp instead of the latest started run order
  - this closes an overlap edge case where a later-started but earlier-finished run could incorrectly replace the actual latest completed failure/skip anchor in summary
  - the change stays inside `DocumentRunsService` summary selection logic and does not alter list ordering, counters, or API shape
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/document-runs-summary.test.js`
    - `node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js`

- ✅ document-run list ordering alignment
  - `GET /documents/:id/runs` now uses the same primary ordering contract as `GET /knowledge-bases/:id/document-runs`: newest `startedAt` first, then higher `version` only as a tie-breaker
  - this removes a small inconsistency where document-level run history previously prioritized `version` ahead of actual run recency
  - the change stays inside `DocumentRunsService` query ordering and does not alter payload shape, filtering, or summary semantics
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/document-runs-summary.test.js`
    - `node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js`

- ✅ external source title preservation on title-less resync
  - when a repeated external-source `reindex` does not return a new source-level title, the backend now keeps the current document `title` instead of replacing it with the normalized URL fallback
  - this is especially relevant for `sitemap` sources, whose re-sync path may not have a source title to refresh from
  - the change stays inside `DocumentsService` title fallback logic and does not add new fields or expand API shape
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js`
    - `node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js`

- ✅ run-summary recovery semantics for external sources
  - when the same external-source document first fails and then later finishes a clean resync, `GET /knowledge-bases/:id/document-runs/summary` no longer keeps counting or anchoring that older failure for the recovered document
  - `GET /knowledge-bases/:id/documents`, `GET /documents/:id`, and `GET /documents/:id/runs` remain unchanged, so history is still available while the aggregate summary now aligns with the recovered current state
  - the change stays inside `DocumentRunsService` summary selection logic and does not add fields or alter run list/detail payloads
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/document-runs-summary.test.js`
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`

- ✅ latest-skipped summary anchor preservation
  - summary recovery cleanup now applies only to failure-style anchors and counters; `latestSkipped` still reports the most recent skipped run event from matching history even if the same document later completes successfully
  - this keeps skipped-run observability aligned with run-history semantics while preserving the new recovered-failure cleanup behavior
  - focused validation rerun:
    - `node --test apps/api/test/document-runs-summary.test.js`

- ✅ external source title preservation on repeated same-URL reuse
  - when posting the same `web page` / `feed` / `sitemap` URL again and the backend reuses the existing document record, the existing document `title` is now preserved whenever the refreshed source still does not provide a new source-level title
  - this keeps same-URL create/reuse behavior aligned with the new title-less `reindex` / `external_resync` semantics and avoids replacing curated titles with normalized URL fallbacks during pending-state reuse
  - the change stays inside `DocumentsService` reserve/finalize title fallback logic and does not add new fields or expand API shape
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js`
    - `node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js`

- ✅ PC Web source run observability consumption minimum increment
  - current implementation stays inside the existing `Knowledge Base` and `Document Detail` pages instead of opening a new source center or a broader UI refactor
  - `Knowledge Base` now minimally consumes:
    - `GET /knowledge-bases/:id/document-runs`
    - `GET /knowledge-bases/:id/document-runs/summary`
  - it currently surfaces:
    - recent source/document runs
    - a compact recent-run summary
    - latest failure context
  - `Document Detail` now minimally consumes:
    - `GET /documents/:id/runs`
  - it currently surfaces:
    - document-level run history
    - status / trigger / startedAt / finishedAt / failedStage
    - latest failure message and minimal diagnostics expansion
  - this increment deliberately avoids:
    - new backend fields
    - a new mobile path
    - broader UI restructuring
    - platform-style source center abstraction
  - shared web path additions for this round:
    - typed run observability API models
    - shared run observability hooks
    - shared run list / diagnostics helper component
  - focused validation rerun:
    - `node --experimental-strip-types --test apps/web/test/document-run-observability.test.js`
    - `node --test apps/web/test/ui-review-regressions.test.js`
    - `pnpm --filter @rag-system/web typecheck`
    - `pnpm --filter @rag-system/web build`

- ✅ PC Web source run observability actionability follow-up
  - `Knowledge Base` recent runs now add a minimal status filter with the existing list endpoint instead of introducing a new source console
  - latest failure context now deep-links directly to the related document detail page
  - recent run cards now also deep-link to the corresponding document when a document summary is present
  - failed / skipped recent runs now expose a one-item `Reindex` action that reuses the existing `POST /documents/:id/reindex` path
  - this follow-up remains inside the current web consumer layer and does not add new backend fields, batch controls, or broader platform workflows
  - focused validation rerun:
    - `node --experimental-strip-types --test apps/web/test/document-run-observability.test.js`
    - `node --test apps/web/test/ui-review-regressions.test.js`
    - `pnpm --filter @rag-system/web typecheck`
    - `pnpm --filter @rag-system/web build`

- ✅ feed source stabilization phase 2 minimum increment
  - feed extraction now tolerates bounded partial invalid-entry failures instead of always including every selected entry verbatim
  - success rule for this round:
    - at least one selected entry is usable -> generated text artifact is still produced and ingestion continues
    - all selected entries are invalid -> source remains failed at `source_fetch`
  - current invalid-entry rule is intentionally minimal:
    - entry missing both `summary` and `link` is skipped as invalid
  - partial success now persists structured diagnostics in the existing shared external-source path instead of opening a feed-specific platform branch
  - current feed partial diagnostics payload includes:
    - `attemptedEntryCount`
    - `succeededEntryCount`
    - `failedEntryCount`
    - capped `failedEntryRefs`
    - capped `failedEntries` reason summaries (`ref` + `code` + `message` + `retryable`)
    - truncation metadata:
      - `failedEntriesTruncated`
      - `failedEntriesOmittedCount`
    - `partial: true`
  - document `diagnosticsJson` and final ready run diagnostics now preserve the same feed partial context through ingestion completion
  - this increment stayed inside `FeedSourceService` plus the existing shared `DocumentsService` / `IngestionService` persistence path and did not expand into broader source platformization
  - focused validation rerun:
    - `apps/api/node_modules/.bin/tsc.CMD -p apps/api/tsconfig.json`
    - `node --test apps/api/test/parsing.test.js apps/api/test/feed-source-e2e.test.js`
    - `node --test apps/api/test/sitemap-source-e2e.test.js apps/api/test/external-source-sync.test.js apps/api/test/ingestion.orchestrator.test.js`

- ✅ sitemap / sitemap-index source stabilization phase 2 minimum increment
  - sitemap page aggregation no longer fails the whole source on the first single page fetch error
  - current behavior now tolerates bounded partial page failures for both direct sitemap `urlset` and one-level `sitemapindex`
  - success rule for this round:
    - at least one page fetch succeeds -> generated text artifact is still produced and ingestion continues
    - all page fetches fail -> source remains failed at `source_fetch`
    - for `sitemapindex`, at least one child sitemap fetch succeeds -> expansion can still continue
    - for `sitemapindex`, all child sitemap fetches fail -> source remains failed at `source_fetch`
  - partial success now persists structured diagnostics in the existing shared paths instead of opening a new source platform abstraction
  - current partial diagnostics payload includes:
    - `attemptedPageCount`
    - `succeededPageCount`
    - `failedPageCount`
    - capped `failedPageUrls`
    - capped `failedPages` reason summaries (`url` + `code` + `message` + `retryable`)
    - truncation metadata for page summaries:
      - `failedPagesTruncated`
      - `failedPagesOmittedCount`
    - `partial: true`
    - and for partial child sitemap expansion:
      - `attemptedChildSitemapCount`
      - `succeededChildSitemapCount`
      - `failedChildSitemapCount`
      - capped `failedChildSitemapUrls`
      - capped `failedChildSitemaps` reason summaries (`url` + `code` + `message` + `retryable`)
      - truncation metadata for child sitemap summaries:
        - `failedChildSitemapsTruncated`
        - `failedChildSitemapsOmittedCount`
  - document `diagnosticsJson` now preserves this partial source-fetch context through ingestion completion, so `GET /documents/:id` can still expose it after the document reaches `ready`
  - document run history now also preserves the same partial diagnostics on the final `ready` run, so `GET /documents/:id/runs` and `GET /knowledge-bases/:id/document-runs?includeDiagnostics=true` can surface it without adding new list/summary fields
  - this increment stayed inside the existing shared `SitemapSourceService` + `DocumentsService` + `IngestionService` path and did not expand into connector/source platformization
  - focused validation rerun:
    - `apps/api/node_modules/.bin/tsc.CMD -p apps/api/tsconfig.json`
    - `docker compose up -d`
    - `node --test apps/api/test/parsing.test.js apps/api/test/sitemap-source-e2e.test.js`
    - `node --test apps/api/test/external-source-sync.test.js apps/api/test/ingestion.orchestrator.test.js`

- ✅ document ingestion / external source run-level persistence 第一轮
  - 新增 `DocumentRun` 持久化模型，用于记录每次 `upload` / `reindex` / `external_resync`
  - 当前每条 run 至少记录：
    - `documentId`
    - `version`
    - `trigger`
    - `status`
    - `failedStage`
    - `diagnosticsJson`
    - `startedAt`
    - `finishedAt`
  - `GET /documents/:id/runs` 已可读取某个 document 的 run history，按最新 `version` 优先返回
  - external source create / repeat-run / reindex 现在都会先建立对应 run，再进入 remote fetch 或 ingestion
  - source fetch 失败不再只停留在 document failure；对应 run 也会落为 `failed` 并保留 `source_fetch` diagnostics
  - ingestion worker 进入 `processing` 后会同步更新 run 状态；成功会落为 `ready`
  - stale ingestion guard 现在不只跳过旧 job，也会把被新版本覆盖的旧 run 明确标成 `skipped`
  - 这次改动继续收口在 `DocumentsService` + `IngestionService` 的共享路径，没有扩成更大的 source / connector 平台重构
  - 新增/补强的 focused 测试：
    - `apps/api/test/document-chain-e2e.test.js`
    - `apps/api/test/external-source-sync.test.js`
    - `apps/api/test/ingestion.orchestrator.test.js`
  - focused validation rerun:
    - `pnpm --filter @rag-system/api exec prisma generate`
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js apps/api/test/ingestion.orchestrator.test.js`
    - `pnpm --filter @rag-system/api exec prisma migrate deploy`
    - `node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js`
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`

- ✅ knowledge-base scoped document run observability 第一轮
  - 新增 `GET /knowledge-bases/:id/document-runs`，用于直接查看某个 knowledge base 最近的 document / source 执行历史
  - 当前返回 run 基本字段外，还会附带一个最小 `document` 摘要，便于在不额外查 document 列表的情况下定位来源和当前状态
  - 当前已支持最小查询过滤：
    - `documentId`
    - `sourceType`
    - `status`
    - `trigger`
    - `sinceHours`
    - `includeDiagnostics`
    - `limit`
  - `document-runs` list 当前默认不返回 `diagnosticsJson`，仅在 `includeDiagnostics=true` 时带回完整诊断 JSON，以降低列表载荷
  - 这个接口当前优先服务 backend/API 级诊断与后续 UI 承载，但本轮没有继续开启新的 UI 重构
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js apps/api/test/web-page-source-e2e.test.js`

- ✅ knowledge-base scoped document run summary 第一轮
  - 新增 `GET /knowledge-bases/:id/document-runs/summary`
  - 当前 summary 聚合输出：
    - `totalRuns`
    - `latestRunAt`
    - `latestFinishedAt`
    - `byStatus`
    - `byTrigger`
    - `bySourceType`
    - `retryableFailures`
    - `nonRetryableFailures`
    - `failureByStage`
    - `latestRetryableFailure`
    - `latestSkipped`
    - `latestFailure`
  - `document-runs` list 现在默认也会给出轻量 `failureSummary`，不必强制打开 `includeDiagnostics=true` 才能消费最小失败上下文
  - `latestRetryableFailure` / `latestSkipped` / `latestFailure` 现在复用同一套 `failureSummary` 归一形状：
    - `code`
    - `failedStage`
    - `retryable`
    - `message`
  - `document-runs` list 和 `document-runs/summary` 现在都支持 `sinceHours`，便于聚焦最近一段时间的运行情况
  - 目标是先为后续 diagnostics 承载和潜在 UI 概览提供轻量后端聚合面，而不是继续扩 source platform 抽象
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js apps/api/test/web-page-source-e2e.test.js`

### 2026-03-22

- ✅ document run failure summary consistency minimum increment
  - 当前收口范围保持在 backend / API first，没有开启新一轮 UI 扩展，也没有引入新的 source platform 抽象
  - `GET /knowledge-bases/:id/document-runs` 现在默认返回轻量 `failureSummary`，用于 failed / skipped / partial-ready run 的最小失败上下文消费
  - `GET /documents/:id/runs` 也同步暴露同一 `failureSummary` 归一结果，避免 document-detail 与 knowledge-base recent-runs 走两套提取规则
  - `GET /knowledge-bases/:id/document-runs/summary` 的 `latestFailure` / `latestRetryableFailure` / `latestSkipped` 现在复用同一 failure summary builder，而不是各自单独抽 message
  - 对 partial-ready run，顶层 `failedStage` 现在也统一回落到 `failureSummary.failedStage`，避免 API 消费端看到 `failedStage: null` 与 summary diagnostics 同时存在的双重语义
  - summary failure stats 现在也会把 `ready + partial failureSummary` 的 run 纳入统计，而不是只看 terminal `failed`
  - `latestFailure` 现在语义上表示“最近一个 counted failure summary run”，因此可以正确指向更近的 partial-ready external source run
  - `latestSkipped` 仍保持独立语义，不混入 failure counters
  - 后续又补了一个 processing-state 语义修正：
    - `pending` / `processing` run 即使暂时携带 preserved partial diagnostics，也不会计入 summary failure counters
    - 此类 in-flight run 的顶层 `failedStage` 继续保持 `null`
  - 这一轮保持最小字段增量：
    - 不改既有路由
    - 不改既有过滤参数
    - 不把完整 `diagnosticsJson` 改成默认大 payload
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/document-runs-summary.test.js`
    - `node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js`
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`
    - `node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js`

- ✅ external source repeat-run dedup / re-sync 第一轮
  - `web page` / `feed` / `sitemap` 入口现在会先对 remote URL 做归一化（去掉 hash，并使用标准化 URL 字符串）
  - 同一 `knowledge base + sourceType + normalized URL` 再次 ingestion 时，不再创建重复 `Document`
  - 当前改为复用原有 document 记录，更新生成的 source artifact，重置状态并递增 `version` 后重新进入 ingestion
  - 这次改动优先收口在 `DocumentsService` 的 external source 共用边界，避免只对单一 source 类型打补丁
  - ingestion queue 现在会携带期望的 document `version`；当旧 job 落后于当前 document version 时，worker 会在解析前直接跳过，避免旧运行覆盖新一轮 `reindex` / `re-sync`
  - document 失败态现在会额外持久化结构化 `diagnosticsJson`，当前包含：
    - `code`
    - `failedStage`
    - `retryable`
    - `documentVersion`
    - `message`
  - ingestion worker 现在会真实经过 `parsing -> chunking -> indexing -> completed`，失败时会把失败边界落到 `diagnosticsJson.failedStage`
  - external source 抓取边界现在增加共享 HTTP retry guard；当上游首次返回 `429` 或 `5xx` 时，会自动再试一次，再决定是否失败
  - external source 创建现在会先保留一个 document 记录；如果远端 source fetch 自身失败，document 也会落为 `failed` 并保留 source-fetch diagnostics，而不是这次失败完全无记录
  - document 现在会持久化 `sourceConfigJson`；对 `web_page` / `feed` / `sitemap` 执行 `reindex` 时，后端会按原始 source config 重新抓取远端内容，再进入 ingestion，而不再只是重跑旧的 generated artifact
  - 新增共用回归测试：
    - `apps/api/test/external-source-sync.test.js`
    - `apps/api/test/fetch-with-retry.test.js`
  - 新增 focused HTTP E2E：
    - `apps/api/test/web-page-source-e2e.test.js`
    - `apps/api/test/document-chain-e2e.test.js`
    - `apps/api/test/ingestion.orchestrator.test.js`
    - `apps/api/test/feed-source-e2e.test.js`
    - `apps/api/test/sitemap-source-e2e.test.js`
  - focused validation rerun:
    - `pnpm --filter @rag-system/api exec prisma migrate deploy`
    - `pnpm --filter @rag-system/api exec prisma generate`
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js`
    - `node --test apps/api/test/fetch-with-retry.test.js`
    - `node --test apps/api/test/ingestion.orchestrator.test.js`
    - `node --test --test-concurrency=1 apps/api/test/document-chain-e2e.test.js`
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`

- ✅ external source fetch retryability diagnostics correction
  - external source `source_fetch` diagnostics no longer overstate retryability
  - current behavior now distinguishes:
    - upstream / transient fetch failures -> `retryable: true`
    - invalid payload / unsupported content-type style failures -> `retryable: false`
  - this keeps source run summary and failure diagnostics aligned with the real execution boundary instead of treating all source-fetch errors as retryable
  - focused validation rerun:
    - `pnpm --filter @rag-system/api build`
    - `node --test apps/api/test/external-source-sync.test.js`
    - `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`

- ✅ UI 审查问题第一轮收口
  - 基于 `ui/审查报告.md` 对当前 `PC Web` 做第一轮 focused cleanup
  - `AppShell` 顶栏中的搜索 / 通知 / 当前知识库展示降级为非误导性的展示控件，减少假交互
  - `Chat` 去掉右栏伪 tab，补充输入区真实说明，并把附件入口明确降级为 `coming soon`
  - `Knowledge Base` 改为更紧凑的指标网格，避免右侧长指标列导致主区空洞
  - `Assistant` 清理开发态说明文案，继续保持现有表单字段和提交逻辑不变
  - `Trace Detail` 将 `raw payload` 降级为折叠式次级诊断区
  - `index.html` 补充 favicon，消除本地巡检时的 404 噪音
  - 新增 focused source-level 回归测试：
    - `apps/web/test/ui-review-regressions.test.js`
  - focused validation rerun:
    - `node --test apps/web/test/ui-review-regressions.test.js`
    - `node --experimental-strip-types --test apps/web/test/chat-layout-source.test.js`
    - `node --test apps/web/test/desktop-shell-consistency.test.js`
    - `node --experimental-strip-types --test apps/web/test/knowledge-base-page-helpers.test.js`
    - `node --experimental-strip-types --test apps/web/test/assistant-config.test.js`
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题 Documents / Knowledge Base / Assistant / Trace 第四轮骨架收口
  - `Documents` hero 改成更接近参考稿的左右分区式工作台头部，loading/empty panel 密度继续压缩
  - `Document Detail` 改成更稳定的工作台双栏骨架，左侧状态区 sticky，chunk focus banner 和列表间距继续统一
  - `Knowledge Base` 和 `Assistant` 都改为更一致的 hero + 主副栏布局，输入控件 hover/focus 继续收口到统一 B 主题语言
  - `Trace List` / `Trace Detail` 的 hero、列表卡片、metadata 和 empty/loading 状态继续向 `ui/version-b-creative.html` 收口
  - 仅调整前端 UI 结构和样式，不改接口、字段、路由和现有功能逻辑
  - 本轮新增 Playwright 截图留档：
    - `output/playwright/ui-audit-pass-6/`
  - focused validation rerun:
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题主副栏比例 + 本地巡检兼容继续收口
  - `Knowledge Base` / `Assistant` 主工作区改回更合理的宽主栏 + 窄侧栏比例，避免关键内容被压窄
  - `Trace List` 在仅一条会话记录时改为单列铺满，避免左窄右空的骨架浪费
  - 前端 API base url 增加本地 hostname 归一逻辑，便于本地巡检时在 `localhost` / `127.0.0.1` 之间切换
  - 新增基于 Playwright 路由拦截的真实数据快照巡检，便于继续比对 detail 页实际信息密度
  - 本轮新增 Playwright 截图留档：
    - `output/playwright/ui-audit-pass-7d/`
    - `output/playwright/ui-audit-pass-8/`
  - focused validation rerun:
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题前端巡检稳定性补丁
  - 修复 `apps/web/index.html` 首屏主题脚本在 `body` 尚未可用时访问 `style` 导致的浏览器运行时异常
  - `Trace List` 单条记录时继续收紧最大宽度，避免单卡片模式下占满整行后过于松散
  - 本轮新增 Playwright 截图留档：
    - `output/playwright/ui-audit-pass-8b/`
  - focused validation rerun:
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题 Documents + Trace 第三轮细节收口
  - `Documents` hero 改为更接近 `ui/version-b-creative.html` 的深色发光工作台头部
  - `Documents` 表格外层、badge、行 hover、storage 文本截断和操作区层级继续收口
  - `Document Detail` 左侧状态面板改为更稳定的 metadata list，chunk 卡片改为更清晰的内容块 + focused 态
  - `Trace List` 改为更适合工作台的双列卡片流，保留原有 conversation -> latest trace 聚合逻辑
  - `Trace Detail` 的 hero、metadata、retrieved chunks、citations、raw payload 面板继续统一到 B 主题 surface
  - 保持现有接口、数据字段、路由和列表 -> 详情流转不变
  - focused validation rerun:
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题壳层偏移 + Chat 骨架第三轮收口
  - 修复 `AppShell.Main` 未正确避开 header / sidebar 的壳层偏移问题，主内容不再钻到壳层下方
  - `Chat` 主区从 Mantine `Grid` 改为显式 CSS grid，稳定为更接近参考稿的三栏工作台骨架
  - 收紧聊天页 hero、会话栏、主工作区、引用栏、输入区的宽度关系与面板高度
  - 补充聊天布局和通用空状态的 source-level 回归测试，避免后续再次偏离参考稿或回到浅色空状态
  - 使用 Playwright 对 `Chat` 以及其他核心路由重新截图复查
  - focused validation rerun:
    - `node --test apps/web/test/chat-layout-source.test.js apps/web/test/state-panel-theme.test.js`
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题 Chat 收尾第二轮
  - `AppShell` 左侧品牌区与导航项的内边距、字号、hover 强度继续向 `ui/version-b-creative.html` 收口
  - `Chat` 页消息气泡、底部输入栏、右侧引用栏的圆角、边框、层级与 spacing 继续向 B 主题 token 收口
  - 保持既有 API、流式逻辑、数据结构与 badge 数据来源不变
  - focused validation rerun:
    - `pnpm --filter @rag-system/web build`

- ✅ Trace 路由恢复为列表 -> 详情
  - `Trace 日志` 左侧导航不再落到 404
  - Web 端新增 `/traces` 列表页，复用现有 conversations + conversation traces 接口做前端聚合
  - `/traces/:traceId` 继续保留详情页
  - focused validation rerun:
    - `node --test apps/web/test/trace-router.test.js`
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题工作台跨页面第二轮统一
  - `Documents` / `Document Detail` / `Knowledge Base` / `Assistant` / `Trace` 页面头部 hero 与 panel surface 继续向 `ui/version-b-creative.html` 收口
  - 统一深色表面层级、hover、focus 高亮与工作台质感
  - 通过 Playwright 对主要页面路由做浏览器巡检与截图留档
  - focused validation rerun:
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题 Knowledge Base + Assistant 第一阶段迁移
  - `Knowledge Base` 已切到 B 风格工作台概览布局
  - `Assistant` 已切到 B 风格分区式配置工作台
  - 保持原有查询、表单、payload、提交逻辑不变
  - 新增 `Knowledge Base` workspace summary helper 测试
  - 补充共享 workspace panel / metric / input hover 样式
  - focused validation rerun:
    - `node --experimental-strip-types --test apps/web/test/knowledge-base-page-helpers.test.js`
    - `node --experimental-strip-types --test apps/web/test/assistant-config.test.js`
    - `pnpm --filter @rag-system/web build`

- ✅ B 主题 Chat + AppShell 第一阶段落地
  - `AppShell` 已切到 B 风格工作台壳层
  - `Chat` 已切到 B 风格深色工作区主方向
  - 已新增本地可切换主题基础：
    - `themeColor`: `creative-dark` / `constrained-light`
    - `themeLayout`: `workspace-app` / `default-app`
  - 当前默认主题：
    - `creative-dark + workspace-app`
  - 当前只改：
    - `AppShell`
    - `Chat`
    - 主题令牌与切换基础
  - 当前未改：
    - `Documents`
    - `Knowledge Base`
    - `Assistant`
  - focused validation rerun:
    - `node --experimental-strip-types --test apps/web/test/theme-preferences.test.js`
    - `node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js`
    - `node --experimental-strip-types --test apps/web/test/chat-page-helpers.test.js`
    - `pnpm --filter @rag-system/web build`

- ✅ Chat page visual refinement follow-up
  - keep the light teal constrained direction as the primary visual language
  - absorb only local chat-workspace strengths from the more creative concept
  - reduce the top chat hero weight
  - strengthen the conversation rail active state and scan efficiency
  - make the transcript workspace more dominant
  - tighten citation inspector information density
  - keep streaming behavior and API contract unchanged
  - focused validation rerun:
    - `node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js`
    - `node --experimental-strip-types --test apps/web/test/chat-page-helpers.test.js`
    - `pnpm --filter @rag-system/web build`

### 2026-03-21

- ✅ 主链路测试补强
- ✅ DOCX 支持
- ✅ Answering 结构化与 assistant 配置增强
- ✅ metadata filter 更完整的策略化能力
- ✅ chunk window 扩展后的更强拼接 / 组织策略
- ✅ retrieval 策略配置与演进能力
- ✅ 更系统的 prompt 管理
- ✅ 输出结构约束
- ✅ trace / detail / document 跳转与诊断增强
- ✅ web i18n（`zh` / `en`）
- ✅ Knowledge Base 页面运营概览增强
- ✅ ask 失败诊断增强
- ✅ RetrievalProfile metadata filter
- ✅ 引用片段与答案的严格结构化对齐
- ✅ 回答质量评估
- ✅ 更完整的 assistant / answer policy 配置能力
- ✅ 更完整的 assistant / config 管理
- ✅ API integration test queue isolation
- ✅ PC Web Knowledge Base -> Assistant browser smoke automation
- ✅ PC Web Chat progressive streamed experience polish
- ✅ Ask stream native answer-generation upgrade
- ✅ Chat conversation rail / citation context polish
- ✅ Chat high-fidelity visual refinement
- ✅ Document chain API E2E
- ✅ Ask chain API E2E
- ✅ Ask stream API E2E
- ✅ Web page source ingestion API E2E
- ✅ External feed source ingestion API E2E
- ✅ Sitemap source ingestion API E2E
- ✅ Sitemap index source ingestion API E2E
- ✅ retrieval / answering execution metadata

关键文件：

- [apps/api/src/modules/assistants/ask-assistant.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/assistants/ask-assistant.service.ts)
- [apps/api/src/modules/answering/answering.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/answering/answering.service.ts)
- [apps/api/src/modules/retrieval/retrieval.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/retrieval/retrieval.service.ts)
- [apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts](/D:/FeProjects/rag-system/apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts)
- [apps/api/src/modules/traces/traces.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/traces/traces.service.ts)
- [apps/api/src/infra/llm/prompt-manager.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/llm/prompt-manager.service.ts)
- [apps/api/src/infra/llm/llm.types.ts](/D:/FeProjects/rag-system/apps/api/src/infra/llm/llm.types.ts)
- [apps/api/prisma/schema.prisma](/D:/FeProjects/rag-system/apps/api/prisma/schema.prisma)
- [apps/api/prisma/migrations/20260321193000_add_answer_trace_execution_metadata/migration.sql](/D:/FeProjects/rag-system/apps/api/prisma/migrations/20260321193000_add_answer_trace_execution_metadata/migration.sql)
- [apps/api/test/document-chain-e2e.test.js](/D:/FeProjects/rag-system/apps/api/test/document-chain-e2e.test.js)
- [apps/api/test/ask-chain-e2e.test.js](/D:/FeProjects/rag-system/apps/api/test/ask-chain-e2e.test.js)
- [apps/api/test/web-page-source-e2e.test.js](/D:/FeProjects/rag-system/apps/api/test/web-page-source-e2e.test.js)
- [apps/api/test/feed-source-e2e.test.js](/D:/FeProjects/rag-system/apps/api/test/feed-source-e2e.test.js)
- [apps/api/test/sitemap-source-e2e.test.js](/D:/FeProjects/rag-system/apps/api/test/sitemap-source-e2e.test.js)
- [apps/api/test/ask-success.test.js](/D:/FeProjects/rag-system/apps/api/test/ask-success.test.js)
- [apps/api/test/answering.test.js](/D:/FeProjects/rag-system/apps/api/test/answering.test.js)
- [apps/web/src/pages/assistant/AssistantPage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/assistant/AssistantPage.tsx)
- [apps/web/src/pages/chat/ChatPage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/chat/ChatPage.tsx)
- [apps/web/src/pages/chat/chat-page-helpers.ts](/D:/FeProjects/rag-system/apps/web/src/pages/chat/chat-page-helpers.ts)
- [apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx)
- [apps/web/test/chat-page-helpers.test.js](/D:/FeProjects/rag-system/apps/web/test/chat-page-helpers.test.js)
- [docs/superpowers/specs/2026-03-21-web-page-source-ingestion-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-web-page-source-ingestion-design.md)
- [docs/superpowers/plans/2026-03-21-web-page-source-ingestion-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-web-page-source-ingestion-plan.md)
- [docs/superpowers/specs/2026-03-21-external-feed-source-ingestion-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-external-feed-source-ingestion-design.md)
- [docs/superpowers/plans/2026-03-21-external-feed-source-ingestion-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-external-feed-source-ingestion-plan.md)
- [docs/superpowers/specs/2026-03-21-sitemap-source-ingestion-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-sitemap-source-ingestion-design.md)
- [docs/superpowers/plans/2026-03-21-sitemap-source-ingestion-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-sitemap-source-ingestion-plan.md)
- [docs/superpowers/specs/2026-03-21-external-knowledge-source-expansion-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-external-knowledge-source-expansion-design.md)
- [docs/superpowers/plans/2026-03-21-external-knowledge-source-expansion-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-external-knowledge-source-expansion-plan.md)
- [docs/superpowers/specs/2026-03-21-pc-web-chat-experience-polish-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-pc-web-chat-experience-polish-design.md)
- [docs/superpowers/plans/2026-03-21-pc-web-chat-experience-polish-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-pc-web-chat-experience-polish-plan.md)
- [docs/superpowers/specs/2026-03-21-retrieval-answering-execution-metadata-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-retrieval-answering-execution-metadata-design.md)
- [docs/superpowers/plans/2026-03-21-retrieval-answering-execution-metadata-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-retrieval-answering-execution-metadata-plan.md)

---

## 10.1 Web B 主题迁移补充记录

- 已继续收口 `creative-dark + workspace-app` 的 B 主题工作台壳层，当前 `Chat / Documents / Document Detail / Knowledge Base / Assistant / Traces / Trace Detail / AppShell / StatePanel` 都已统一到同一套深色 panel 语言、hero 骨架和输入控件风格。
- 本轮重点清理了前端页面遗留的中文乱码文案，未改动接口、路由、字段和页面功能逻辑。
- 基于 [ui/审查报告.md](/D:/FeProjects/rag-system/ui/审查报告.md) 的剩余项已完成第二轮收口：
  - `Documents` 首屏补成工作台摘要区，新增紧凑指标网格和操作提示侧栏，弱化“空首屏”观感。
  - `Trace List` 改为先展示问题、结果状态和时间，再进入 trace 详情，降低过强的诊断台账感。
  - `Document Detail` 将存储键和错误信息明确下沉为次级诊断区，并统一详情页文案层级。
  - B 主题次级文字对比度进一步抬高，减少深色主题下的小字发灰问题。
- 继续完成下一轮高优先级 PC Web 收口：
  - `Chat` 增加顶部工作区摘要卡、输入区状态说明和更明确的引用摘要，主工作区完成度进一步提高。
  - `Documents` 表格把低价值的 `storage key` 首屏列替换为 `updated` 时间，提升高频扫描效率。
  - `Trace Detail` 增加 `Execution summary` 摘要层，先看结果、命中规模、引用数量和耗时，再进入评分与原始载荷。
  - `StatePanel + i18n` 统一了 loading / empty / error 的状态骨架与相关中文产品文案。
- 本轮新增/补齐的主要文件：
  - [apps/web/src/app/AppShell.tsx](/D:/FeProjects/rag-system/apps/web/src/app/AppShell.tsx)
  - [apps/web/src/pages/chat/ChatPage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/chat/ChatPage.tsx)
  - [apps/web/src/pages/documents/DocumentsPage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/documents/DocumentsPage.tsx)
  - [apps/web/src/pages/chat/ChatPage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/chat/ChatPage.tsx)
  - [apps/web/src/pages/documents/DocumentDetailPage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/documents/DocumentDetailPage.tsx)
  - [apps/web/src/pages/traces/TraceListPage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/traces/TraceListPage.tsx)
  - [apps/web/src/pages/traces/TraceDetailPage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/traces/TraceDetailPage.tsx)
  - [apps/web/src/components/StatePanel.tsx](/D:/FeProjects/rag-system/apps/web/src/components/StatePanel.tsx)
  - [apps/web/src/i18n/messages.ts](/D:/FeProjects/rag-system/apps/web/src/i18n/messages.ts)
  - [apps/web/src/styles/global.css](/D:/FeProjects/rag-system/apps/web/src/styles/global.css)
  - [apps/web/test/ui-review-regressions.test.js](/D:/FeProjects/rag-system/apps/web/test/ui-review-regressions.test.js)
- 本轮 Playwright 巡检截图目录：
  - [output/playwright/ui-audit-pass-9](/D:/FeProjects/rag-system/output/playwright/ui-audit-pass-9)
- 本轮最小验证：
  - `node --test apps/web/test/ui-review-regressions.test.js`
  - `pnpm --filter @rag-system/web build`

---

## 10. 最近一次已记录的验证快照

最近一次已记录通过的命令：

### API

- `pnpm test:api`
- `pnpm --filter @rag-system/api build`
- `node --test apps/api/test/retrieval.test.js apps/api/test/ask-success.test.js apps/api/test/answering.test.js`
- `node --test --test-concurrency=1 apps/api/test/api-flow.test.js`
- `node --test --test-concurrency=1 apps/api/test/retrieval-profile-filters.test.js`
- `node --test --test-concurrency=1 apps/api/test/retrieval-profile-strategy.test.js`
- `node --test apps/api/test/prompt-manager.test.js apps/api/test/llm.test.js`
- `node --test apps/api/test/ask-failures.test.js apps/api/test/http-exception-filter.test.js`
- `node --test --test-concurrency=1 apps/api/test/ask-chain-e2e.test.js`
- `node --test --test-concurrency=1 apps/api/test/ask-stream-e2e.test.js`
- `node --test --test-concurrency=1 apps/api/test/web-page-source-e2e.test.js`
- `node --test --test-concurrency=1 apps/api/test/feed-source-e2e.test.js`
- `node --test apps/api/test/parsing.test.js`
- `node --test --test-concurrency=1 apps/api/test/sitemap-source-e2e.test.js`
- `pnpm test:api`

### Web

- `pnpm --filter @rag-system/web typecheck`
- `pnpm --filter @rag-system/web build`
- `node --experimental-strip-types --test apps/web/test/chat-stream-state.test.js`
- `node --experimental-strip-types --test apps/web/test/chat-page-helpers.test.js`
- `node --experimental-strip-types --test apps/web/test/assistant-config.test.js`
- `node --test apps/web/test/pc-web-smoke.test.js`

说明：

- 这里记录的是最近一次已落盘验证快照
- 不代表每次编辑本文档时都重新执行了这些命令
- 当前 ask stream 保留 `NDJSON` 传输，但 answer generation 阶段已经升级为 provider-native text streaming
- citations、trace ids、answering / retrieval metadata 仍然在最终 `final` 事件补齐，因此它仍不等同于“全结构化全链路原生实时流式”
- 截至 `2026-03-23`，`pnpm test:api` 已 fresh rerun through `116 / 116` passing tests，当前 external-source backend closeout 已纳入这一整套 API 回归基线

---

## 11. 关键文档入口

- [README.md](/D:/FeProjects/rag-system/README.md)
- [docs/current-dev-setup.md](/D:/FeProjects/rag-system/docs/current-dev-setup.md)
- [docs/local-dev-infra.md](/D:/FeProjects/rag-system/docs/local-dev-infra.md)
- [docs/phase-1-rag-blueprint.md](/D:/FeProjects/rag-system/docs/phase-1-rag-blueprint.md)
- [docs/retrieval-trace.md](/D:/FeProjects/rag-system/docs/retrieval-trace.md)
- [docs/web-i18n.md](/D:/FeProjects/rag-system/docs/web-i18n.md)
