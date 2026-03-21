# Current Progress

更新时间：2026-03-21

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
- Web 端核心页面联调

当前阶段已经不再是骨架或纯设计稿，适合继续按小步增量推进。

### 当前阶段判断

- 当前主线状态：`MVP 可运行 + 第一版可诊断 + 第一版可配置`
- 当前最适合继续推进的方向：
  - 主链路测试补强
  - DOCX 支持
  - Answering 结构化与 assistant 配置增强

---

## 2. 第一版已完成

本节表示“已经落地并可用”，但不代表该方向已经 fully done。

### 2.1 工程与基础设施

- [x] `pnpm` monorepo 已落地
- [x] 仓库结构已拆分为：
  - `apps/api`
  - `apps/web`
  - `packages/shared`
  - `docs`
- [x] PostgreSQL 已接入
- [x] Redis 已接入
- [x] Docker 本地开发基础设施已提供
- [x] 本地开发文档已提供：
  - [README.md](/D:/FeProjects/rag-system/README.md)
  - [docs/current-dev-setup.md](/D:/FeProjects/rag-system/docs/current-dev-setup.md)
  - [docs/local-dev-infra.md](/D:/FeProjects/rag-system/docs/local-dev-infra.md)

### 2.2 后端骨架

- [x] NestJS API 已初始化
- [x] 全局异常过滤已接入
- [x] 健康检查接口可用：`GET /health`
- [x] 核心模块边界已建立：
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

- [x] Prisma schema 已建立
- [x] migration 已建立
- [x] seed 脚本已建立
- [x] 默认数据已固定：
  - tenant: `default-tenant`
  - user: `default-user`
  - knowledge base: `default-kb`
  - retrieval profile: `default-retrieval-profile`
  - assistant: `default-assistant`

### 2.4 文档链路第一版

- [x] 文档上传
- [x] 原始文件本地存储
- [x] 文档元数据入库
- [x] Redis 队列异步处理
- [x] Markdown 解析
- [x] TXT 解析
- [x] text-based PDF 解析
- [x] chunking 第一版
  - 标题感知切分
  - 超长段落切分
  - 更稳定的 chunk 长度控制
- [x] chunk 落库
- [x] indexing 接入
- [x] embedding 生成
- [x] 本地 file-backed vector store 写入
- [x] 文档状态流转：
  - `pending`
  - `processing`
  - `ready`
  - `failed`
- [x] `reindex`

当前相关 API：

- [x] `GET /knowledge-bases/:id/documents`
- [x] `POST /knowledge-bases/:id/documents`
- [x] `POST /knowledge-bases/:id/documents/upload`
- [x] `GET /documents/:id`
- [x] `GET /documents/:id/chunks`
- [x] `DELETE /documents/:id`
- [x] `POST /documents/:id/reindex`

### 2.5 Retrieval 第一版

- [x] 默认优先向量召回
- [x] lexical fallback
- [x] chunk window 扩展第一版
- [x] hybrid retrieval 第一版
- [x] rerank 第一版
- [x] query rewrite 第一版
- [x] RetrievalProfile metadata filter 第一版
  - `documentIds`
  - `sectionTitles`
  - `pageNumbers`
- [x] retrieval score breakdown 持久化第一版
  - `score`
  - `vectorScore`
  - `lexicalScore`
  - `hybridScore`
  - `rerankScore`

### 2.6 Ask / Answering / Trace 第一版

- [x] `assistant -> retrieval profile -> retrieval -> answering` 主链路打通
- [x] conversation 持久化
- [x] message 持久化
- [x] trace 持久化
- [x] citation-aware prompt 第一版
- [x] citations 返回
- [x] retrievedChunks 返回
- [x] `AnswerTrace.rewrittenQuery` 持久化
- [x] ask 失败诊断增强第一版
  - `ASK_PIPELINE_FAILED`
  - `traceId`
  - `details`
- [x] 全局 HTTP exception filter 保留结构化错误字段

当前相关 API：

- [x] `GET /assistants`
- [x] `GET /assistants/:id`
- [x] `PATCH /assistants/:id`
- [x] `POST /assistants/:id/ask`
- [x] `GET /retrieval-profiles`
- [x] `GET /retrieval-profiles/:id`
- [x] `POST /retrieval-profiles`
- [x] `PATCH /retrieval-profiles/:id`
- [x] `GET /conversations`
- [x] `GET /conversations/:id`
- [x] `GET /conversations/:id/messages`
- [x] `GET /conversations/:id/traces`
- [x] `GET /traces/:id`

### 2.7 LLM / Embedding 第一版

- [x] Ollama 生成接入
- [x] OpenAI 生成接入
- [x] 本地 fallback answer
- [x] Ollama embedding 接入
- [x] OpenAI embedding 接入
- [x] deterministic fallback embedding

### 2.8 Web MVP 第一版

- [x] `Chat` 页面接真实 API
- [x] `Documents` 页面接真实 API
- [x] `Knowledge Base` 页面接真实 API
- [x] `Assistant` 页面接真实 API
- [x] Web i18n 第一版：`zh` / `en`
- [x] App shell 语言切换器
- [x] 文档详情页
- [x] trace 详情页
- [x] citation -> 文档 chunk 深链跳转
- [x] 文档详情 trace 上下文高亮
- [x] Documents / Chat 更清晰的 loading / empty / error 状态第一版
- [x] Knowledge Base 页面运营概览增强第一版
- [x] Assistant 页面已暴露 retrieval 基础配置字段：
  - `topK`
  - `chunkWindow`
  - `enableHybrid`
  - `enableRerank`
  - `scoreThreshold`

### 2.9 测试与验证第一版

- [x] `pnpm typecheck`
- [x] `pnpm build`
- [x] `pnpm test:api`
- [x] 最小 API 测试底座已建立
- [x] 当前已覆盖：
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
- [x] API integration tests 已支持 `QUEUE_PREFIX` 隔离，避免 Redis worker 串扰
- [x] API 测试命令已串行执行，避免共享数据库状态的 HTTP 集成测试并发互相干扰

---

## 3. 增强版未完成

本节表示“第一版已经有，但后续增强版还没做完”。

### 3.1 Retrieval 增强版未完成

- [x] metadata filter 更完整的策略化能力
  - 已支持向后兼容的策略化过滤：
    - `documentIds.include` / `documentIds.exclude`
    - `sectionTitles.include` / `sectionTitles.exclude` / `sectionTitles.contains`
    - `pageNumbers.include` / `pageNumbers.exclude` / `pageNumbers.min` / `pageNumbers.max`
- [x] chunk window 扩展后的更强拼接 / 组织策略
  - `ask` 响应现已新增 `contextGroups`
  - 连续且同文档的 window chunks 会按 `chunkIndex` 组织为 context group
  - group 当前返回：
    - `startChunkIndex` / `endChunkIndex`
    - `chunkIds` / `primaryChunkIds`
    - `mergedContent`
    - `pageNumbers` / `sectionTitles`
- [x] 更系统的 retrieval 策略配置与演进能力
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
  - retrieval 已按策略控制候选池规模、lexical/vector/hybrid 模式与 hybrid merge 权重

### 3.2 Answering 增强版未完成

- [x] 更系统的 prompt 管理
  - 已新增 backend `PromptManagerService`
  - answer / rewrite prompt 已从 `LlmService` 内联字符串中抽离
  - 当前已支持版本化 prompt 标识：
    - `answer.v1`
    - `rewrite-query.v1`
  - Ollama / OpenAI 的 answer 与 rewrite 路径已统一经由 prompt manager 构造 prompt
- [x] 输出结构约束
  - LLM structured answer JSON 已新增显式 schema 校验与标准化
  - 当前会约束并标准化：
    - `answer`
    - `status`
    - `citations`
    - `missingInformation`
  - `citations` 已支持 numeric string -> integer 归一化与去重
  - 非法 structured payload 仍会安全回退到 plain-text 解析路径
- [x] 引用片段与答案的严格结构化对齐
- [x] 回答质量评估
- [x] 更完整的 assistant / answer policy 配置能力

### 3.3 Web 增强版未完成

- [ ] 更完整的 assistant / config 管理
  - RetrievalProfile `filtersJson` 前端编辑能力
  - 更完整的 answering / assistant policy 配置
- [ ] 更细的移动端适配
- [ ] 更多联调级自动化验证

### 3.4 测试增强版未完成

- [x] orchestrator / 模块集成测试
- [ ] 更完整的文档链路 E2E
- [ ] 更完整的 ask 链路 E2E
- [ ] 前后端联调级自动化验证

---

## 4. 仍未支持

本节表示“当前仓库还没有真正支持”。

- [x] DOCX 支持
- [ ] 网页内容抓取 / 网页知识源接入
- [ ] 外部知识源接入

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

如果旧文档中仍出现这些表述，应以本文件当前内容为准。

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

- [x] 接入真实 embedding
- [x] 落地第一版 vector store
- [x] 打通 indexing -> retrieval 的真实向量链路
- [x] RetrievalProfile metadata filter 第一版

### 8.2 当前推荐下一步

- [x] 主链路测试补强
- [x] DOCX 支持
- [x] Answering 结构化与 assistant 配置增强

### 8.3 后续再往后

- [ ] 更完整的 assistant/config 管理
- [ ] retrieval / answering 更系统化演进
- [ ] 前后端联调级自动化验证
- [ ] 外部知识源
- [ ] auth / 多租户 / ACL
- [ ] 企业能力

---

## 9. 最近完成的关键增量

### 2026-03-21

- [x] 主链路测试补强
- [x] DOCX 支持
- [x] Answering 结构化与 assistant 配置增强
- [x] metadata filter 更完整的策略化能力
- [x] chunk window 扩展后的更强拼接 / 组织策略
- [x] retrieval 策略配置与演进能力
- [x] 更系统的 prompt 管理
- [x] 输出结构约束
- [x] trace/detail/document 跳转与诊断增强
- [x] web i18n（`zh` / `en`）
- [x] Knowledge Base 页面运营概览增强
- [x] ask 失败诊断增强
- [x] RetrievalProfile metadata filter
- [x] 引用片段与答案的严格结构化对齐
- [x] 回答质量评估
- [x] 更完整的 assistant / answer policy 配置能力
- [x] API integration test queue isolation

关键文件：

- [apps/api/src/modules/assistants/ask-assistant.error.ts](/D:/FeProjects/rag-system/apps/api/src/modules/assistants/ask-assistant.error.ts)
- [apps/api/src/modules/assistants/ask-assistant.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/assistants/ask-assistant.service.ts)
- [apps/api/src/modules/assistants/assistant.schemas.ts](/D:/FeProjects/rag-system/apps/api/src/modules/assistants/assistant.schemas.ts)
- [apps/api/src/modules/answering/answering.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/answering/answering.service.ts)
- [apps/api/src/infra/llm/prompt-manager.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/llm/prompt-manager.service.ts)
- [apps/api/src/common/http-exception.filter.ts](/D:/FeProjects/rag-system/apps/api/src/common/http-exception.filter.ts)
- [apps/api/src/modules/retrieval/retrieval.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/retrieval/retrieval.service.ts)
- [apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts](/D:/FeProjects/rag-system/apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts)
- [apps/api/src/infra/vector-store/vector-store.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/vector-store/vector-store.service.ts)
- [apps/api/test/ingestion.orchestrator.test.js](/D:/FeProjects/rag-system/apps/api/test/ingestion.orchestrator.test.js)
- [apps/api/test/ask-success.test.js](/D:/FeProjects/rag-system/apps/api/test/ask-success.test.js)
- [apps/api/test/assistants-api.test.js](/D:/FeProjects/rag-system/apps/api/test/assistants-api.test.js)
- [apps/api/test/ask-failures.test.js](/D:/FeProjects/rag-system/apps/api/test/ask-failures.test.js)
- [apps/api/test/api-flow.test.js](/D:/FeProjects/rag-system/apps/api/test/api-flow.test.js)
- [apps/api/test/http-exception-filter.test.js](/D:/FeProjects/rag-system/apps/api/test/http-exception-filter.test.js)
- [apps/api/test/retrieval-profile-filters.test.js](/D:/FeProjects/rag-system/apps/api/test/retrieval-profile-filters.test.js)
- [docs/superpowers/plans/2026-03-21-ask-failure-diagnostics-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-ask-failure-diagnostics-plan.md)
- [docs/superpowers/plans/2026-03-21-main-chain-test-hardening-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-main-chain-test-hardening-plan.md)
- [docs/superpowers/specs/2026-03-21-docx-support-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-docx-support-design.md)
- [docs/superpowers/plans/2026-03-21-docx-support-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-docx-support-plan.md)
- [docs/superpowers/specs/2026-03-21-retrieval-profile-metadata-filter-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-retrieval-profile-metadata-filter-design.md)
- [docs/superpowers/plans/2026-03-21-retrieval-profile-metadata-filter-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-retrieval-profile-metadata-filter-plan.md)
- [docs/superpowers/specs/2026-03-21-retrieval-strategy-configuration-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-retrieval-strategy-configuration-design.md)
- [docs/superpowers/plans/2026-03-21-retrieval-strategy-configuration-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-retrieval-strategy-configuration-plan.md)
- [docs/superpowers/specs/2026-03-21-prompt-management-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-prompt-management-design.md)
- [docs/superpowers/plans/2026-03-21-prompt-management-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-prompt-management-plan.md)
- [docs/superpowers/specs/2026-03-21-structured-output-constraints-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-structured-output-constraints-design.md)
- [docs/superpowers/plans/2026-03-21-structured-output-constraints-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-structured-output-constraints-plan.md)
- [docs/superpowers/specs/2026-03-21-answering-structured-assistant-config-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-answering-structured-assistant-config-design.md)
- [docs/superpowers/plans/2026-03-21-answering-structured-assistant-config-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-answering-structured-assistant-config-plan.md)
- [docs/superpowers/specs/2026-03-21-answer-citation-alignment-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-answer-citation-alignment-design.md)
- [docs/superpowers/plans/2026-03-21-answer-citation-alignment-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-answer-citation-alignment-plan.md)
- [docs/superpowers/specs/2026-03-21-answer-quality-evaluation-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-answer-quality-evaluation-design.md)
- [docs/superpowers/plans/2026-03-21-answer-quality-evaluation-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-answer-quality-evaluation-plan.md)
- [docs/superpowers/specs/2026-03-21-assistant-answer-policy-expansion-design.md](/D:/FeProjects/rag-system/docs/superpowers/specs/2026-03-21-assistant-answer-policy-expansion-design.md)
- [docs/superpowers/plans/2026-03-21-assistant-answer-policy-expansion-plan.md](/D:/FeProjects/rag-system/docs/superpowers/plans/2026-03-21-assistant-answer-policy-expansion-plan.md)

---

## 10. 最近一次已记录的验证快照

最近一次已记录通过的命令：

### API

- `pnpm --filter @rag-system/api build`
- `node --test apps/api/test/retrieval.test.js apps/api/test/ask-success.test.js apps/api/test/answering.test.js`
- `node --test --test-concurrency=1 apps/api/test/api-flow.test.js`
- `node --test apps/api/test/retrieval.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js`
- `node --test --test-concurrency=1 apps/api/test/retrieval-profile-filters.test.js`
- `node --test --test-concurrency=1 apps/api/test/retrieval-profile-strategy.test.js`
- `node --test apps/api/test/prompt-manager.test.js apps/api/test/llm.test.js`
- `node --test apps/api/test/llm.test.js`
- `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js`
- `node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js apps/api/test/prompt-manager.test.js`
- `node --test --test-concurrency=1 apps/api/test/api-flow.test.js`
- `node --test --test-concurrency=1 apps/api/test/ingestion.orchestrator.test.js apps/api/test/ask-success.test.js apps/api/test/ask-failures.test.js apps/api/test/api-flow.test.js`
- `node --test apps/api/test/ask-failures.test.js apps/api/test/http-exception-filter.test.js`
- `node --test apps/api/test/retrieval.test.js apps/api/test/retrieval-profile-filters.test.js`
- `pnpm test:api`

### Web

- `pnpm --filter @rag-system/web typecheck`
- `pnpm --filter @rag-system/web build`
- `node --test apps/web/test/*.test.js`

说明：

- 这里记录的是最近一次已落盘验证快照
- 不代表每次编辑本文件时都重新执行了这些命令

---

## 11. 关键文档入口

- [README.md](/D:/FeProjects/rag-system/README.md)
- [docs/current-dev-setup.md](/D:/FeProjects/rag-system/docs/current-dev-setup.md)
- [docs/local-dev-infra.md](/D:/FeProjects/rag-system/docs/local-dev-infra.md)
- [docs/phase-1-rag-blueprint.md](/D:/FeProjects/rag-system/docs/phase-1-rag-blueprint.md)
- [docs/retrieval-trace.md](/D:/FeProjects/rag-system/docs/retrieval-trace.md)
- [docs/web-i18n.md](/D:/FeProjects/rag-system/docs/web-i18n.md)
