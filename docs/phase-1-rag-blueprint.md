# 一期实施蓝图：通用 RAG 平台内核 + 个人知识库默认场景

> 文档角色：`background`
> 当前使用方式：长期产品/架构背景参考；不作为当前阶段优先级主文档。

## 1. 项目定位

一期目标不是做一个只能服务个人使用的小工具，而是：

- 对外：个人知识库助手
- 对内：按通用 RAG 平台方式设计

当前阶段的产品路径：

- 先个人使用
- 后续考虑团体/企业使用
- 第一版代码尽量便于扩展到其他通用 RAG 业务场景

核心原则：

- 个人知识库作为默认场景，而不是唯一场景
- 单用户运行，多用户结构预留
- 单知识库起步，多知识库结构预留
- 单场景落地，多场景配置预留

---

## 2. 一期架构结论

### 2.1 总体方向

- 前后端分离
- 前端使用 React
- 后端使用 NestJS
- 后端运行时优先 Node.js
- 后端单体应用，但内部模块化
- 输入输出尽量采用 schema-first 思路
- 文档处理链路异步
- 问答主链路同步

### 2.2 为什么这样设计

目标不是只做一期 demo，而是做一个后续可扩展的 RAG 平台内核。

因此需要从一开始拆清三层：

- 业务对象层：知识库、文档、助手、会话、trace
- 流程能力层：ingestion、indexing、retrieval、answering
- 基础设施层：数据库、文件存储、向量存储、模型、队列

---

## 3. 技术选型建议

### 3.1 已确认方向

- 前端：React
- 后端：NestJS
- 校验：Zod 路线
- 主数据库：PostgreSQL
- 架构：前后端分离，后端单体模块化

### 3.2 建议方向

- ORM：Prisma 优先，Drizzle 作为备选
- 文件存储：通过 StorageModule 抽象，第一版底层可先用本地文件系统
- 向量存储：通过 VectorStoreModule 抽象，第一版实现可轻量化
- 队列：确认需要任务机制，但最终具体实现后置拍板

### 3.3 暂未拍板的点

以下内容暂未最终拍板，待整体讨论完成后统一决定：

- ORM 最终选择 Prisma 还是 Drizzle
- 队列具体实现
- 第一版向量存储具体实现
- 第一版文件存储具体实现细节

---

## 4. NestJS 使用原则

当前项目使用 NestJS 的目标，不是走传统重样板路线，而是：

- 用 NestJS 负责平台骨架和模块边界
- 用 Zod 负责输入输出校验与类型收口
- 用 orchestrator 负责复杂流程编排
- 用 provider 抽象外部依赖

需要避免的做法：

- 默认依赖 class-validator + class-transformer 套路
- 机械地 controller -> service -> repository 三层透传
- 在业务 service 中直接写死向量库、模型、文件系统调用

正确的使用方式：

- 简单对象管理保持轻量
- 复杂流程单独建编排服务
- 外部依赖统一做适配层
- 模块依赖保持单向清晰

---

## 5. 模块与职责最终版

## 5.1 模块分组

建议分为三类模块。

### 业务对象模块

- KnowledgeBasesModule
- DocumentsModule
- AssistantsModule
- RetrievalProfilesModule
- ConversationsModule
- MessagesModule
- TracesModule

### 流程能力模块

- IngestionModule
- IndexingModule
- RetrievalModule
- AnsweringModule

### 平台基础模块

- ConfigModule
- DatabaseModule
- StorageModule
- VectorStoreModule
- LlmModule
- EmbeddingModule
- ParsingModule
- QueueModule
- HealthModule
- AuthModule（一期可极轻）

## 5.2 各模块职责

### KnowledgeBasesModule

- 管理知识库实体
- 提供知识库查询
- 维护知识库与文档、助手的归属关系

### DocumentsModule

- 创建文档记录
- 管理文档元数据
- 查询文档状态
- 提供 reindex 入口

### AssistantsModule

- 管理助手配置
- 绑定知识库
- 绑定 retrieval profile
- 提供 system prompt 和回答策略配置

### RetrievalProfilesModule

- 管理检索配置
- 提供 topK、chunk window、filter、rerank 等参数

### ConversationsModule

- 管理会话
- 提供会话列表和详情

### MessagesModule

- 保存用户消息和助手消息
- 提供消息历史查询

### TracesModule

- 保存一次问答执行记录
- 提供 trace 查询能力

### IngestionModule

- 上传后触发文档处理
- 调 parser
- 清洗文本
- chunking
- 更新处理状态

### IndexingModule

- 生成 embedding
- 写入向量存储
- 更新索引状态
- 支持 reindex 相关流程

### RetrievalModule

- query 预处理
- 检索 chunks
- metadata filter
- 返回候选结果和 score

### AnsweringModule

- 组装 prompt
- 调用 LLM
- 生成答案和 citations
- 返回标准化响应结构

## 5.3 关键编排服务

### DocumentIngestionOrchestrator

职责：

- 接收文档处理任务
- 串联 parsing -> cleaning -> chunking -> indexing
- 维护文档状态
- 处理失败和重试

### AskAssistantOrchestrator

职责：

- 接收用户提问
- 读取 assistant 和 retrieval profile
- 调用 retrieval
- 调用 answering
- 保存消息
- 保存 trace
- 返回结构化结果

## 5.4 模块依赖规则

允许的依赖方向：

- 对象模块 -> 基础模块
- 流程模块 -> 对象模块
- 流程模块 -> 基础模块

不建议的依赖方向：

- 对象模块之间深度耦合
- 基础模块依赖业务模块
- DocumentsModule 直接依赖 AnsweringModule
- AssistantsModule 直接依赖 VectorStoreModule

核心原则：

- 对象模块负责“是什么”
- 流程模块负责“怎么跑”
- 基础模块负责“怎么接外部世界”

---

## 6. 数据模型最终版

## 6.1 核心对象

一期正式采用以下核心对象：

- Tenant
- User
- KnowledgeBase
- Document
- DocumentChunk
- Assistant
- RetrievalProfile
- Conversation
- Message
- AnswerTrace

## 6.2 对象定义

### Tenant

作用：

- 为未来团队/企业场景预留隔离边界

建议字段：

- id
- name
- status
- created_at
- updated_at

### User

作用：

- 代表资源拥有者或使用者

建议字段：

- id
- tenant_id
- name
- email
- status
- created_at
- updated_at

### KnowledgeBase

作用：

- 知识容器
- 文档归属单位
- 助手绑定对象

建议字段：

- id
- tenant_id
- owner_id
- name
- description
- status
- created_at
- updated_at

### Document

作用：

- 表示原始文档及其处理生命周期

建议字段：

- id
- kb_id
- source_type
- source_name
- title
- mime_type
- storage_key
- status
- processing_stage
- version
- chunk_count
- error_message
- created_at
- updated_at

### DocumentChunk

作用：

- 文档切片后的主业务数据
- 检索结果的核心引用对象

建议字段：

- id
- document_id
- kb_id
- chunk_index
- content
- token_count
- section_title
- page_no
- metadata_json
- embedding_ref
- created_at
- updated_at

### Assistant

作用：

- 面向某个场景的助手配置实体

建议字段：

- id
- tenant_id
- kb_id
- name
- description
- system_prompt
- retrieval_profile_id
- answer_policy_json
- status
- created_at
- updated_at

### RetrievalProfile

作用：

- 定义检索链路策略

建议字段：

- id
- name
- top_k
- chunk_window
- enable_hybrid
- enable_rerank
- score_threshold
- filters_json
- created_at
- updated_at

### Conversation

作用：

- 聊天会话容器

建议字段：

- id
- tenant_id
- user_id
- assistant_id
- title
- status
- created_at
- updated_at

### Message

作用：

- 会话中的单条消息

建议字段：

- id
- conversation_id
- role
- content
- trace_id
- created_at

### AnswerTrace

作用：

- 一次问答执行过程的完整记录
- 用于调试、评测、审计和优化

建议字段：

- id
- conversation_id
- assistant_id
- user_message_id
- assistant_message_id
- user_query
- rewritten_query
- retrieved_chunk_ids_json
- retrieval_scores_json
- citations_json
- model_name
- latency_ms
- status
- error_message
- created_at

## 6.3 对象关系

- 一个 Tenant 下有多个 User
- 一个 User 可以拥有多个 KnowledgeBase
- 一个 KnowledgeBase 下有多个 Document
- 一个 Document 下有多个 DocumentChunk
- 一个 Assistant 绑定一个 KnowledgeBase
- 一个 Assistant 使用一个 RetrievalProfile
- 一个 Conversation 属于一个 Assistant
- 一个 Conversation 下有多条 Message
- 一次助手回答关联一条 AnswerTrace

## 6.4 状态字段建议

### Document.status

- pending
- processing
- ready
- failed

### Document.processing_stage

- uploaded
- parsing
- chunking
- indexing
- completed
- failed

### Assistant.status

- active
- inactive

### Conversation.status

- active
- archived

### AnswerTrace.status

- success
- failed

## 6.5 关键边界

必须守住的 4 个边界：

- KnowledgeBase 和 Assistant 分离
- Document 和 DocumentChunk 分离
- Conversation/Message 和 AnswerTrace 分离
- RetrievalProfile 独立存在

---

## 7. API 最终版

API 设计原则：

- 按资源设计，不按页面设计
- 保持 REST 风格为主
- 对问答动作单独建 action endpoint
- 返回结构统一

## 7.1 Knowledge Base API

- GET /knowledge-bases
- POST /knowledge-bases
- GET /knowledge-bases/:id
- PATCH /knowledge-bases/:id

## 7.2 Document API

- GET /knowledge-bases/:id/documents
- POST /knowledge-bases/:id/documents
- GET /documents/:id
- DELETE /documents/:id
- POST /documents/:id/reindex
- GET /documents/:id/chunks

设计重点：

- 上传成功不等于处理完成
- 上传响应中应返回 document_id、status、processing_stage

## 7.3 Assistant API

- GET /assistants
- POST /assistants
- GET /assistants/:id
- PATCH /assistants/:id

## 7.4 Retrieval Profile API

- GET /retrieval-profiles
- POST /retrieval-profiles
- GET /retrieval-profiles/:id
- PATCH /retrieval-profiles/:id

## 7.5 Conversation API

- GET /conversations
- POST /conversations
- GET /conversations/:id
- PATCH /conversations/:id
- DELETE /conversations/:id

## 7.6 Message API

- GET /conversations/:id/messages

说明：

- 一期不建议开放单独创建 message 的接口

## 7.7 Ask API

- POST /assistants/:id/ask

请求体建议包含：

- question
- conversation_id（可选）
- context（可选）

返回结构建议包含：

- conversation_id
- user_message_id
- assistant_message_id
- trace_id
- answer
- citations
- retrieved_chunks

### citations 每项建议包含

- chunk_id
- document_id
- document_title
- page_no 或 section_title
- snippet

## 7.8 Trace API

- GET /traces/:id
- GET /conversations/:id/traces

---

## 8. 前端页面结构

一期前端以 Web 主端为主，建议只做 4 个核心页面。

### 8.1 聊天页

页面目标：

- 围绕某个助手和知识库提问
- 展示回答
- 展示引用
- 查看历史会话

建议区域：

- 左侧会话区
- 中间聊天主区
- 右侧或下方引用区

关键交互：

- 输入问题并发送
- 展示 loading 状态
- 展示回答和 citations
- 切换历史会话
- 自动或手动创建新会话

### 8.2 文档管理页

页面目标：

- 管理知识库中的文档
- 展示文档处理状态
- 提供重建索引入口

建议包含：

- 上传按钮
- 文档列表
- 文件类型
- 上传时间
- 当前状态
- chunk 数量
- reindex 按钮
- 删除按钮

### 8.3 知识库页

页面目标：

- 让知识库作为独立对象存在
- 展示知识库概况

建议包含：

- 知识库名称
- 描述
- 文档总数
- chunk 总数
- 最近更新时间
- 绑定助手数

### 8.4 助手配置页

页面目标：

- 管理默认助手配置
- 调整问答和检索策略

建议包含：

- 助手名称
- 助手描述
- system prompt
- 绑定知识库
- 绑定 retrieval profile
- 是否强制带引用
- 回答风格
- topK
- chunk window
- score threshold

### 8.5 页面流转

建议主导航：

- Chat
- Documents
- Knowledge Base
- Assistant

用户主路径：

1. 在 Documents 上传文档
2. 等文档进入 ready
3. 在 Chat 中提问
4. 通过 citations 查看来源
5. 在 Assistant 中调整配置

---

## 9. 存储与执行链路结论

## 9.1 数据职责分工

### 主数据库负责

- knowledge base
- document
- document chunk
- assistant
- retrieval profile
- conversation
- message
- trace

### 向量存储负责

- chunk embedding
- 相似度检索
- metadata 辅助过滤

### 文件存储负责

- 原始文档
- 必要时的解析产物
- 临时处理中间文件

## 9.2 文件存储结论

一期建议：

- 原始文档必须保留
- 文件内容独立于数据库存储
- 数据库存文件引用和元数据
- chunk 正文与元数据进主数据库
- 文件存储能力通过 StorageModule 抽象
- 第一版底层可先用本地文件系统

## 9.3 向量存储结论

一期建议：

- 向量存储必须是独立模块
- 由 IndexingModule 和 RetrievalModule 消费
- 不是主数据库
- 必须支持 metadata filter
- 第一版部署可轻量，但接口必须可替换

## 9.4 文档处理链路结论

文档处理链路天然适合异步任务：

- 上传文件
- 创建 Document
- parsing
- cleaning
- chunking
- embedding
- 写入向量索引
- 更新状态

当前已确认：

- 文档处理需要任务机制
- 文档链路异步
- ask 主链路同步

当前尚未最终拍板：

- 队列具体实现

---

## 10. 一期 MVP 完成标准

从系统角度看，一期完成至少应满足：

1. 用户能上传文档，并看到处理状态
2. 文档处理完成后可进入 ready 状态
3. 用户能在聊天页围绕知识库提问
4. 每轮回答默认带引用来源
5. 用户能查看历史会话
6. 系统能保存 trace 并支持排查
7. 用户能通过助手配置页调整基础问答策略

---

## 11. 后续讨论计划

下一步建议继续输出：

- Part 5：开发拆分计划
- 技术拍板清单
- 实现优先级路线图

后续讨论以本文件为基础增量更新，避免上下文重复展开。

---

## 12. Part 5：开发拆分计划

这一部分的目标，是把一期实现拆成可执行阶段，避免一上来并行过多模块导致失控。

开发策略建议：

- 先打通主链路，再补管理能力
- 先做稳定后端骨架，再做前端完整体验
- 先做默认场景闭环，再扩高级配置

## 12.1 阶段总览

建议将一期拆成 6 个阶段：

1. 项目基础骨架
2. 知识库与文档基础链路
3. 文档处理与索引链路
4. 问答主链路
5. 前端 MVP 页面
6. 稳定性与可观测性补全

---

## 12.2 阶段 1：项目基础骨架

目标：

- 建立前后端工程基础
- 定下后端模块结构
- 定下配置、数据库、公共类型边界

建议产出：

- 前端 React 项目初始化
- 后端 NestJS 项目初始化
- docs 设计稿落地
- 后端模块目录搭建
- 配置模块骨架
- 数据库接入骨架
- 统一错误响应结构
- 基础 health/check 接口

本阶段先不追求业务可用，只求结构稳定。

完成标准：

- 前后端项目都能启动
- 后端模块目录和公共基础设施目录已成型
- 可以跑最小健康检查接口

---

## 12.3 阶段 2：知识库与文档基础链路

目标：

- 跑通知识库和文档元数据管理
- 支持上传原始文档并记录状态

建议优先实现：

- KnowledgeBase 数据模型和 API
- Document 数据模型和 API
- 文件上传入口
- StorageModule 基础实现
- Document 状态字段
- 文档列表和详情查询

此阶段重点：

- 文档原件必须能保存
- 上传成功后能创建 Document 记录
- 能从 API 层看到状态和元数据

完成标准：

- 可以创建默认 knowledge base
- 可以上传文档
- 可以查询文档列表和详情
- 数据库中已有 document 元数据记录
- 原始文件已进入文件存储

---

## 12.4 阶段 3：文档处理与索引链路

目标：

- 让上传的文档真正进入可检索状态

建议优先实现：

- ParsingModule 基础解析能力
- IngestionModule 基础编排
- chunking 逻辑
- DocumentChunk 数据模型
- EmbeddingModule 抽象
- VectorStoreModule 抽象
- IndexingModule 基础写入链路
- 文档状态流转

本阶段建议只支持少数文件类型，例如：

- Markdown
- TXT
- PDF

当前状态补充（2026-03-21）：

- Markdown / TXT / text-based PDF 已可用
- chunking 已补第一版长度控制与超长段切分

本阶段不必追求复杂 retrieval，只要能完成“文档 -> chunk -> embedding -> 索引”闭环。

完成标准：

- 文档可从 uploaded/processing 进入 ready
- 失败时能记录错误信息
- chunk 能落主数据库
- embedding 和向量写入链路跑通

---

## 12.5 阶段 4：问答主链路

目标：

- 基于 assistant 完成可用的 RAG 问答闭环

建议优先实现：

- Assistant 数据模型和 API
- RetrievalProfile 数据模型和 API
- RetrievalModule 基础检索能力
- AnsweringModule 基础回答能力
- Conversations 和 Messages 数据模型
- Traces 数据模型
- AskAssistantOrchestrator
- POST /assistants/:id/ask

本阶段重点：

- 返回 answer
- 返回 citations
- 保存 conversation/message
- 保存 trace

完成标准：

- 用户能围绕某个助手提问
- 系统能返回带引用的答案
- 会话和消息能保存
- trace 可查询

---

## 12.6 阶段 5：前端 MVP 页面

目标：

- 提供一套最小可用的产品界面

建议优先实现页面：

- Chat
- Documents
- Knowledge Base
- Assistant

建议优先实现的前端能力：

- 文档上传与状态展示
- 聊天问答
- 历史会话切换
- citations 展示
- 助手配置修改

本阶段不追求视觉复杂度，先保证信息结构清楚和交互闭环完整。

完成标准：

- 用户可以通过 UI 上传文档
- 用户可以在 UI 中提问并看到引用
- 用户可以查看历史会话
- 用户可以修改基础助手配置

---

## 12.7 阶段 6：稳定性与可观测性补全

目标：

- 提高系统可调试性和可维护性

建议补充：

- trace 详情查询接口
- 文档处理失败的可见错误信息
- ask 失败时的标准错误结构
- 重建索引入口
- 基础日志规范
- 超时与异常处理
- 一些最基本的测试

本阶段不要求企业级监控平台，但至少要能支持自我排查。

完成标准：

- 主要失败路径可定位
- 文档处理失败可看到原因
- ask 失败可查 trace 或日志
- reindex 能重新执行文档处理流程

---

## 12.8 建议的实现顺序

如果按最稳妥顺序推进，建议是：

1. 后端骨架
2. 数据模型和数据库迁移
3. 文档上传与元数据管理
4. 文档处理与索引
5. ask 主链路
6. 前端页面
7. trace 和稳定性补全

原因：

- 没有文档和索引，问答没有真实价值
- 没有 ask 主链路，前端聊天页只是空壳
- 没有 trace，后面调优会很盲

---

## 12.9 可以并行的部分

后续如果要并行推进，建议这样拆：

### 一组

- 后端基础骨架
- 数据模型收口

### 二组

- 文档管理 API
- 前端文档管理页

### 三组

- ask API
- 前端聊天页

### 四组

- assistant/retrieval profile 管理
- 前端配置页

需要注意：

- 文档处理链路和 ask 链路最好不要同时无约束并行乱改
- VectorStore、Storage、Queue 这类基础设施抽象应尽量先稳定

---

## 12.10 一期最小里程碑

建议设置 3 个里程碑。

### 里程碑 1：文档进入 ready

表示：

- 文档上传成功
- 文档被解析
- chunk 已生成
- 索引已写入

当前状态补充（2026-03-21）：

- 已完成
- 第一版索引当前为本地 file-backed vector store

### 里程碑 2：带引用问答可用

表示：

- ask 接口跑通
- 前端能展示回答
- citations 可查看
- conversation/message/trace 已落库

当前状态补充（2026-03-21）：

- 已完成后端主链路
- 已完成本地联调验证
- trace 中已保留 retrieval score、citation 和 modelName
- 第一版 answer prompt 已支持 inline source marker

测试状态补充（2026-03-21）：

- 最小测试底座已建立
- 当前已覆盖 parsing / chunking / retrieval window / answering citation
- 已补第一条 upload -> ready -> ask -> trace HTTP 集成测试
- 仍待补更完整的链路级 E2E

### 里程碑 3：MVP 可持续调试

表示：

- reindex 可用
- trace 可查
- 失败路径可定位
- assistant 配置可调整

---

## 12.11 暂不纳入一期的内容

为了控制复杂度，一期明确不纳入：

- 多租户完整实现
- 团队协作与权限体系
- 法务/医疗专用合规工作流
- 多模型路由
- 复杂 hybrid/rerank 编排
- 插件系统
- 多端原生适配
- 企业级监控与审计后台

---

## 12.12 开工前仍需统一拍板的事项

虽然整体设计已基本成型，但正式开始写代码前，仍建议统一拍板以下内容：

- ORM 最终选择
- 队列最终实现
- 向量存储第一版实现
- 文件存储第一版实现
- 前端具体 UI 技术配套
- 后端测试策略基础方案

这些拍板完成后，就可以进入真正的项目初始化与编码阶段。

---

## 13. 技术拍板清单

这一部分用于在正式开工前，把尚未最终确定的技术项统一收口，避免实现过程中反复摇摆。

## 13.1 已基本确定的技术方向

以下方向可以视为当前默认结论：

- 前端：React
- 后端：NestJS
- 运行时：Node.js
- 校验：Zod
- 主数据库：PostgreSQL
- 架构：前后端分离，后端单体模块化
- 文档链路：异步
- ask 主链路：同步

---

## 13.2 待拍板项总表

当前仍需最终拍板的内容包括：

1. ORM
2. 队列
3. 向量存储第一版实现
4. 文件存储第一版实现
5. 前端 UI 技术配套
6. 后端测试策略

---

## 13.3 ORM 拍板建议

### 当前备选

- Prisma
- Drizzle

### 推荐顺序

- 默认推荐：Prisma
- 明确偏好 schema-first + SQL-first 时再考虑 Drizzle

### 推荐 Prisma 的原因

- 一期更稳
- 上手快
- 社区成熟
- 更适合先把系统主链路跑通
- 降低初期 ORM 学习和维护成本

### 选择 Drizzle 的前提

仅在以下条件下优先考虑：

- 非常明确追求 schema-first 一体化
- 团队对 SQL-first 风格更接受
- 愿意承担更多显式查询设计工作

### 最终结论

一期 ORM 正式采用：**Prisma**

---

## 13.4 队列拍板建议

### 当前结论

- 需要任务机制
- 文档链路必须异步
- ask 主链路保持同步

### 备选方向

- 应用内后台任务
- Redis 队列

### 建议优先级

- 默认推荐：Redis 队列
- 如果一期要极简启动，可短期使用应用内任务机制，但后续大概率需要替换

### 推荐 Redis 队列的原因

- 更适合文档处理这种后台任务
- 支持重试
- 更容易做并发控制
- 更符合后续平台化方向
- API 服务和 worker 拆分更自然

### 最终结论

一期队列方向正式采用：**Redis 队列**

说明：

- 当前先锁定 Redis 队列方向
- 具体库名与接入方式可在实现准备阶段确定

---

## 13.5 向量存储第一版实现拍板建议

### 当前结论

- 向量存储必须独立抽象
- 不作为主数据库
- 必须支持 metadata filter
- 第一版实现可以轻量化

### 备选思路

- 轻量实现，优先落地
- 独立重型向量基础设施，优先长期扩展

### 最终结论

一期向量存储正式采用：

- **轻量实现**
- **独立抽象**
- **后续可替换**

拍板标准：

- 本地开发足够顺手
- 与 NestJS 模块边界契合
- 支持基于 kb_id、document_id 等做 metadata filter
- 不将业务主数据放进向量存储

---

## 13.6 文件存储第一版实现拍板建议

### 当前结论

- 原始文档必须保留
- 文件内容独立于数据库存储
- 通过 StorageModule 抽象

### 备选方向

- 本地文件系统
- 对象存储

### 最终结论

一期文件存储正式采用：**本地文件系统**

前提：

- 必须通过 StorageModule 做抽象
- 不允许业务代码直接拼接底层路径逻辑

后续可平滑替换为对象存储。

---

## 13.7 前端 UI 技术配套拍板建议

### 当前已知

- 前端使用 React
- 一期先做 Web
- 未来可能扩 H5、桌面端

### 拍板时关注点

- 路由方案
- 数据请求方案
- 表单方案
- 样式方案
- 状态管理策略

### 最终结论

一期前端 UI 技术配套正式采用：

- React Router 负责路由
- TanStack Query 负责服务端状态和数据请求
- React Hook Form 负责表单
- Mantine 作为前端 UI 组件库
- 样式采用 Mantine + 少量自定义主题
- 全局状态保持轻量，不默认引入重状态管理框架

选择原则：

- 生态成熟
- 与多页面管理后台和内容平台相容
- 不引入过重状态框架
- 便于后续拆成桌面壳
- 优先页面信息结构清楚和可维护性

---

## 13.8 后端测试策略拍板建议

一期不需要追求“测试体系完美”，但至少需要明确最基本策略。

### 建议覆盖层级

- schema / utility 的单测
- 核心 orchestrator 的集成测试
- ask 主链路的最小端到端验证
- 文档处理链路的最小端到端验证

### 不建议的一期做法

- 一上来给所有 CRUD 全补大量模板化测试
- 过度依赖 mock，导致无法验证真实链路

### 最终结论

一期后端测试策略正式采用：

- schema / utility 做单测
- 核心 orchestrator 做集成测试
- 文档处理链路做最小端到端验证
- ask 主链路做最小端到端验证
- 不追求对所有简单 CRUD 做模板化全覆盖

优先保证：

- 文档进入 ready 的主链路可验证
- ask 返回 answer + citations 的主链路可验证
- reindex 和失败路径至少有最基本验证

---

## 13.9 开工前最终确认清单

真正开始编码前，建议逐项确认以下内容：

- ORM 采用 Prisma
- 队列采用 Redis 方案
- 向量存储采用轻量实现 + 独立抽象
- 文件存储采用本地文件系统 + StorageModule 抽象
- 前端基础技术配套已确认
- 最小测试策略已确认

如果以上 6 项确认完毕，就可以正式进入项目初始化和编码阶段。

---

## 14. 项目初始化方案与仓库结构

## 14.1 仓库形态结论

一期正式采用：**轻量 monorepo**

设计原则：

- 一个仓库统一管理前端、后端和设计文档
- 前后端分目录
- 共享内容保持克制
- 不做过重的平台化 monorepo 编排
- 基于 pnpm workspace 管理依赖和应用

采用 monorepo 的原因：

- 前后端会高频联动演进
- API 契约和页面结构需要一起推进
- docs 需要与代码共存
- 后续可能扩展到 H5 和桌面端
- 可以容纳少量共享类型和脚本

包管理与工作区结论：

- 包管理器：pnpm
- 工作区模式：pnpm workspace

## 14.2 顶层目录建议

建议目录结构：

```text
rag-system/
  docs/
  apps/
    web/
    api/
  packages/
    shared/
  scripts/
  pnpm-workspace.yaml
  .env.example
  package.json
```

说明：

- `docs/`
  放设计稿、决策记录、架构说明

- `apps/web/`
  React 前端应用

- `apps/api/`
  NestJS 后端应用

- `packages/shared/`
  放少量前后端可能共用的常量、辅助类型、schema helper

- `scripts/`
  放项目级脚本

## 14.3 前端目录建议

建议结构：

```text
apps/web/
  src/
    app/
    pages/
    features/
    components/
    lib/
    hooks/
    styles/
    types/
```

职责建议：

- `app/`
  路由入口、应用壳、provider 组织

- `pages/`
  页面级入口，例如 chat、documents、knowledge-base、assistant

- `features/`
  业务功能模块，例如 conversation、document-upload、citations、assistant-config

- `components/`
  通用 UI 组件

- `lib/`
  请求封装、query client、工具函数

- `hooks/`
  通用 hooks

- `styles/`
  全局样式和主题

- `types/`
  前端本地类型定义

## 14.4 后端目录建议

建议结构：

```text
apps/api/
  src/
    main.ts
    app.module.ts
    common/
    modules/
      knowledge-bases/
      documents/
      assistants/
      retrieval-profiles/
      conversations/
      messages/
      traces/
      ingestion/
      indexing/
      retrieval/
      answering/
    infra/
      database/
      storage/
      vector-store/
      llm/
      embedding/
      parsing/
      queue/
```

说明：

- `common/`
  放公共错误、统一响应结构、配置辅助、少量基础类型

- `modules/`
  放业务对象模块和流程能力模块

- `infra/`
  放所有外部依赖适配层

## 14.5 shared 包使用原则

一期对 `packages/shared/` 的使用必须克制。

适合放：

- API 通用常量
- 少量跨端共享类型
- 通用 schema helper
- 一些状态常量

不适合放：

- 大量业务逻辑
- 前后端强耦合实现
- 为共享而共享的复杂抽象

原则：

- shared 先小
- 先保证应用边界清楚
- 后续真正需要时再逐步扩充

## 14.6 初始化实施顺序

建议初始化时按下面顺序执行：

1. 建立轻量 monorepo 顶层结构
2. 初始化 `apps/api`
3. 初始化 `apps/web`
4. 建立 `docs/` 与现有蓝图文档
5. 预留 `packages/shared/`
6. 建立统一脚本和环境变量模板

这样做可以保证：

- 先有稳定目录骨架
- 再进入各应用实现
- 不会在实现中途反复搬目录
