# RAG 项目下一步计划

> 文档角色：`current-primary`
> 当前使用方式：当前阶段任务方向、优先级判断、superpowers 使用方式、AI review 策略，以本文档为主；`docs/current-progress.md` 主要承担进度记录和完成状态同步。

更新时间：2026-03-29

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

### Queue 排序原则

适用范围：当前 queue 和后续同类任务。

排序规则：

1. 先处理阻塞后续改动的项：契约不统一、验证太慢、共享边界不清
2. 再处理 read-model / fallback / compatibility 这类收尾项
3. 最后处理环境摩擦、文档整理、纯优化项

补充规则：

- 本次只重排现有 queue，不在本次整理中增删任务；后续新增任务按正常 queue 流程加入
- 队列优先按依赖关系和阻塞风险排序，不按创建时间排序
- 一次只推进一个主主题，保持单线执行

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

### P1：鉴权 / 用户登录（已收口）

`P0` 收口完成后，当前最合适的下一条主线不再是继续扩 external source，也不是直接展开企业化全家桶，而是先补齐 **鉴权 / 用户登录的最小闭环**。

当前阶段建议先收口：

- 先做最小身份闭环，而不是一次性做完整企业体系
- 继续保持 `backend / API first`
- 先锁定“谁在调用系统、请求身份如何传递、默认数据归属如何表达”
- 先做可验证的最小 session / identity contract，再接页面承载
- 为后续 `ACL / 文档权限` 预留稳定身份边界，但本轮不把 ACL 和多租户一起打包推进

当前这一轮明确不做：

- 不直接展开多租户隔离
- 不直接展开完整企业成员/组织体系
- 不把鉴权波次扩成通用 IAM 平台重构
- 不顺手重写现有 retrieval / answering / trace 主链路
- 不因为登录接入而并行开启大范围 UI 改版

建议的切入顺序：

1. 明确当前最小身份模型与默认单用户/单工作区假设
2. 收口 API 侧认证入口、身份注入与最小未登录保护
3. 补齐 web 侧登录态承载与最小路由保护
4. 用 focused validation 锁住 auth/login 最小闭环
5. 完成后再进入 `ACL / 文档权限`

#### P1 queue-ready tasks

下面这些小任务建议直接作为 `P1` 的 queue-ready 拆解来源；写进 queue 时可再压成更短 title。

1. 定义 auth identity contract
   - 目标：统一当前请求身份语义，不再让业务路径继续散落 `default-user` 或临时身份口径
   - 建议最小字段：`userId`、`tenantId`、`sessionId`、`authSource`
   - 要求：业务 service 依赖 identity contract，而不是直接依赖 cookie / token / OIDC 细节
   - 当前代码对照点：`apps/api/src/modules/assistants/ask-assistant.service.ts` 仍在创建 conversation 时写死 `default-user`
   - 交付物：一处统一类型/上下文约定 + 最小文档说明

2. 收口 session persistence 最小模型
   - 目标：先支持最小 session 登录闭环，同时不给后续 provider 替换或审计扩展制造死角
   - 建议至少考虑：`id`、`userId`、`expiresAt`、`revokedAt`、`lastSeenAt`
   - 当前阶段不要求一次把所有 session 管理能力做满
   - 交付物：最小可用 session persistence 方案（含 schema / migration / seed 影响评估）

3. 建立 auth provider boundary
   - 目标：把“如何从请求里解析登录态”封成单独边界
   - 当前推荐首个实现：`session cookie provider`
   - 要求：后续可替换到 bearer token / OIDC，而不把业务层一起重写
   - 交付物：provider 接口 + 当前最小 provider 实现

4. 注入 request auth context
   - 目标：在 API 入口统一完成 identity 注入，后续受保护接口复用同一条路径
   - 要求：未登录状态可被稳定识别；已登录状态能稳定解析出当前 identity
   - 交付物：middleware / guard / request helper 中的一种最小稳定落点

5. 增加 auth API 最小闭环
   - 建议最小接口：`POST /auth/login`、`POST /auth/logout`、`GET /auth/me`
   - 目标：先打通登录、退出、当前身份读取，不展开更大的账号体系
   - 要求：`/auth/me` 返回稳定 identity 结构，而不是只返回裸 `userId`
   - 交付物：controller + service + focused tests

6. 替换硬编码 identity 的业务写入路径
   - 目标：优先清掉最关键路径里的硬编码身份
   - 重点先看：conversation 创建、assistant ask 主链路
   - 当前代码对照点：`apps/api/src/modules/assistants/ask-assistant.service.ts`
   - 交付物：从 request identity 派生 `userId` / `tenantId`，不再写死 `default-user`

7. 收口 conversation identity scoping
   - 目标：会话列表、详情、消息、trace 等读取开始按当前 identity 收口
   - 当前代码对照点：`apps/api/src/modules/conversations/conversations.controller.ts`、`apps/api/src/modules/conversations/conversations.service.ts`
   - 要求：先做当前用户范围，不在本轮扩成完整 ACL 系统
   - 交付物：最小用户隔离行为 + focused regression tests

8. 对齐 owner / tenant 写入路径
   - 目标：为后续 ACL 做准备，让新增或收口过的核心资源写入统一走 current identity
   - 重点关注：`ownerId`、`tenantId`、conversation `userId`
   - 当前代码对照点：`apps/api/prisma/schema.prisma` 已有 `Tenant` / `User` / `KnowledgeBase.ownerId` / `Conversation.userId`
   - 交付物：最小 ownership alignment，不引入角色矩阵

9. 建立 route policy baseline
   - 目标：先把接口分成 `public` 和 `authenticated` 两层，而不是一步到位做复杂权限矩阵
   - 要求：表达方式可继续扩展到后续 ACL / role / policy
   - 交付物：最小受保护接口清单 + 对应 guard 接入

10. 补 web auth bootstrap
    - 目标：web 启动时能够恢复当前 identity，并与 API `/auth/me` 对齐
    - 要求：web 侧只消费统一 identity contract，不自造并行状态语义
    - 交付物：最小 auth store / bootstrap 逻辑

11. 补 web login / logout flow
    - 目标：提供最小登录页、退出入口、未登录分流
    - 要求：保持当前 PC Web 既有视觉语言，不展开大范围 UI 重构
    - 交付物：最小可用页面承载 + focused frontend validation

12. 补 auth 文档与验证口径
    - 目标：把默认开发登录方式、seed 用户、验证命令、未做项写清楚
    - 重点更新：`docs/current-dev-setup.md`、`docs/current-progress.md`
    - 交付物：文档对齐记录 + 最小复用验证命令清单

#### P1 当前实现对齐（2026-03-29）

- ✅ 已完成并与当前实现对齐：task `1~11`
  - 已有最小 identity contract、session persistence、provider boundary、request auth context
  - 已有 `POST /auth/login`、`POST /auth/logout`、`GET /auth/me` 最小闭环
  - ask/conversation/knowledge-base 写入与读取路径已按 current identity 收口（保持 ACL-ready baseline，不在本轮展开角色矩阵）
  - web 侧已完成 auth bootstrap + login/logout + 最小路由保护
- ✅ auth provider wave 也已完成到当前既定边界：`GitHub` / `Google` / real `OIDC` 均已落地为 `AuthIdentityLink(provider, subject) -> 本地 AuthSession(rag_session)` 的 provider-session bridge
  - 当前登录入口与 `/auth/me.loginProvenance` 已能区分本地会话与 OAuth/OIDC provider 会话
  - 本轮仍保持边界不变：不展开账号管理体系、不引入 provider token 前端会话模型、不重开 ACL 扩面
- ✅ task `12`（auth 文档与验证口径）本次同步完成
- ⏭️ `P1` auth/login 与后续 provider wave 已可视为收口；鉴权后续默认只做必要 docs/setup/ops 对齐，不再作为当前主线继续扩波次

#### Auth/Login wave focused validation baseline

推荐复用以下最小验证命令（按本轮已落地路径对齐）：

- `pnpm test:api:file -- test/auth-provider-boundary.test.js`
- `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/conversations.service.test.js test/ask-success.test.js test/ask-stream-service.test.js`
- `pnpm test:api:file -- test/knowledge-bases-auth-write-path.test.js`
- `pnpm --filter @rag-system/web build`

建议直接用于 queue title 的短标题版：

- `auth identity contract`
- `session model baseline`
- `auth provider boundary`
- `request auth context`
- `auth login/logout/me`
- `auth service identity wiring`
- `conversation identity scoping`
- `ownership alignment`
- `auth route policy baseline`
- `web auth bootstrap`
- `web login flow`
- `auth docs sync`

### P2：ACL / 文档权限（下一条主线）

`ACL / 文档权限` 应放在 auth/login 之后，而不是并行大面积展开。

进入这一波次前，默认前提应为：

- 已有稳定的身份来源
- 请求上下文里已有可消费的 user identity
- web 侧已有最小登录态和未登录分流

这一波次优先解决：

- 哪些资源需要 owner / creator / visible scope
- 文档、知识库、assistant 等核心对象的最小访问边界
- 默认拒绝还是默认允许的策略口径

#### P2 queue-ready tasks

1. 盘点核心资源的权限边界
   - 目标：先列清哪些对象需要 owner / visible scope / share boundary
   - 重点对象：knowledge base、document、assistant、conversation、trace
   - 交付物：一份最小资源-权限矩阵草案
   - 对应 queue title：`resource access matrix`

   当前代码盘点快照（2026-03-29，P2 task 1 补充：最小 ACL 边界矩阵，additive / behavior-preserving）：

   | 资源 | owner | member | viewer | public | 当前实现落点（按现有代码） | 当前 gap（下一步 ACL） |
   | --- | --- | --- | --- | --- | --- | --- |
   | knowledge base | 可读写本人 `tenantId + ownerId` 资源 | 本轮先不放开（默认拒绝） | 本轮先不放开（默认拒绝） | 不公开 | `KnowledgeBasesController/Service` 已走 authenticated + owner-only（list 过滤 owner，get/update 用 `evaluateOwnerResourceAccess`） | 尚未引入 member/viewer 可见范围；未有 share 语义 |
   | document | 继承所属 knowledge base 的 owner 边界（可读写） | 本轮先不放开（默认拒绝） | 本轮先不放开（默认拒绝） | 不公开 | `DocumentsController/Service` 所有入口都传 current identity；读写前统一经 `getKnowledgeBase/getDocument` 复用 KB owner 校验 | 文档级 share/role 规则尚未独立定义；目前是 KB owner-only 继承模型 |
   | assistant | 可读写本人 KB 下 assistant，并可发起 ask/stream | 本轮先不放开（默认拒绝） | 本轮先不放开（默认拒绝） | 不公开 | `AssistantsController/Service` 已走 authenticated + owner-only（基于 assistant.knowledgeBase owner 校验）；ask/ask-stream 也复用同一 identity 边界 | 未定义 assistant 级 member/viewer 协作边界 |
   | conversation | 当前 owner 可读（list/detail/messages/traces），创建写入 current identity | 本轮先不放开（默认拒绝） | 本轮先不放开（默认拒绝） | 不公开 | `ConversationsController/Service` 已按 `tenantId + userId` 收口；ask 创建会话写入 current identity | 无 share conversation 语义；member/viewer 角色尚未接入 |
   | trace | 当前 owner 可读（conversation 下与 direct `/traces` 均按 conversation owner scope） | 本轮先不放开（默认拒绝） | 本轮先不放开（默认拒绝） | 不公开 | `TracesController/Service` list/get 已按 `conversation(tenantId,userId)` 过滤；`/conversations/:id/traces` 先校验 conversation scope | trace 独立授权模型（如跨会话分享）尚未定义 |

   角色与可见性边界（最小定义）：

   - owner：当前唯一已实现角色边界，口径为 `owner_only_v1 + deny_by_default`。
   - member：已存在 `AuthIdentity.role = member` 形状，但 ACL 决策尚未使用 role 放权。
   - viewer：当前仅作为后续规划角色，尚无持久化或策略执行路径。
   - public：上述五类核心资源均不公开；仅认证后可访问业务路由。

   配套约束快照（与上表一起作为 ACL 起点）：

   - 认证中间件会注入 `authContext`；`@AuthenticatedRoute()` 由 guard 强制要求真实 session identity。
   - 上述五类业务控制器目前均已标注 `@AuthenticatedRoute()`；默认不走 public 访问面。
   - 在开发环境若启用 `AUTH_DEV_DEFAULT_USER_MODE`，未登录请求会回落到 `dev_seed` identity；该行为是开发便捷路径，不是 ACL 放权语义。

   最小实现计划（concise）：

   1. 固化 owner-only 语义：保持五类资源继续复用当前 owner scope，不改现有行为边界。
   2. 抽象 role 可见矩阵：先在 contract/doc 明确 member/viewer 仅为 `planned-deny`，避免隐式放权。
   3. 逐资源补 member/viewer 的显式 deny 回归用例（先 contract/service 层，不扩展 UI）。
   4. 待 deny 基线稳定后，再按资源顺序引入最小 share scope（建议 KB/document → assistant → conversation/trace）。

   focused validation ideas：

   - `pnpm test:api:file -- test/resource-access-policy.contract.test.js`
   - `pnpm test:api:file -- test/knowledge-bases-auth-write-path.test.js test/kb-document-access.test.js`
   - `pnpm test:api:file -- test/assistants-api.test.js test/traces.service.test.js`

2. 定义 resource access policy contract
   - 目标：统一 service 层如何表达“可访问 / 不可访问 / 原因”
   - 要求：不要把权限判断散落在 controller 和页面里
   - 交付物：一处统一 policy/guard/service contract
   - 对应 queue title：`access policy contract`

3. 收口 knowledge base / document ownership checks
   - 目标：先把最关键资源的 owner 校验跑通
   - 范围：列表、详情、写入入口至少先有最小边界
   - 交付物：最小 owner-based access checks + focused tests
   - 对应 queue title：`kb document ownership checks`

4. 收口 assistant / conversation / trace access checks
   - 目标：把问答链路关联资源也纳入同一边界口径
   - 要求：trace 和 conversation 不能继续只靠“知道 id 就能看”
   - 交付物：关联资源访问边界收口 + focused tests
   - 对应 queue title：`assistant conversation trace checks`

5. 定义默认策略口径
   - 目标：明确当前阶段哪些接口默认拒绝，哪些保留公开
   - 要求：文档和实现口径一致
   - 交付物：默认允许/默认拒绝策略说明 + 最小实现
   - 对应 queue title：`default access policy`

   当前 ACL wave 默认口径（2026-03-29，对齐 `owner_only_v1` contract）：

   - 核心资源默认可见性：`knowledge base`、`document`、`assistant`、`conversation`、`trace` 均为 `private`（默认不公开）。
   - 保留 public 的仅是公共 auth/health surface（如 `GET /health`、`POST /auth/login`、`POST /auth/logout`），不是业务资源公开可见。
   - 新资源创建时的可见性继承规则（contract baseline）：
     - `knowledge base` / `conversation`：`explicit_private`（即使存在 public parent 语义输入，也默认保持 private）
     - `document` / `assistant`：`inherit_from_knowledge_base`
     - `trace`：`inherit_from_conversation`
   - 在当前实现下，由于父资源 baseline 仍为 private，继承结果也保持 private；该继承规则仅用于后续 share/public 波次时避免语义漂移。

6. 补 ACL 基线文档与回归验证
   - 目标：记录当前 ACL 第一轮只做到 owner-based baseline，不扩成完整 RBAC/ABAC
   - 交付物：文档同步 + focused regression 命令
   - 对应 queue title：`acl baseline docs`

   ACL closeout 文档口径（当前快照）应继续保持：

   - owner-only baseline 作为当前唯一已实现访问语义：`owner_only_v1 + deny_by_default`。
   - denial paths 记录为“已验证且可复现”的最小集合：
     - unauthenticated → `401`（含 owner-scoped business routes 与 assistant ask/ask-stream）
     - owner-mismatch → `403`（含 ask/ask-stream 在 stream 启动前的拒绝返回）
     - KB/document 与 trace 关联路径继续按 owner scope 拒绝非 owner 访问
   - 明确后置项保持不变：member/viewer 放权、share/public 业务资源可见性、RBAC/ABAC 角色矩阵、跨 tenant 协作。
   - 范围仅限文档和验证基线同步，不改变运行时 ACL 行为。

当前这组 `P2` queue-ready 项已按上述顺序整理，可直接写入 `.opencode/loop/queue.json` 继续单线推进。

#### P2 owner-only ACL baseline closeout（2026-03-29）

- ✅ 当前 `owner_only_v1 + deny_by_default` 基线可视为已收口（按既定 `P2` queue 顺序完成）
  - 已完成：`resource access matrix`、`access policy contract`、`kb document ownership checks`、`assistant conversation trace checks`、`default access policy`、`acl baseline docs`
  - 已落地语义：五类核心资源（knowledge base / document / assistant / conversation / trace）维持 owner-scoped private baseline，拒绝路径维持 `unauthenticated -> 401`、`owner-mismatch -> 403`
- ⏸️ 本轮明确后置（保持不变，不在本次 closeout 内展开）：
  - `member/viewer` 放权
  - share/public 业务资源可见性扩展
  - RBAC/ABAC 角色矩阵
  - 跨 tenant 协作
- 边界说明：本次仅标记 owner-only baseline closeout，不新开 ACL wave，不调整 roadmap 顺序（仍按 `P2 -> P3 -> P5 -> P6 -> P4` 串行推进）。

建议直接用于 queue title 的短标题版：

- `resource access matrix`
- `access policy contract`
- `kb document ownership checks`
- `assistant conversation trace checks`
- `default access policy`
- `acl baseline docs`

### P3：external knowledge source follow-up（后续新波次）

如果后续继续推进 external knowledge source，应视为 auth/ACL 主线之后的独立后续增量，而不是当前波次未完成残项。

后续如重开该方向，仍优先保持：

- `backend / API first`
- source stabilization 优先于 source 类型横向扩张
- diagnostics / retry / re-sync / dedup guards / execution boundaries 优先
- 继续复用既有 document creation / ingestion / indexing 主链路

当前不建议把它重新拉回当前主线的原因：

- 当前 source family 已在现有范围内完成 backend / API 收口
- auth/login 与后续 ACL 更直接影响系统边界与后续可扩展性
- external source 后续扩展更适合在身份边界稳定后继续推进

#### P3 stability boundary snapshot（repro baseline）

当前 external source follow-up wave 以“现有 source family 稳定性补强”为边界，不扩展新能力面：

- in-scope source family（保持不变）：`web page`、`feed (RSS/Atom)`、`sitemap/urlset`、`sitemapindex(一层)`、以及对应 `external_resync`
- source-expansion decision（当前波次）：`keep`（不新增 source family；仅在现有稳定性基线收口并通过 focused baseline 后再重评）
- in-scope 稳定性语义（保持不变）：
  - source fetch `timeout + retry` 基线
  - same-URL document reuse + version 递增
  - stale run skip guard
  - run history/list/summary observability（含 failure/retryable/boundary anchors）
- 明确保持当前失败边界：
  - nested sitemapindex 仍按不支持处理（保持当前失败语义）
  - `MAX_CHILD_SITEMAPS=20` 仍是实现常量（本波次不做 per-source 动态配置）
  - web page 仍按静态 HTML 提取，不引入动态渲染抓取

#### P3 intentionally deferred（本波次明确后置）

- 新 source family 扩展（connector 扩面）
- web page JS 渲染抓取能力
- 跨 source family 的全面错误码体系重构
- source 平台化/插件化重构（保持现有主链路与契约）

#### P3 queue-ready slices（accepted）

当前 follow-up 的 queue-ready 最小切片保持为 5 个（按当前建议顺序）：

1. `source follow-up gap list`
2. `source diagnostics consistency`
3. `source resync recovery guards`
4. `new source type review`
5. `source follow-up docs`

约束说明：以上切片仅用于现有 source family 稳定性补强；不在本波次引入新 source family 或平台化重构。

#### P3 queue-ready tasks

1. 盘点当前 source family 的后续缺口
   - 目标：区分“稳定性补强”与“新增 source 类型”
   - 要求：先列 gap，再决定是否扩面
   - 交付物：最小 follow-up gap list

   当前代码盘点快照（2026-03-29，P3 task 1 最小增量，仅限现有 source family）：

   | source family | 当前已收口范围 | concrete missing edges（后续补强优先） |
   | --- | --- | --- |
   | web page | 单 URL 抓取、重试/超时、redirect 跟随与诊断、`text/plain/unknown + html sniff` 容错已具备；content-type fallback 路径已带最小 partial diagnostics | 1) 仍是纯静态 HTML 提取（`WebPageService.extractFromHtml`），JS 渲染内容为空时会直接失败；2) 目前 partial diagnostics 主要覆盖 fetch/content-type fallback，缺少“正文提取质量/正文缺失”粒度信号 |
   | feed (RSS/Atom) | RSS/Atom 抓取、entry 级 partial failure/duplicate diagnostics、content-type fallback、重试与 dedup 已具备 | 1) 仅支持 RSS/Atom XML（`Unsupported feed format`），不支持其他 feed 表达；2) 当 entry 无 link 时，dedup 仍退化到 `title+publishedAt+summary`，metadata 漂移下仍可能重复入库 |
   | sitemap / sitemapindex | `urlset` + 一层 `sitemapindex`、子 sitemap 与 page 级 partial diagnostics、maxPages/maxChildSitemaps 边界与 dedup 已具备 | 1) 明确不支持 nested sitemapindex（子项再指向 index 会失败）；2) `MAX_CHILD_SITEMAPS=20` 当前是代码常量，不支持按 source 配置细粒度调节 |
   | external re-sync（现有 family） | same-URL document reuse + version 递增、stale run guard、run history/summary、source-level diagnostics 基线已具备；legacy config recovery 已覆盖 `web_page` / `feed` / `sitemap`（含 config 丢失与 feed/sitemap 边界默认值回退） | 1) 对不可恢复配置异常仍统一落到 `EXTERNAL_SOURCE_CONFIG_INVALID`，跨 family 的错误 code/readability 映射口径仍可继续收敛；2) source-level diagnostics 字段在跨 family 对齐上仍有细粒度差异 |

   稳定性补强（现有 source family 内，当前剩余 safe gaps 优先）：

   1) source fetch：收口 retry / timeout diagnostics 一致性（不改抓取语义）
   2) web page：补最小正文质量/正文缺失可读信号（不引入 JS 渲染抓取）
   3) external re-sync：收口跨 family 的 diagnostics / error-code 可读性一致性

   扩面候选（后置，非当前最小缺口）：

   - 新增 source family（在上面稳定性项收口前不启动）
   - web page 动态渲染抓取能力（属于能力扩展，不是现有 baseline 稳定性修补）

   最小 follow-up gap list（按当前 micro-wave 剩余 safe gaps 刷新）：

   - `source retry/timeout diagnostics consistency`
   - `web page body-quality diagnostics`
   - `external resync diagnostics/error-code consistency`

2. 补 source retry / timeout / diagnostics 一致性
   - 目标：继续优先做 execution boundary、重试、错误可读性，而不是先铺新 connector
   - 交付物：focused backend consistency increment + tests

3. 收口 source re-sync / dedupe / recovery 边界
   - 目标：继续锁住 repeated sync、same-URL recovery、版本边界的一致性
   - 交付物：focused regression tests + 必要实现补强

4. 评估是否需要新增 source 类型
   - 目标：只有在前面稳定性项收口后，才考虑新的 source family
   - 要求：不把当前系统扩成 generic connector platform
   - 交付物：明确的保留/新增结论

   P3 task 4 评估结论（2026-03-29）：**keep（当前不新增 source family）**。

   - 结论口径：在当前稳定性项已收口前提下，继续保持现有 source family（`web` / `feed` / `sitemap` / `sitemapindex(一层)`），不进入新增 connector 扩面。
   - 主要依据：
     1) 当前 follow-up 的高优先缺口仍属于既有 family 内稳定性补强（边界语义与可观测性一致性），不是“缺少新 family 才能闭环”的阻塞。
     2) 现有主链路已具备 re-sync / retry / timeout / run observability 的可复用基线，新增 family 会引入新的失败边界与回归成本，不符合本波次最小增量原则。
     3) 当前阶段主线优先级仍在 auth/ACL 与既有能力收口，source 方向应保持 stabilization-first，而非 connector 平台化扩张。
   - 触发重新评估（add）的最小前提：
     - 现有 family 内稳定性缺口已全部收口并通过既定 focused baseline；
     - 有明确、可复现的业务需求被当前 family 结构性阻塞，且无法通过现有 family 的最小增强解决。

5. 同步 external source follow-up 文档与验证基线
     - 目标：把后续 source wave 的边界、验证方式、未做项写清楚
     - 交付物：文档同步 + 最小复用验证清单

    最小复用验证基线（P3 follow-up）建议保持：

    - 运行前提（最小）：在仓库根目录执行，且 API 测试环境依赖可用（沿用当前 dev setup）

    - `pnpm test:api:file -- test/external-source-sync.test.js`
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
    - `pnpm test:api:file -- test/parsing.test.js`

   回归确认口径（P3 follow-up）

   - 三条命令全部通过，视为现有 source family 的 re-sync recovery、source fetch diagnostics、source parsing/dedup baseline 仍稳定。
   - 若失败，先按失败文件回到对应 source follow-up 子路径修复，再重跑同一组命令，不直接升级到重型全量测试。

建议直接用于 queue title 的短标题版：

- `source follow-up gap list`
- `source diagnostics consistency`
- `source resync recovery guards`
- `new source type review`
- `source follow-up docs`

### P4：PC Web 后续局部收口

只有在新能力接入直接影响当前页面承载时，才继续做局部 UI / UX 收口。

控制原则：

- 只做与当前新增能力直接相关的页面承载优化
- 不再开启新一轮大范围 UI 重构
- 继续坚持 `PC Web` 优先、移动端后置

### P5：RAG 质量证明（eval / regression / demo）

这条线的目标不是继续堆功能，而是把当前 RAG 核心能力变成“可证明地好用”：

- 先建立小而硬的 eval baseline
- 再把已有 trace / answer 元信息汇总成质量报告
- 最后补少量端到端 demo case，便于展示和回归

这一波次里，适合自动化的部分和需要人工介入的部分要先分开：

- 可自动化：批量跑固定题集、记录指标、生成 regression report、执行 demo 回归
- 需要人工：选择真实问题集、标注期望答案 / 期望引用、确定固定文档集版本、判断开放式答案是否足够好

#### P5 queue-ready tasks

1. 建立 eval baseline 题集
   - 目标：先挑出一批真实问题，作为后续所有质量对比的固定输入
   - 建议规模：20–50 条
   - 需要人工：挑题、去重、按主题覆盖、确定问题表达方式
   - 交付物：题集清单 + baseline 说明

2. 为 eval baseline 补标注
   - 目标：给每个问题补上期望答案要点、期望引用、期望命中内容
   - 需要人工：标注期望答案 / 引用，尤其是开放式问题的“够不够好”判断
   - 交付物：标注文件 / manifest

3. 固定 baseline 文档集版本
   - 目标：把评测输入的文档 / 知识库版本固定下来，避免每次跑出来的对比不稳定
   - 需要人工：确认哪一版文档集作为基线
   - 交付物：固定基线版本说明 + 数据快照引用

4. 实现可重复 eval runner
   - 目标：批量执行固定题集，收集 `answer status`、`qualityOverall`、`top-k`、`fallback/no-hit`
   - 自动化为主：跑题、抓结果、输出结构化数据
   - 交付物：一条可复用的命令 / 脚本

5. 生成 retrieval quality regression report
   - 目标：把已有 trace 元信息汇总成健康指标
   - 建议指标：`no-hit rate`、`fallback usage rate`、`low-score answer ratio`、`citation limit hit ratio`、`source family failure ratio`
   - 自动化为主：生成报告；人工只负责 review 结论
   - 交付物：regression report（markdown / json / html 任选其一）

6. 做 3–5 个端到端 demo case
   - 目标：把“系统好用”做成可展示、可复跑的固定案例
   - 建议覆盖：本地 PDF 问答、混合 web/feed/sitemap 问答、no-hit / insufficient-context 受控行为、trace detail 排障
    - 需要人工：选 demo 场景、确认预期输出、验收展示效果
    - 交付物：demo case 清单 + 一键回放入口

#### P5 当前对齐（2026-03-29）

- ✅ 已完成（自动化与契约收口）：
  - 固定题集 `P5 v1` eval runner 已落地并可复用导出 `markdown/json/html` regression artifacts
  - regression report 汇总链路已落地（含 trace-derived 回归信号与 diff/failure drilldown）
  - quality gate 固定阈值合同已落地（含 `warn/fail` 模式与阈值明细）
- ⏸️ 仍待完成（人工判断项，继续留在自动 loop 外）：
  - baseline 题集的人工选择与取舍（真实问题覆盖范围）
  - baseline 标注（期望答案要点 / 引用期望）
  - baseline 文档集版本选择与冻结
  - demo case 取舍与 replay 验收结论
- 边界说明：本次仅做 P5 planning/status 对齐，不新增 queue wave，不改现有 runner/report/gate 运行时契约。

### 当前阶段推荐大类顺序

当前更稳的后续顺序是：

1. `外部知识源后续扩展（P3，stabilization-first）`
2. `RAG 质量证明（P5，先处理人工基线项）`
3. `运行观测 / 审计补强（P6）`
4. `PC Web 后续局部收口（P4，仅在能力承载直接需要时触发）`
5. `企业能力（先拆小块，不整包推进）`
6. `多租户隔离`

已完成并默认不再作为当前主线重开的阶段：`P0 read-model/metadata convergence`、`P1 鉴权/用户登录`、`P2 owner-only ACL baseline`。

执行方式仍保持：**主线串行推进，局部低耦合项再小范围并行，不做 7 类全面并行。**

#### 当前 queue refinement note（2026-03-29）

- `P1`、`P2` 与上一轮 `P5 -> P6 -> docs sync` auto-queue 已收口；当前已按批准范围重建一条新的 12-item 执行队列，主线固定为 `P3` 稳定性补强，随后接 `P5/P6` closeout，最后做 queue closeout refresh。
- 在这批 12-item core wave 之外，当前又追加了一条更小的 `P3` follow-up micro-wave，用来收口仍在波次边界内的 retry/timeout、正文质量与外部重同步可读性差异。
- queue `title` 可以继续保持短标题；真正的执行边界、涉及文件、focused validation 统一放在 queue item 的 `promptText` / `promptFile`。
- 当前批准顺序：`p3-source-gaplist-refresh -> p3-source-diagnostics-consistency -> p3-source-resync-recovery-guards -> p3-sitemap-boundary-guard -> p3-web-feed-partial-diagnostics -> p3-source-followup-docs-sync -> p5-runner-report-contract-sync -> p6-usage-scan-first-closeout -> p6-report-center-closeout -> p6-trace-detail-closeout -> p6-observability-docs-sync -> loop-queue-refresh`。
- `P5` 里需要人工判断的任务（题集选择、标注、baseline 文档版本、demo case 取舍、demo replay 验收）仍留在自动 queue 外，避免把主观评审混进自动 build loop。

#### 第二批 queue refinement note（2026-03-29）

- 第一批 refined queue batch（上一批 execution-ready queue items）已按既定顺序消费完成；本段仅作为后续 closeout 收口同步。
- 上一批 `P2/P3/P5/P6/P4` 的第一轮 execution-ready items 跑完后，下一批继续收口为 11 个更偏 contract / guard / docs-sync 的小增量，而不是重新打开新功能波次。
- 当前推荐分层：先入主队列 5 个（ACL contract closeout + snapshot hotspot null-state closeout），再接扩展队列 6 个（route policy / web contract parity / wording guard / docs sync）。
- 本批仍遵守同一条边界：每个 queue item 只做一个最小可验证增量，明确 not-doing，且只带一条 focused validation。
- `P5` 的 5 个人工判断项仍不进入自动 queue；本批次也不新增 source family、ACL 放权语义、dashboard 平台化或评测人工标注流程。

#### 第三批 post-drain queue note（2026-03-29）

- post-drain 第三批 queue（`P5 -> P6 -> docs sync`）现已消费完成；该段继续保留为 closeout 记录。
- 在该 drain 之后，先重建了一条新的 execution-ready 12-item core queue：完成 `P3 external knowledge source follow-up` 的 gap/diagnostics/resync/boundary/docs 收口，再接 `P5/P6` 已落地能力的 contract/readability/docs closeout，最后做 queue refresh closeout。
- 在这条 core queue 收口后，又追加了一条更小的 `P3 follow-up micro-wave`，把当前仍然适合自动 loop 的剩余 safe gaps 继续收口起来：retry / timeout diagnostics、一层正文质量信号、external resync error-code/readability 一致性，以及对应 docs sync。
- 本轮继续保持边界不变：不新增 source family、不把 `P5` 人工判断项塞进自动 loop、不重开 auth/ACL 扩面、不把 Usage / Report center / Trace Detail 扩成 dashboard 平台化或大 UI 改版。

#### P3 follow-up micro-wave（2026-03-29）

- 当前追加的 micro-wave 只覆盖仍在当前稳定性边界内、且适合自动 loop 消费的剩余 follow-up：`retry / timeout diagnostics`、`web page body-quality diagnostics`、`external resync error-code consistency`、`source follow-up docs sync`，最后以 queue refresh 收口。
- 固定顺序：`p3-source-gaplist-refresh -> p3-source-retry-timeout-diagnostics -> p3-web-body-quality-diagnostics -> p3-external-resync-error-code-consistency -> p3-source-followup-docs-sync -> loop-queue-refresh`。
- 本 extra batch 对应的 remaining safe gaps（保持当前边界，不扩面）明确为：
  - `source retry/timeout diagnostics consistency`
  - `web page body-quality diagnostics`
  - `external resync diagnostics/error-code consistency`
- focused validation baseline（for this extra batch，复用当前 P3 follow-up baseline）：
  - `pnpm test:api:file -- test/external-source-sync.test.js`
  - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - `pnpm test:api:file -- test/parsing.test.js`
- 继续保持同一条边界：不新增 source family、不重开 auth/ACL、不把自动 queue 扩成 dashboard 平台化或手动 baseline 流程。

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

**`P0`、`P1`、`P2` 与上一轮 auto-queue closeout 已完成；当前更合适的下一最小增量是以 `P3 external knowledge source follow-up` 作为下一主线，随后再按 `P5 -> P6 -> P4` 继续单线推进、小步增量、每轮收口。**
