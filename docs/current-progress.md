# Current Progress

> 文档角色：`current-status`
> 当前使用方式：用于记录当前实现进度、已完成增量、未完成方向和验证快照；现阶段优先级判断以 `docs/next_steps_rag_project_plan.md` 为主。

更新时间：2026-03-22

> 当前说明：
> 现阶段任务方向、优先级判断、superpowers 使用方式、AI review 策略，以 `docs/next_steps_rag_project_plan.md` 为主。
> 本文档主要用于记录当前实现进度、已完成增量、未完成方向和验证快照。

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
  - 下一整个大方向已切回 `external knowledge source expansion`
  - 建议继续保持 `backend / API first`，在现有 source family 上做小步稳定化增量
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
- [ ] external knowledge source expansion
  - web page source ingestion minimum increment: done
  - feed source ingestion minimum increment: done
  - sitemap source ingestion minimum increment: done
  - sitemap index source ingestion minimum increment: done
  - the broader external knowledge source direction is now the active next priority; continue backend-first expansion from the current completed source increments
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
- 后续的 `external knowledge source expansion` 仍然是当前的下一个完整任务方向

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
- [ ] external knowledge source expansion
  - source stabilization phase 1: done
  - source run history / execution observability minimum increment: done
  - sitemap / sitemap-index partial-failure tolerance + structured partial diagnostics: done
  - feed partial invalid-entry tolerance + structured partial diagnostics: done
  - current recommended next increment:
    - keep `backend / API first`
    - continue improving external source execution boundaries and diagnostics on top of the new run history
    - still avoid opening a new UI refactor or a generic connector/source platform rewrite
  - latest backend consistency follow-up:
    - external source `external_resync` now resets document-level `chunkCount` to `0` as soon as a new pending version is queued, aligning repeated source syncs with the existing upload-document `reindex` semantics
    - external source `reindex` with missing or invalid persisted `sourceConfigJson` now still lands a new `external_resync` run/version and records a structured non-retryable failure instead of escaping before run history is written
    - document-run summary latest anchors now resolve by the latest matching completed run timestamp, so overlapping runs do not let a later-started but earlier-finished run override `latestFailure` / `latestRetryableFailure` / `latestSkipped`
    - document-level run history now uses the same primary recent-run ordering as the knowledge-base scoped run list: `startedAt desc` first, then `version desc` for ties
    - external source re-sync now preserves the current document title whenever the refreshed source payload does not provide a new source-level title
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

---

## 11. 关键文档入口

- [README.md](/D:/FeProjects/rag-system/README.md)
- [docs/current-dev-setup.md](/D:/FeProjects/rag-system/docs/current-dev-setup.md)
- [docs/local-dev-infra.md](/D:/FeProjects/rag-system/docs/local-dev-infra.md)
- [docs/phase-1-rag-blueprint.md](/D:/FeProjects/rag-system/docs/phase-1-rag-blueprint.md)
- [docs/retrieval-trace.md](/D:/FeProjects/rag-system/docs/retrieval-trace.md)
- [docs/web-i18n.md](/D:/FeProjects/rag-system/docs/web-i18n.md)
