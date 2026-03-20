# Current Progress

更新时间：2026-03-21

## 1. 当前结论

项目已经完成了一个可运行的最小 RAG MVP 骨架，并打通了以下主路径：

- 基础开发环境可启动
- 文档上传 -> 异步处理 -> chunk 落库 -> embedding -> 向量索引写入
- 向量检索 -> ask -> 会话/消息/trace 落库
- Web 端 4 个核心页面已接到真实 API

当前状态适合继续迭代，不再是纯设计稿或空骨架。

---

## 2. 已完成

### 2.1 工程与基础设施

- 已采用 `pnpm` 轻量 monorepo
- 已拆分：
  - `apps/api`
  - `apps/web`
  - `packages/shared`
  - `docs`
- 本地开发基础设施已接入：
  - PostgreSQL
  - Redis
- 已提供 Docker 配置：
  - [docker-compose.yml](/D:/FeProjects/rag-system/docker-compose.yml)
- 已提供本地启动说明：
  - [docs/local-dev-infra.md](/D:/FeProjects/rag-system/docs/local-dev-infra.md)
  - [docs/current-dev-setup.md](/D:/FeProjects/rag-system/docs/current-dev-setup.md)

### 2.2 后端基础骨架

- NestJS 后端已初始化
- 全局异常过滤已接入
- 健康检查接口已可用：
  - `GET /health`
- 基础模块目录已落地：
  - `knowledge-bases`
  - `documents`
  - `assistants`
  - `retrieval-profiles`
  - `conversations`
  - `messages`
  - `traces`
  - `ingestion`
  - `retrieval`
  - `answering`
  - `infra/database`
  - `infra/storage`
  - `infra/queue`
  - `infra/llm`
  - `infra/vector-store`

### 2.3 数据库与种子数据

- Prisma 已接入
- PostgreSQL schema 已建立
- 已有 migration
- 已有 seed 脚本
- 默认数据已定义：
  - tenant: `default-tenant`
  - user: `default-user`
  - knowledge base: `default-kb`
  - retrieval profile: `default-retrieval-profile`
  - assistant: `default-assistant`

相关文件：

- [apps/api/prisma/schema.prisma](/D:/FeProjects/rag-system/apps/api/prisma/schema.prisma)
- [apps/api/prisma/seed.js](/D:/FeProjects/rag-system/apps/api/prisma/seed.js)

### 2.4 文档链路

已打通最小文档处理链路：

- 支持文档上传
- 原始文件落本地存储
- 文档元数据入库
- Redis 队列异步处理
- Markdown / TXT / PDF 基础解析
- 已补第一版 chunking 优化
  - 标题感知切分
  - 超长段落按句子 / 行 / 长度逐级切分
  - 更稳定的 chunk 长度控制
- chunk 落库
- 已接入 indexing 阶段
- chunk embedding 生成
- 向量索引写入本地 file-backed vector store
- 文档状态流转：
  - `pending`
  - `processing`
  - `ready`
  - `failed`
- 已支持 `reindex`

当前已实现接口：

- `GET /knowledge-bases/:id/documents`
- `POST /knowledge-bases/:id/documents`
- `POST /knowledge-bases/:id/documents/upload`
- `GET /documents/:id`
- `GET /documents/:id/chunks`
- `DELETE /documents/:id`
- `POST /documents/:id/reindex`

相关文件：

- [apps/api/src/modules/documents/documents.controller.ts](/D:/FeProjects/rag-system/apps/api/src/modules/documents/documents.controller.ts)
- [apps/api/src/modules/documents/documents.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/documents/documents.service.ts)
- [apps/api/src/modules/ingestion/ingestion.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/ingestion/ingestion.service.ts)
- [apps/api/src/modules/indexing/indexing.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/indexing/indexing.service.ts)
- [apps/api/src/infra/parsing/parsing.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/parsing/parsing.service.ts)
- [apps/api/src/infra/storage/storage.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/storage/storage.service.ts)
- [apps/api/src/infra/queue/queue.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/queue/queue.service.ts)
- [apps/api/src/infra/embedding/embedding.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/embedding/embedding.service.ts)
- [apps/api/src/infra/vector-store/vector-store.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/vector-store/vector-store.service.ts)

### 2.5 检索与问答链路

已打通最小 ask 主链路：

- 基于 assistant 发问
- 读取 retrieval profile
- 默认优先做向量召回
- 向量不可用时退回 `DocumentChunk` lexical fallback
- 生成 answer
- 已补第一版引用感知 prompt
- 返回 citations
  - 优先返回 answer 中实际引用到的 sources
  - snippet 会尽量截取与问题更相关的文本
- 保存 conversation
- 保存 message
- 保存 trace

当前 ask 返回包含：

- `conversationId`
- `userMessageId`
- `assistantMessageId`
- `traceId`
- `answer`
- `citations`
- `retrievedChunks`

当前已实现接口：

- `GET /assistants`
- `GET /assistants/:id`
- `PATCH /assistants/:id`
- `POST /assistants/:id/ask`
- `GET /retrieval-profiles`
- `GET /retrieval-profiles/:id`
- `POST /retrieval-profiles`
- `PATCH /retrieval-profiles/:id`
- `GET /conversations`
- `GET /conversations/:id`
- `GET /conversations/:id/messages`
- `GET /conversations/:id/traces`
- `GET /traces/:id`

相关文件：

- [apps/api/src/modules/retrieval/retrieval.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/retrieval/retrieval.service.ts)
- [apps/api/src/modules/answering/answering.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/answering/answering.service.ts)
- [apps/api/src/modules/assistants/assistants.controller.ts](/D:/FeProjects/rag-system/apps/api/src/modules/assistants/assistants.controller.ts)
- [apps/api/src/modules/conversations/conversations.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/conversations/conversations.service.ts)
- [apps/api/src/modules/messages/messages.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/messages/messages.service.ts)
- [apps/api/src/modules/traces/traces.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/traces/traces.service.ts)

### 2.6 LLM 接入

当前 LLM 层已具备三层策略：

1. 若存在 `OLLAMA_BASE_URL` 和 `OLLAMA_MODEL`，优先走 Ollama
2. 若存在 `OPENAI_API_KEY`，可走 OpenAI Chat Completions
3. 若都没有，则走本地 fallback answer

相关文件：

- [apps/api/src/infra/llm/llm.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/llm/llm.service.ts)

说明：

- Ollama 已有接入代码
- OpenAI 已有接入代码
- 当前默认仍可在无模型时运行

### 2.7 前端 Web

已完成 React Web MVP 页面骨架并接入真实 API：

- `Chat`
- `Documents`
- `Knowledge Base`
- `Assistant`

当前前端技术组合：

- React
- React Router
- TanStack Query
- React Hook Form
- Mantine

当前页面能力：

#### Chat

- 显示会话列表
- 显示消息列表
- 发送问题
- 展示 citations
- 基础错误提示

#### Documents

- 上传文档
- 轮询文档状态
- `reindex`
- 查看 chunk 列表

#### Knowledge Base

- 展示默认知识库信息

#### Assistant

- 查看并编辑默认 assistant
- 查看并编辑 retrieval profile 的基础字段

相关文件：

- [apps/web/src/pages/chat/ChatPage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/chat/ChatPage.tsx)
- [apps/web/src/pages/documents/DocumentsPage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/documents/DocumentsPage.tsx)
- [apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx)
- [apps/web/src/pages/assistant/AssistantPage.tsx](/D:/FeProjects/rag-system/apps/web/src/pages/assistant/AssistantPage.tsx)
- [apps/web/src/features/api/hooks.ts](/D:/FeProjects/rag-system/apps/web/src/features/api/hooks.ts)

### 2.8 构建与基本验证

截至当前，以下检查已通过：

- `pnpm typecheck`
- `pnpm build`
- `pnpm test:api`
- 本地 Ollama `/api/embed` 实测可用
- 文档上传 -> `ready` -> ask 链路已完成联调验证
- PDF 上传 -> `ready` 链路已完成联调验证
- 超长文本 chunking 已完成联调验证
- answer inline source marker 与 citations 对齐已完成联调验证

说明：

- API 和 Web 都能通过类型检查与构建
- 默认 assistant + 默认 knowledge base 已完成一轮真实上传与问答验证
- trace 中已可看到 `retrievedChunkIdsJson`、`retrievalScoresJson`、`citationsJson`
- API 已建立最小测试底座，当前已覆盖：
  - PDF parsing
  - chunking
  - retrieval chunk window
  - citation-aware answering
  - upload -> ready -> ask -> trace HTTP 集成测试
- Web 构建存在 bundle 过大 warning，但不阻塞当前开发

---

## 3. 当前未完成

### 3.1 向量链路第一版已落地，但仍属轻量实现

P1 的主链路已补齐：

- 已接入真实 embedding 能力
  - 优先使用 `OLLAMA_EMBEDDING_MODEL`
  - 其次可使用 `OPENAI_EMBEDDING_MODEL`
  - 都不可用时才退回本地 deterministic fallback
- 已落地第一版 `VectorStoreModule`
  - 当前实现为本地文件持久化向量索引
  - 索引目录位于 `storage/vectors`
- 已打通 `indexing -> retrieval`
  - chunk 生成后会进入 indexing 阶段
  - retrieval 默认优先做向量召回
  - 向量检索不可用时保留 lexical fallback
- 已完成本地联调验证
  - API 健康检查通过
  - 文档可进入 `ready`
  - `storage/vectors/default-kb.json` 已实际生成
  - ask 返回了基于新文档的答案、citations、retrievedChunks 与相似度分数

相关文件：

- [apps/api/src/infra/embedding/embedding.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/embedding/embedding.service.ts)
- [apps/api/src/infra/vector-store/vector-store.service.ts](/D:/FeProjects/rag-system/apps/api/src/infra/vector-store/vector-store.service.ts)
- [apps/api/src/modules/indexing/indexing.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/indexing/indexing.service.ts)
- [apps/api/src/modules/retrieval/retrieval.service.ts](/D:/FeProjects/rag-system/apps/api/src/modules/retrieval/retrieval.service.ts)

### 3.2 复杂文档与外部知识源仍未完整支持

当前实际可用的是：

- `.md`
- `.txt`
- `.pdf`

尚未真正支持：

- DOCX
- 网页
- 外部知识源接入

### 3.3 检索策略仍较简单

尚未实现：

- hybrid retrieval
- rerank
- query rewrite
- metadata filter 的完整策略化能力
- chunk window 扩展拼接

### 3.4 Answering 仍是 MVP 级别

虽然已接入 Ollama / OpenAI / fallback 三层能力，但当前仍未完成：

- 第一版 citation-aware prompt 已接入，但仍缺少更系统的 prompt 管理
- 输出结构约束
- 引用片段与答案仍不是严格结构化对齐
- 回答质量评估

### 3.5 前端仍缺少一些重要细节

尚未完成的前端能力包括：

- 文档详情页
- trace 详情页
- citation 与原始文档的更强联动
- 更完整的 assistant/config 管理
- 更细的加载与失败状态设计
- 更好的移动端适配

### 3.6 测试体系已起步，但仍未完整建立

当前已完成：

- 最小测试底座已接入
- 根脚本可运行：
  - `pnpm test:api`
- 当前已覆盖：
  - PDF parsing
  - chunking
  - retrieval chunk window
  - citation-aware answering

当前仍未完成：

- orchestrator / 模块集成测试
- 更完整的文档链路 E2E
- 更完整的 ask 链路 E2E
- 前后端联调级自动化验证

### 3.7 权限、多租户、企业能力尚未开始

这些都还没有实现：

- 鉴权
- 用户登录
- 多租户隔离
- ACL / 文档权限
- 企业级审计与治理能力

---

## 4. 当前已知限制

- 当前已具备第一版向量 RAG 主链路，但向量存储仍是本地轻量实现
- ask 结果质量仍较依赖 chunk 切分质量
- 当前 embedding 默认可直接使用本地 Ollama，但模型选择和维度管理仍未配置化
- 若未配置可用 embedding 模型，会退回本地 fallback embedding，语义召回上限有限
- 只适合本地开发和单用户验证
- 当前 worker 与 API 在同一进程模型下运行，后续可再拆分

---

## 5. 建议的下一步优先级

### P1

- 已完成：接入真实 embedding
- 已完成：落地第一版 vector store 实现
- 已完成：打通 indexing -> retrieval 的真实向量链路

### P2

- 已完成：优化 parsing / chunking
- 已完成：补 PDF 解析
- 已完成：提升 ask prompt 与 citation 组织（第一版）

### P3

- 已完成：建立最小测试体系（第一版）
- 补 trace 详情页 / 文档详情页
- 优化前端交互与错误处理

### P4

- 进一步做 assistant 配置化
- 引入更强 retrieval 策略
- 为后续多场景扩展继续收口模块边界

---

## 6. 关联文档

- 总体设计蓝图：[docs/phase-1-rag-blueprint.md](/D:/FeProjects/rag-system/docs/phase-1-rag-blueprint.md)
- 本地基础设施说明：[docs/local-dev-infra.md](/D:/FeProjects/rag-system/docs/local-dev-infra.md)
- 当前运行说明：[docs/current-dev-setup.md](/D:/FeProjects/rag-system/docs/current-dev-setup.md)

---

## 2026-03-21 Follow-up Updates

Incremental update after the latest implementation round:

- P3 frontend detail pages are now completed:
  - document detail page
  - trace detail page
  - citation to document chunk deep link with chunk highlight
- Documents page and Chat page now have clearer loading, empty, and error states.
- Document detail page now supports reindex, delete, processing refresh, and failed-state guidance.
- Assistant configuration page now exposes persisted retrieval settings:
  - status
  - topK
  - chunkWindow
  - enableHybrid
  - enableRerank
  - scoreThreshold
- Retrieval profile flags are now active in backend retrieval behavior:
  - `enableHybrid` blends vector and lexical candidates
  - `enableRerank` reranks candidates with an additional lexical relevance heuristic
- API retrieval tests were expanded to cover chunk window expansion, hybrid retrieval, and rerank behavior.

Validation completed in the current workspace:

- `pnpm typecheck`
- `pnpm build`
- `pnpm test:api`

Additional frontend/platform updates completed after that round:

- Web i18n is now available for `zh` and `en`.
- The app shell includes a persistent language switcher.
- Main visible page copy has been moved behind a lightweight frontend dictionary/provider layer.
- Locale-aware date formatting is now used in document detail and trace detail pages.

Additional backend retrieval updates completed after that round:

- Query rewrite is now part of the ask pipeline.
- Query rewrite uses LLM first when configured and falls back to a deterministic local rewrite path.
- `AnswerTrace.rewrittenQuery` is now populated when rewrite output differs from the original user query.
- Retrieval score payloads now persist additional score breakdown fields:
  - `vectorScore`
  - `lexicalScore`
  - `hybridScore`
  - `rerankScore`

Superseded status note:

- Earlier sections in this document that listed `hybrid retrieval`, `rerank`, or `query rewrite` as not yet implemented are now outdated.
- Current status is:
  - `hybrid retrieval`: first usable version implemented
  - `rerank`: first usable heuristic rerank implemented
  - `query rewrite`: implemented in ask pipeline with LLM-first plus deterministic fallback

Additional frontend trace diagnostics updates completed after that round:

- Trace detail now compares `userQuery` and `rewrittenQuery` in a dedicated side-by-side panel.
- Trace retrieved chunks now show clearer ranking and final score ordering.
- Trace retrieved chunks now expose more diagnostic context:
  - primary hit vs. chunk-window neighbor
  - citation flag
  - compact chunk preview
  - document title / chunk index / page / section context when persisted
- Trace score diagnostics now structure and display:
  - `score`
  - `vectorScore`
  - `lexicalScore`
  - `hybridScore`
  - `rerankScore`
- New visible trace diagnostic copy has been added to the existing `zh` / `en` i18n dictionary.

Validation completed for this update:

- `pnpm --filter @rag-system/web typecheck`
- `pnpm --filter @rag-system/web build`

Additional backend retrieval profile metadata filter updates completed after that round:

- Retrieval profiles now support persisted metadata filters through `filtersJson`.
- First supported filter keys are:
  - `documentIds`
  - `sectionTitles`
  - `pageNumbers`
- Ask pipeline retrieval now applies the active retrieval profile filters to:
  - lexical retrieval candidate selection
  - vector-store candidate selection
  - filtered fallback retrieval
  - chunk-window expansion scope
- New API coverage verifies:
  - retrieval unit behavior under metadata filtering
  - HTTP ask flow constrained by `RetrievalProfile.filtersJson`

Additional backend test isolation updates completed after that round:

- API integration tests now support queue isolation through `QUEUE_PREFIX`.
- Integration test processes use distinct ingestion queue names to avoid Redis worker cross-talk when the full API suite runs.

Validation completed for this update:

- `pnpm --filter @rag-system/api build`
- `node --test apps/api/test/retrieval.test.js apps/api/test/retrieval-profile-filters.test.js`
- `pnpm test:api`

Additional ask failure diagnostics updates completed after that round:

- Ask pipeline failures now return a structured API error payload instead of leaking the raw provider/runtime exception message as the top-level response.
- Structured ask failure responses now include:
  - stable error code: `ASK_PIPELINE_FAILED`
  - related `traceId` when trace persistence succeeded
  - compact diagnostic `details`
- The global HTTP exception filter now preserves structured `HttpException` payload fields such as:
  - `code`
  - `traceId`
  - `details`

Validation completed for this update:

- `pnpm --filter @rag-system/api build`
- `node --test apps/api/test/ask-failures.test.js apps/api/test/http-exception-filter.test.js`

Additional trace/document navigation updates completed after that round:

- Trace-to-document chunk links now preserve trace context in URL params:
  - source trace id
  - rank
  - final score
  - primary / neighbor status
  - citation flag
- Document detail now shows a focused trace-origin banner when opened from trace diagnostics.
- Focused chunks in document detail now reflect trace context badges and provide a return link back to the originating trace.

Validation completed for this update:

- `pnpm --filter @rag-system/web typecheck`
- `pnpm --filter @rag-system/web build`
- `pnpm test:api`

Additional web MVP polish completed after that round:

- Knowledge Base page now acts as an operational overview instead of a minimal placeholder.
- The page now shows:
  - knowledge base status and updated time
  - total documents and chunks
  - ready / processing / failed document counts
  - assistant count bound to the current knowledge base
  - direct navigation actions to Documents and Assistant
- Knowledge Base page state handling now follows the same `StatePanel` pattern used elsewhere for:
  - loading
  - query errors
  - missing knowledge base
  - empty document state

Validation completed for this update:

- `pnpm --filter @rag-system/web typecheck`
- `pnpm --filter @rag-system/web build`
