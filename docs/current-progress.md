# Current Progress

> 文档角色：`current-status`
> 当前使用方式：用于记录当前实现进度、已完成增量、未完成方向和验证快照；现阶段优先级判断以 `docs/next_steps_rag_project_plan.md` 为主。

更新时间：2026-03-29

> 当前说明：
> 现阶段任务方向、优先级判断、superpowers 使用方式、AI review 策略，以 `docs/next_steps_rag_project_plan.md` 为主。
> 本文档主要用于记录当前实现进度、已完成增量、未完成方向和验证快照。

补充进展（2026-03-27）：

补充进展（2026-03-28）：

补充进展（2026-03-29）：

- ✅ P5 v1 retrieval regression report export contract is now tightened for rerun-stable structure and trace-signal readability
  - 变更文件：
    - `apps/api/src/modules/eval-question-sets/eval-question-sets.service.ts`
    - `apps/api/test/eval-question-sets.service.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - report export metadata 中 `exportedAt` 现在对齐 `runResult.finishedAt`，避免报告导出时额外时钟漂移导致的无意义 diff
    - focused regression 覆盖补齐 report JSON 顶层/题目字段顺序守卫，锁定当前 markdown/json/html 报告结构为可复盘的稳定合同
    - 继续沿用现有 trace-derived 信号（`topRegressionReasons`、`failureDrilldown`、`qualityPrimaryIssue` 等），不扩展新指标家族或人工评判层
  - focused validation：
    - `pnpm test:api:file -- test/eval-question-sets.service.test.js`

- ✅ P5 eval runner baseline ergonomics/failure handling is now hardened for CLI usage and trace-fetch resilience without changing the existing eval framework path
  - 变更文件：
    - `apps/api/scripts/run-p5-v1-eval-runner.mjs`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - CLI 参数解析改为 fail-fast：unknown flag、缺失参数值、非法 `--quality-gate-mode` 会直接报错；同时支持 `--option=value` 写法
    - 默认输出目录改为基于脚本位置锚定到仓库根目录 `storage/evals/p5-v1`，避免因执行目录不同导致路径漂移
    - 运行结果增加最小 contract edge 守卫（`runResult.items` 必须是数组），并把单题 trace 拉取失败降级为 item 级错误字段（`traceFetchError`）而不是整次 runner 中断
  - focused validation：
    - `pnpm --filter @rag-system/api eval:runner:p5-v1 --help`

- ✅ external source follow-up docs are now re-synced to the accepted stability boundary, queue-ready slices, and intentionally deferred expansion scope (docs-only increment)
  - 变更文件：
    - `docs/next_steps_rag_project_plan.md`
    - `docs/current-dev-setup.md`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `next_steps` 的 P3 段新增 `queue-ready slices (accepted)`，把当前已接受的 5 个最小切片顺序固定为：`source follow-up gap list` → `source diagnostics consistency` → `source resync recovery guards` → `new source type review` → `source follow-up docs`
    - `current-dev-setup` 增补 P3 快照：明确当前 stability boundary（现有 source family、nested sitemapindex fail-fast、`MAX_CHILD_SITEMAPS=20` 常量、静态 HTML 抓取边界）
    - 同步标注本波次 intentionally deferred 扩展项（新 source family、JS 渲染抓取、跨 family 错误码重构、source 平台化）
    - 仅做文档对齐，不改实现行为与运行时语义
  - focused validation：
    - `git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md docs/current-dev-setup.md`

- ✅ web/feed source ingestion now records consistent partial diagnostics for content-type fallback sniffing, so scan-first troubleshooting keeps one readable partial envelope
  - 变更文件：
    - `apps/api/src/infra/web-page/web-page.service.ts`
    - `apps/api/src/infra/feed-source/feed-source.service.ts`
    - `apps/api/src/modules/documents/documents.service.ts`
    - `apps/api/test/parsing.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `WebPageService.fetchWebPage` 在 `text/plain/unknown` + HTML sniff fallback 成功时返回结构化 partial diagnostics（不改提取语义）
    - `FeedSourceService.fetchFeed` 在同类 content-type fallback 成功时也补齐同口径 partial diagnostics，并保持 RSS/Atom 解析与去重语义不变
    - `DocumentsService` 将 web/feed fallback partial 统一写入 `EXTERNAL_SOURCE_PARTIAL_SUCCESS` 包装，同时把 feed partial message 改为按失败/去重/边界/fallback 选择更可读文案
  - focused validation：
    - `pnpm test:api:file -- test/parsing.test.js`

- ✅ sitemap nested-index + child-limit boundary behavior is now explicitly locked by focused parsing regressions
  - 变更文件：
    - `apps/api/test/parsing.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 新增 sitemapindex child 为 nested sitemapindex 的回归守卫，明确当前行为仍是 fail-fast 拒绝（不做更深层 sitemap expansion）
    - 新增 child sitemap 数量超过上限（20）时的边界回归守卫，锁定 `MAX_CHILD_SITEMAPS_REACHED`、`droppedChildSitemapCount` 与“仅处理前 20 个 child”行为
    - 仅补 regression guard，不改现有 source family、抓取语义或边界常量
  - focused validation：
    - `pnpm test:api:file -- test/parsing.test.js`

- ✅ external source re-sync now hardens legacy identity recovery for config-loss payload edges while keeping unrecoverable identity failures unchanged
  - 变更文件：
    - `apps/api/src/modules/documents/documents.service.ts`
    - `apps/api/test/external-source-sync.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `parseExternalSourceConfig` 在 legacy identity 可恢复时，除完整缺失配置外，也会覆盖配置对象损坏场景（如 feed 缺失 `url`、sitemap `maxPages` 类型损坏）并继续走同一份 identity-based fallback
    - recovery 仍严格受 identity 可恢复性约束：当 `sourceType + sourceName` 无法归一化为有效 URL 时，仍保持 `EXTERNAL_SOURCE_CONFIG_INVALID` 失败语义
    - 仅补现有 source family（`web_page` / `feed` / `sitemap`）re-sync recovery guard，不改 fetch/retry/ingestion 主链路语义
  - focused validation：
    - `pnpm test:api:file -- test/external-source-sync.test.js`

- ✅ ACL closeout docs are now synced to the current owner-only baseline, validated denial paths, and intentionally deferred role/share expansions (docs-only increment)
  - 变更文件：
    - `docs/current-dev-setup.md`
    - `docs/current-progress.md`
    - `docs/next_steps_rag_project_plan.md`
  - 完成内容（最小范围）：
    - `current-dev-setup` 明确补齐当前 ACL closeout denial-path 快照：unauthenticated `401`、owner-mismatch `403`（含 ask/ask-stream pre-stream deny），以及 KB/document/trace 的 owner-scope 拒绝边界
    - `next_steps` 的 P2 `acl baseline docs` 项补充 closeout 口径，明确“当前只同步 owner-only 基线与已验证拒绝路径，不扩角色/分享语义”
    - 保持文档收口范围：仅同步文档语义与验证口径，不改运行时 ACL 行为
  - focused validation：
    - `git diff --check -- docs/current-dev-setup.md docs/current-progress.md docs/next_steps_rag_project_plan.md`

- ✅ ask / ask-stream denial contract is now aligned for auth-denial paths (`401` unauthenticated, `403` owner-mismatch) with explicit HTTP denial responses before stream start
  - 变更文件：
    - `apps/api/src/modules/assistants/assistants.controller.ts`
    - `apps/api/test/assistants-api.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `POST /assistants/:id/ask/stream` 现在仅在首个 stream event 写出时才启动 NDJSON 响应；若在 stream 启动前命中 auth denial（`401/403`），改为直接返回与 `ask` 对齐的 HTTP 拒绝响应
    - 保持原有流式异常语义不变：非 auth-denial 或已启动 stream 后的失败仍通过 `type: "error"` NDJSON 事件返回
    - `assistants-api` 回归用例同步收口：owner-mismatch 的 ask-stream 断言改为 `403`，并新增 unauthenticated ask/ask-stream 双路径 `401` 对齐守卫
  - focused validation：
    - `pnpm test:api:file -- test/assistants-api.test.js`

- ✅ trace owner-scope access is now locked for both direct trace reads and conversation-linked trace list paths
  - 变更文件：
    - `apps/api/src/modules/traces/traces.service.ts`
    - `apps/api/src/modules/conversations/conversations.controller.ts`
    - `apps/api/test/traces.service.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `TracesService.listConversationTraces` 新增可选 identity scope，并在提供 scope 时按 `conversation(tenantId,userId)` 约束查询
    - `ConversationsController.listConversationTraces` 现在将 current identity scope 透传给 trace 列表查询，和 direct `/traces/:id` 的 owner-scope 语义保持一致
    - 新增 focused regression 用例，锁定 conversation-linked trace list 在提供 scope 时必须走 owner-scope where 条件
  - focused validation：
    - `pnpm test:api:file -- test/traces.service.test.js`

- ✅ 已将第二批 execution-ready follow-up queue items 追加到 loop queue，并同步 refined planning note
  - 变更文件：
    - `.opencode/loop/queue.json`
    - `docs/next_steps_rag_project_plan.md`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 在现有已完成的 wave-level queue items 之后，追加 20 个更细粒度、可直接消费的 follow-up items，顺序按 `P2 -> P3 -> P5 -> P6 -> P4` 排列，其中前 12 个作为主队列、后 8 个作为候补队列顺序入队
    - 在计划文档中补充 queue refinement note：短标题继续保持简短，但真正执行边界统一由 queue `promptText` / `promptFile` 承载，不把整波主题直接塞成单个 queue item
    - 明确保留 5 个不进入自动 queue 的 `P5` 人工项：`eval baseline question set`、`baseline annotations`、`baseline dataset version pin`、`demo case shortlist`、`demo replay baseline`
  - focused validation：
    - `node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('.opencode/loop/queue.json','utf8'));" && git diff --check -- .opencode/loop/queue.json docs/next_steps_rag_project_plan.md docs/current-progress.md`

- ✅ P5 v1 now has a smallest repeatable retrieval regression report runner for fixed demo questions with reusable markdown/json/html outputs
  - 变更文件：
    - `apps/api/scripts/run-p5-v1-eval-runner.mjs`
    - `apps/api/package.json`
    - `docs/current-dev-setup.md`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 新增 `pnpm --filter @rag-system/api eval:runner:p5-v1`：脚本先登录，再触发 `POST /eval/question-sets/demo-replays/p5-v1/run`，用于固定题集自动化回放
    - 脚本按题抓取 `GET /traces/:id` 的 `traceSummary`，从已有 trace/answer metadata 汇总 `no-hit`、`fallback`、`low-score`、`citation-limit-hit`、`source-family-failure` 五类回归信号
    - 默认产物一次落盘三种格式：`storage/evals/p5-v1/p5-v1-retrieval-regression-<timestamp>.{json,md,html}`，可直接用于存档/分享/回归对比
    - 仍保持在现有评测路径内：复用 `runP5V1DemoReplay` + trace 读取，不引入新的评测框架或持久化契约
  - focused validation：
    - `pnpm --filter @rag-system/api eval:runner:p5-v1 --help`

- ✅ P3 `new source type review` now has a clear keep/add decision after source-family stability closeout: **keep existing family (no new source family in this wave)**
  - 变更文件：
    - `docs/next_steps_rag_project_plan.md`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 在 `P3 task 4` 追加明确结论：当前波次保持 `web/feed/sitemap/sitemapindex(一层)`，不新增 source family
    - 明确给出 keep 依据：现有缺口仍是既有 family 内稳定性补强，不需要通过新增 connector 才能闭环
    - 追加 re-open 条件：仅在既有稳定性缺口收口且出现明确结构性需求阻塞时，才重新评估 add
  - focused validation：
    - `git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md`

- ✅ P3 `source follow-up docs` now records a reproducible stability-boundary snapshot, intentionally deferred items, and minimal validation baseline
  - 变更文件：
    - `docs/next_steps_rag_project_plan.md`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 在 `P3: external knowledge source follow-up` 增补当前稳定性边界快照：仅覆盖既有 source family（`web/feed/sitemap/sitemapindex(一层)/external_resync`）及既有稳定性语义（retry/timeout、same-URL reuse+version、stale run guard、run observability）
    - 明确本波次后置项：新 source family 扩展、web 动态渲染抓取、跨 family 错误码体系重构、source 平台化重构
    - 在 P3 最小验证段补充复现前提（仓库根目录 + 沿用当前 API 测试环境依赖）并保留三条 focused baseline 命令
  - focused validation：
    - `git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md`

- ✅ external source re-sync recovery is now hardened for legacy feed/sitemap config-loss identities, with boundary regression coverage for unrecoverable sitemap identity
  - 变更文件：
    - `apps/api/src/modules/documents/documents.service.ts`
    - `apps/api/test/external-source-sync.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `resolveLegacyExternalSourceConfigFromDocumentIdentity` 现在对 `feed` / `sitemap` 与现有 `web_page` 一样支持从 `sourceType + sourceName` 恢复重同步配置，并复用 URL 归一化（去 hash）与默认边界（`maxItems/maxPages=20`）
    - 对于无法解析为有效 URL 的 legacy identity，继续保持现有失败语义：记录 `EXTERNAL_SOURCE_CONFIG_INVALID`，不进入 source fetch
    - 回归覆盖新增 sitemap unrecoverable 边界用例，确保 config-loss recovery 仅在可恢复身份下生效
  - focused validation：
    - `pnpm test:api:file -- test/external-source-sync.test.js`

- ✅ P2 `acl baseline docs` now records one reproducible owner-based ACL baseline snapshot for queue closeout
  - 变更文件：
    - `docs/current-dev-setup.md`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 明确记录当前 `owner_only_v1` 已实现边界：authenticated route split、service policy deny reasons、以及五类核心资源（knowledge base / document / assistant / conversation / trace）的 owner-scoped落点
    - 补充“明确不做”边界：member/viewer 放权、share/public 业务资源可见性、RBAC/ABAC 角色矩阵、跨 tenant 协作语义
    - 文档仅做 ACL 基线收口，不改 API 行为与权限语义
  - focused validation：
    - `pnpm test:api:focus:acl`

- ✅ P2 `default access policy` now has an explicit private/public + inheritance baseline aligned in shared contract and docs
  - 变更文件：
    - `packages/shared/src/access-policy-contracts.ts`
    - `apps/api/src/modules/auth/resource-access-policy.contract.ts`
    - `apps/api/test/resource-access-policy.contract.test.js`
    - `docs/next_steps_rag_project_plan.md`
    - `docs/current-dev-setup.md`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 在 shared ACL contract 新增资源可见性基线：`private/public` 枚举、按资源类型默认可见性映射、以及创建时继承规则映射
    - API ACL contract 新增 `resolveResourceVisibilityOnCreate`，用于统一“新资源默认 private + parent visibility 继承”的实现口径（当前 owner-only 基线下结果仍为 private）
    - 文档同步明确：核心业务资源默认 private；public 仅保留在 auth/health 路由面，不代表业务资源可公开访问
  - focused validation：
    - `pnpm test:api:file -- test/resource-access-policy.contract.test.js`

- ✅ P2 `kb document ownership checks` denial baseline now covers list/detail/write rejection regressions for owner-mismatch paths
  - 变更文件：
    - `apps/api/test/knowledge-bases-auth-write-path.test.js`
    - `apps/api/test/kb-document-access.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - knowledge-base owner-only 拒绝回归新增 `update` 写入路径断言，确保 owner mismatch 时不会落库更新
    - document owner-only 拒绝回归新增三条最小 denial 路径：knowledge-base 文档列表、document 详情读取、document 创建写入
    - 仅补 ACL 拒绝路径回归守卫，不改现有 controller/service 访问语义
  - focused validation：
    - `pnpm test:api:file -- test/knowledge-bases-auth-write-path.test.js test/kb-document-access.test.js`

- ✅ P2 `access policy contract` now has a shared ACL contract baseline in `@rag-system/shared` with standardized policy input/output/deny reasons
  - 变更文件：
    - `packages/shared/src/access-policy-contracts.ts`
    - `packages/shared/src/index.ts`
    - `apps/api/src/modules/auth/resource-access-policy.contract.ts`
    - `apps/api/src/modules/auth/auth.schemas.ts`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 新增共享 access-policy contract（`ResourceAccessPolicyInput` / `ResourceAccessDecision` / deny reasons），统一 owner-only ACL decision 输入输出和拒绝原因口径
    - API 侧 `resource-access-policy.contract.ts` 改为复用 shared contract，并继续通过 `Pick<AuthIdentity, "tenantId" | "userId">` 与现有身份字段对齐
    - `auth.schemas.ts` 的 permission-check `action/kind` 枚举改为复用 shared 常量，避免 service schema 与 policy contract 漂移
    - 范围保持在 ACL 契约收口：不扩展角色矩阵，不改 owner-only 语义
  - focused validation：
    - `pnpm test:api:file -- test/resource-access-policy.contract.test.js`

- ✅ P2 `resource access matrix` 已补齐 owner/member/viewer/public 的最小 ACL 边界矩阵（含 document 行）
  - 变更文件：
    - `docs/next_steps_rag_project_plan.md`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 在 P2 task 1 补充五类核心资源（knowledge base / document / assistant / conversation / trace）的最小 ACL matrix
    - 显式定义当前阶段四类可见性边界：owner（已实现）、member（planned-deny）、viewer（planned-deny）、public（核心业务资源不公开）
    - 追加当前实现 gap、最小实现计划（concise）与 focused validation ideas；仅做文档收口，不改现有 ACL 行为语义
  - focused validation：
    - `git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md`

- ✅ P2 ACL follow-up items have been整理并追加到 queue（按推荐顺序）
  - 变更文件：
    - `docs/next_steps_rag_project_plan.md`
    - `docs/current-progress.md`
    - `.opencode/loop/queue.json`
  - 完成内容（最小范围）：
    - 将 `P2: ACL / 文档权限` 的 queue-ready tasks 收束为 6 个短标题：`resource access matrix`、`access policy contract`、`kb document ownership checks`、`assistant conversation trace checks`、`default access policy`、`acl baseline docs`
    - 这些条目已按推荐顺序写入 loop queue，后续可直接顺着 queue 单线推进
    - 仅做计划/进度/queue 同步，不改 ACL 实现语义

- ✅ P5 可自动化的 eval / regression follow-up 已追加到 queue
  - 变更文件：
    - `.opencode/loop/queue.json`
  - 完成内容（最小范围）：
    - 先把 `P5: RAG 质量证明` 里能自动跑的两个任务写入 queue：`eval runner`、`regression report`
    - 保留 `P5` 里需要人工介入的题集选择 / 标注 / demo case，不强行塞进自动 queue
    - 仍保持 queue 串行推进，不改现有 P2 / P3 顺序

- ✅ P6 v1 snapshot window diff panel now shows one concise source-family drilldown for the 6h vs 24h issue-window shift
  - 变更文件：
    - `apps/web/src/types/api.ts`
    - `apps/web/src/pages/usage/UsagePage.tsx`
    - `apps/web/test/ui-review-regressions.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 在 snapshot diff 面板内继续复用现有 `GET /knowledge-bases/:id/document-runs/comparison` snapshot 响应，不新增 endpoint/hook
    - 基于已有 comparison 响应中的 `sourceFamilyDeltas`，新增一条 `source-family driver` 精简钻取，说明哪一类 source family 在 `6h -> 24h` 的 issue-window 差异里贡献最大
    - 仅收口该子面板读模型表达；未扩展 usage 页为通用 dashboard，未改 backend contract 语义
  - focused validation：
    - `node --test --test-name-pattern "snapshot window diff" apps/web/test/ui-review-regressions.test.js`

- ✅ P6 v1 snapshot comparison now also returns source-family delta data derived from existing summary buckets
  - 变更文件：
    - `apps/api/src/modules/document-runs/document-runs.service.ts`
    - `apps/api/test/document-runs-summary.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `GET /knowledge-bases/:id/document-runs/comparison` 在 `snapshot` 模式下新增 `sourceFamilyDeltas` 字段
    - 新字段直接基于已存在的 `bySourceFamily` 汇总桶计算差异（`totalRuns` / `failedRuns` / `retryableFailures` / `nonRetryableFailures` / `runsWithBoundaryHit`），不改 run-comparison 模式
    - 现有 failure/boundary 统计口径与边界语义保持不变，仅做 additive 返回增强
  - focused validation：
    - `pnpm test:api:file -- test/document-runs-summary.test.js`

- ✅ P6 v1 usage page now includes one focused snapshot window diff subpanel for quick 6h vs 24h issue-window comparison
  - 变更文件：
    - `apps/web/src/pages/usage/UsagePage.tsx`
    - `apps/web/test/ui-review-regressions.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 在 usage 页 `P6 v1 health dashboard` 新增 `P6 v1 snapshot window diff` 子面板
    - 复用已有 `GET /knowledge-bases/:id/document-runs/comparison` + 现有 hook 的 snapshot 参数模式（`leftSinceHours=6`、`rightSinceHours=24`，`issueOnly=true`），展示聚合指标差异
    - 保持 backend contract 不变，不扩展页面为更大 analytics 面板
  - focused validation：
    - `node --test --test-name-pattern "snapshot window diff" apps/web/test/ui-review-regressions.test.js`

- ✅ P6 v1 usage page now includes a scan-first source-family hotspot panel for failure/boundary concentration
  - 变更文件：
    - `apps/web/src/pages/usage/UsagePage.tsx`
    - `apps/web/test/ui-review-regressions.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 在 usage 页 `P6 v1 health dashboard` 新增 `P6 v1 source-family hotspot` 子面板
    - 直接复用现有 `GET /knowledge-bases/:id/document-runs/summary` 的 `bySourceFamily` 聚合数据，按 `failedRuns` + `runsWithBoundaryHit` 的扫描优先级定位当前热点 source family
    - 保持 backend/API 契约不变，不新增 endpoint，不做通用 dashboard 重构
  - focused validation：
    - `node --test --test-name-pattern "source-family hotspot" apps/web/test/ui-review-regressions.test.js`

- ✅ P6 v1 usage page now includes a regression diff view so operators can scan concise run-to-run changes for diagnosis
  - 变更文件：
    - `apps/web/src/types/api.ts`
    - `apps/web/src/features/api/hooks.ts`
    - `apps/web/src/pages/usage/UsagePage.tsx`
    - `apps/web/test/ui-review-regressions.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 在 usage 页 `P6 v1 health dashboard` 中新增 `P6 v1 regression diff view` 子面板
    - 复用已有 `GET /knowledge-bases/:id/document-runs/comparison`，对最近两次 issue run 做 run-vs-run 差异展示（状态/失败阶段/失败码等有意义差异）
    - 保持 backend contract 不变，仅补 web 类型、查询 hook 和简洁差异读模型展示
  - focused validation：
    - `node --test --test-name-pattern "usage page exposes a P6 v1 regression diff view for concise run-to-run diagnostics" apps/web/test/ui-review-regressions.test.js`

- ✅ P6 v1 usage page now includes an anomaly clustering view so repeated failure patterns stand out in one grouped list
  - 变更文件：
    - `apps/web/src/pages/usage/UsagePage.tsx`
    - `apps/web/test/ui-review-regressions.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 在 usage 页 `P6 v1 health dashboard` 区块新增 `P6 v1 anomaly clustering view` 子面板
    - 基于现有 `GET /knowledge-bases/:id/document-runs?issueOnly=true&sinceHours=24` 返回数据，按 `failedStage + failure code + retryable` 聚合失败模式并展示重复次数与 sourceType 分布
    - 保持 backend contract 不变，仅补前端读模型聚合与扫描视图，不扩展新接口
  - focused validation：
    - `node --test --test-name-pattern "usage page exposes a P6 v1 anomaly clustering view for repeated failure patterns" apps/web/test/ui-review-regressions.test.js`

- ✅ P6 v1 document-run summary now includes source-family stats so source-specific issue hotspots are visible at a glance
  - 变更文件：
    - `apps/api/src/modules/document-runs/document-runs.service.ts`
    - `apps/api/test/document-runs-summary.test.js`
    - `apps/web/src/types/api.ts`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `GET /knowledge-bases/:id/document-runs/summary` 新增 `bySourceFamily` 聚合字段（`web` / `feed` / `sitemap` / `upload` / `other`）
    - 每个 source family 现在提供最小观测计数：`totalRuns`、`failedRuns`、`retryableFailures`、`nonRetryableFailures`、`runsWithBoundaryHit`
    - 计数口径保持与现有 summary 语义一致：failure/boundary 仍按每文档 latest completed run 统计，不改已有 failure 语义
  - focused validation：
    - `pnpm test:api:file -- test/document-runs-summary.test.js`

- ✅ P6 v1 now has a comparison report endpoint for run-vs-run or snapshot-vs-snapshot diagnostics
  - 变更文件：
    - `apps/api/src/modules/documents/document.schemas.ts`
    - `apps/api/src/modules/documents/documents.controller.ts`
    - `apps/api/src/modules/documents/documents.service.ts`
    - `apps/api/src/modules/document-runs/document-runs.service.ts`
    - `apps/api/test/document-runs-summary.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 新增 `GET /knowledge-bases/:id/document-runs/comparison`，支持两种输入模式：`leftRunId + rightRunId`（run 对比）或 `leftSinceHours + rightSinceHours`（snapshot 对比）
    - run 对比会输出状态/失败阶段/失败码/可重试性/boundary-hit 等“有意义差异”
    - snapshot 对比复用现有 run summary 聚合，输出 `totalRuns`、`failedRuns`、`retryableFailures`、`nonRetryableFailures`、`runsWithBoundaryHit` 的增减差异
  - focused validation：
    - `pnpm test:api:file -- test/document-runs-summary.test.js`

- ✅ P6 v1 usage page now includes a trend view to show how key health/failure metrics move over time
  - 变更文件：
    - `apps/web/src/pages/usage/UsagePage.tsx`
    - `apps/web/test/ui-review-regressions.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - usage 页在 `P6 v1 health dashboard` 中新增 `P6 v1 trend view`，基于现有接口按 `1h / 6h / 24h` 三个时间窗展示关键指标走势
    - 趋势指标覆盖 `failed runs`、`retryable failures`、`non-retryable failures`、`boundary hits`、`issue events`，仅做前端读模型聚合，不改后端契约
    - 告警视图、最近事件列表与原有健康信号保留，趋势视图作为新增 scan-first 子面板并行呈现
  - focused validation：
    - `node --test --test-name-pattern "usage page exposes a P6 v1 trend view with 1h/6h/24h windows" apps/web/test/ui-review-regressions.test.js`

- ✅ P6 v1 usage now includes a dedicated alert view that aggregates important warnings and threshold issues in one place
  - 变更文件：
    - `apps/web/src/pages/usage/UsagePage.tsx`
    - `apps/web/test/ui-review-regressions.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 在 `P6 v1 health dashboard` 内新增 `P6 v1 alert view` 子面板，把 API 存活异常、run backlog 阈值、retryable/non-retryable 失败阈值、issue-event 阈值、boundary-hit 信号统一汇总为单列表
    - 每条告警都带轻量级优先级（high/warning/watch）与跳转动作（traces 或 run summary），保持 scan-first 排障路径
    - 保持现有后端 contract 与查询接口不变，仅在 web 侧复用已有健康/运行/审计信号做读模型聚合
  - focused validation：
    - `node --test --test-name-pattern "usage page exposes a single P6 v1 alert view" apps/web/test/ui-review-regressions.test.js`

- ✅ P6 v1 document run cards now include a compact run summary line so operators can scan outcomes quickly
  - 变更文件：
    - `apps/web/src/components/document-runs/document-run-observability.ts`
    - `apps/web/src/components/document-runs/DocumentRunList.tsx`
    - `apps/web/test/document-run-observability.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 在 document-run observability helper 新增 `buildRunSummaryText`，基于已有 `status + failedStage` 生成中英双语的一句话运行结果
    - `DocumentRunList` 每条 run 卡片新增摘要行（位于 meta 区之后），优先提供“完成/失败/跳过/进行中”的可扫读结论
    - 保持现有后端契约与 diagnostics 详情不变，仅补前端读模型表达层
  - focused validation：
    - `node --test apps/web/test/document-run-observability.test.js`

- ✅ P6 v1 now exposes a minimal authenticated audit-event query endpoint for quick notable-event inspection
  - 变更文件：
    - `apps/api/src/modules/audit/audit.schemas.ts`
    - `apps/api/src/modules/audit/audit.service.ts`
    - `apps/api/src/modules/audit/audit.controller.ts`
    - `apps/api/src/modules/audit/audit.module.ts`
    - `apps/api/src/app.module.ts`
    - `apps/api/test/audit.service.test.js`
    - `apps/api/test/auth-surface-route-policy.test.js`
    - `apps/api/test/auth-provider-boundary.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 新增 `GET /audit/events`（authenticated），支持 `source`（`all|trace|document_run`）、`issueOnly`、`sinceHours`、`query`、`limit` 的轻量查询参数
    - 后端基于已持久化的 `AnswerTrace` 与 `DocumentRun` 生成统一事件流，按时间倒序聚合返回，避免新增持久化表或 schema 迁移
    - identity scope 沿用现有边界：trace 按 `conversation(tenantId,userId)` 约束，document run 按 `knowledgeBase.tenantId` 约束
  - focused validation：
    - `pnpm test:api:file -- test/audit.service.test.js test/auth-surface-route-policy.test.js test/auth-provider-boundary.test.js`

- ✅ P6 v1 trace detail now includes a failure taxonomy view to quickly classify no-hit / fallback / slow-path / timeout / source-failure cases
  - 变更文件：
    - `apps/web/src/pages/traces/TraceDetailPage.tsx`
    - `apps/web/test/ui-review-regressions.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - trace 详情页 `Execution summary` 新增 `Failure taxonomy (P6 v1)` 面板，按固定分类输出当前 trace 命中的失败标签（可多标签并存）
    - 分类口径保持前端读模型内聚：`no-hit`（primary issue/insufficient reason/0 chunks）、`fallback`（strategy/answer fallback）、`slow-path`（`latencyMs >= 10000`）、`timeout`（失败诊断包含 timeout/abort 关键词）、`source-failure`（失败诊断包含 source/fetch/feed/sitemap 等关键词）
    - 不改后端契约与 trace persistence，仅补前端可读排障视图和最小回归守卫
  - focused validation：
    - `node --test apps/web/test/ui-review-regressions.test.js`

- ✅ P6 v1 trace detail page now surfaces essential request, response, and step-level execution context in one view
  - 变更文件：
    - `apps/web/src/pages/traces/TraceDetailPage.tsx`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - trace 详情页新增 `Request / response / steps` 组合面板，把请求文本、响应文本、以及三段式执行步骤摘要（query prep / retrieval / answer）放到同一视图顶部
    - 响应文本通过现有会话消息接口按 `assistantMessageId`（含 `traceId` 回退）读取，避免新增后端契约
    - 原有 trace 评分、引用、raw payload 诊断区保持不变，仅补齐 P6 v1 的“单页先看核心信息”阅读路径
  - focused validation：
    - `pnpm --filter @rag-system/web build`

- ✅ P6 v1 trace workspace now supports scoped keyword search via the authenticated `/traces` list endpoint
  - 变更文件：
    - `apps/api/src/modules/documents/document.schemas.ts`
    - `apps/api/src/modules/traces/traces.controller.ts`
    - `apps/api/src/modules/traces/traces.service.ts`
    - `apps/api/test/traces.service.test.js`
    - `apps/web/src/features/api/hooks.ts`
    - `apps/web/src/pages/traces/TraceListPage.tsx`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 新增 `GET /traces`（authenticated）查询入口，支持 `query + limit`，并沿用 owner-scope identity 约束，确保仅返回当前身份可见 trace
    - trace 列表查询在 service 层增加关键词匹配（`trace id / userQuery / rewrittenQuery`）并复用既有精简字段选择与 `traceSummary` 附加逻辑
    - Trace 列表页改为直接消费 `/traces`，新增关键词输入框，实现快速搜索并移除按会话逐个拉取 trace 的 `N+1` 请求路径
  - focused validation：
    - `pnpm test:api:file -- test/traces.service.test.js`

- ✅ P6 v1 usage page now includes a lightweight health dashboard to surface core operational status without expanding into a generic ops platform
  - 变更文件：
    - `apps/web/src/types/api.ts`
    - `apps/web/src/features/api/hooks.ts`
    - `apps/web/src/pages/usage/UsagePage.tsx`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - usage 页面新增 `P6 v1 health dashboard` 面板，聚合 `GET /health`、`GET /knowledge-bases/:id/document-runs/summary?sinceHours=24`、`GET /audit/events?issueOnly=true&sinceHours=24&limit=5` 三类已有信号
    - 面板仅展示 4 个核心健康读数（API、run backlog、24h issue events、failed runs）和最近问题事件简表，保持“快速态势感知”而非完整运维平台
    - 保持 backend contract 不变，仅在 web 侧补充轻量 hooks 与已有数据投影
  - focused validation：
    - `pnpm --filter @rag-system/web build`

- ✅ auth v1 owner-scope ACL denials now expose explicit permission-denied hints so blocked access returns a clear rejection state
  - 变更文件：
    - `apps/api/src/modules/auth/resource-access-policy.contract.ts`
    - `apps/api/src/modules/knowledge-bases/knowledge-bases.service.ts`
    - `apps/api/src/modules/assistants/assistants.service.ts`
    - `apps/api/test/resource-access-policy.contract.test.js`
    - `apps/api/test/knowledge-bases-auth-write-path.test.js`
    - `apps/api/test/assistants-api.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 新增 `buildResourceAccessDeniedHint`，把 owner-only v1 deny reason 映射为可读拒绝提示（包含 policy + reason + hint）
    - knowledge-base / assistant 的 owner-scope 拒绝路径从“伪装 not found”改为 `403 Forbidden`，并复用同一拒绝提示文案
    - ask-stream 被 owner-scope 拒绝时，stream error event 现在也会带出同样的明确拒绝提示
  - focused validation：
    - `pnpm test:api:file -- test/resource-access-policy.contract.test.js test/knowledge-bases-auth-write-path.test.js`

- ✅ auth v1 now has ACL guard hook attachment points reserved for future document/resource permission enforcement
  - 变更文件：
    - `apps/api/src/modules/auth/auth-acl-guard-hook.contract.ts`
    - `apps/api/src/modules/auth/auth-route-policy.ts`
    - `apps/api/src/modules/auth/auth-route-policy.guard.ts`
    - `apps/api/src/modules/auth/auth.module.ts`
    - `apps/api/test/auth-provider-boundary.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - route policy guard 现在支持可注入 ACL hook（默认 no-op），为后续资源权限判定预留统一执行落点
    - 新增 `DocumentPermissionHook` / `ResourcePermissionHook` 元数据装饰器（`read|write`），用于后续在具体控制器方法上挂载 ACL 附加语义
    - 当前增量保持 auth v1 行为不变：未扩展 RBAC/ABAC 规则、未引入新的资源权限判定逻辑
  - focused validation：
    - `pnpm test:api:file -- test/auth-provider-boundary.test.js`

- ✅ auth v1 web startup now bootstraps auth state by preloading `/auth/me` at app mount so existing sessions recover cleanly across refresh/navigation
  - 变更文件：
    - `apps/web/src/app/App.tsx`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 在 `QueryClientProvider` 内新增轻量 `AuthStateBootstrap`，应用启动即触发 `useAuthMe()` 查询
    - 复用既有 `['auth','me']` 查询缓存；`AuthenticatedAppShell` / `LoginPage` 继续消费同一身份数据，不新增并行 auth 状态语义
    - 范围保持在 web auth bootstrap 预加载：不改 backend contract、不改路由策略、不改 UI 结构
  - focused validation：
    - `pnpm --filter @rag-system/web build`

- ✅ auth v1 now supports default-user dev mode on the request-auth context path while preserving the auth identity contract
  - 变更文件：
    - `.env.example`
    - `apps/api/src/modules/auth/auth.constants.ts`
    - `apps/api/src/modules/auth/auth-context.middleware.ts`
    - `apps/api/test/auth-provider-boundary.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 新增 `AUTH_DEV_DEFAULT_USER_MODE` 开关（显式 true/false，未设置时默认在非 `production` 环境启用），用于控制未登录请求是否注入 seeded default identity
    - `AuthContextMiddleware` 在 provider 未解析到 session identity 时，按上述开关决定是否回落到 `dev_seed` identity；`currentIdentity` 字段形状保持不变
    - 该增量保持 auth v1 合约不扩展：`AuthIdentity` 字段与 `/auth/me` 返回结构不变，仅收口本地开发默认身份来源
  - focused validation：
    - `pnpm test:api:file -- test/auth-provider-boundary.test.js`

- ✅ auth v1 retrieval-profile ownership now uses explicit tenant assignment and owner-scoped access
  - 变更文件：
    - `apps/api/prisma/schema.prisma`
    - `apps/api/prisma/migrations/20260329213000_add_retrieval_profile_ownership_scope/migration.sql`
    - `apps/api/prisma/seed.js`
    - `apps/api/src/modules/retrieval-profiles/retrieval-profiles.controller.ts`
    - `apps/api/src/modules/retrieval-profiles/retrieval-profiles.service.ts`
    - `apps/api/src/modules/assistants/assistants.service.ts`
    - `apps/api/test/retrieval-profiles-auth-scope.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `RetrievalProfile` 持久化模型补齐并强制 `tenantId` / `ownerId`；migration 优先从 `assistant -> knowledgeBase` 回填，未关联记录回落到最早用户，确保 tenant ownership assignment 显式可追踪
    - seed 默认 retrieval-profile 同步按默认 identity 写入 `tenantId/ownerId`，避免新环境出现无归属 profile
    - retrieval-profile controller 统一向 service 透传当前 request identity；service 的 list/get/update 路径按 `tenantId + ownerId` 约束访问，create 路径强制以当前 identity 写入 owner 归属
    - assistant 更新时校验 `retrievalProfileId` 也改为 owner-scoped 查询，避免跨 owner 绑定 retrieval profile
  - focused validation：
    - `pnpm test:api:file -- test/retrieval-profiles-auth-scope.test.js`

- ✅ auth v1 now exposes a minimal permission-check API for owner-only resource access decisions
  - 变更文件：
    - `apps/api/src/modules/auth/auth.controller.ts`
    - `apps/api/src/modules/auth/auth.schemas.ts`
    - `apps/api/src/modules/auth/auth.service.ts`
    - `apps/api/test/auth-provider-boundary.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 新增 `POST /auth/permissions/check`（`authenticated`），输入 `action + resource(kind/resourceId/tenantId/ownerId)`，输出当前 identity 与 owner-only v1 access decision（`allowed/reason/policy`）
    - 复用现有 `evaluateOwnerResourceAccess` 合约，不扩展 ACL 语义、不引入角色矩阵、不改持久化 schema
    - 现有 `POST /auth/login` / `POST /auth/logout` / `GET /auth/me` 路径与行为保持不变
  - focused validation：
    - `pnpm test:api:file -- test/auth-provider-boundary.test.js`

- ✅ auth v1 now includes a minimal persisted user-role model (`owner`/`member`) and projects role into auth identity for future RBAC-ready contracts
  - 变更文件：
    - `apps/api/prisma/schema.prisma`
    - `apps/api/prisma/migrations/20260329193000_add_user_role_model/migration.sql`
    - `apps/api/prisma/seed.js`
    - `apps/api/src/modules/auth/auth-identity.contract.ts`
    - `apps/api/src/modules/auth/auth.service.ts`
    - `apps/api/src/modules/auth/session-cookie-auth.provider.ts`
    - `apps/api/test/auth-provider-boundary.test.js`
    - `apps/web/src/types/api.ts`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - Prisma 新增 `UserRole` 枚举（`owner` / `member`）并在 `User.role` 落地默认 `owner`，只提供最小角色基线，不扩展 ACL/RBAC 决策矩阵
    - auth 登录与 session provider 现在统一读取并返回 `identity.role`，使 `/auth/login` 与 `/auth/me` 身份契约具备最小角色语义
    - identity 解析对旧 shape 保持兼容：当请求上下文缺少 `role` 时回落到 `owner`，避免现有 auth v1 路径回归
    - web 侧 `AuthIdentity` 类型同步对齐新增 `role` 字段
  - focused validation：
    - `pnpm test:api:file -- test/auth-provider-boundary.test.js`

- ✅ auth v1 route policy baseline now also protects retrieval-profile APIs under the authenticated surface split
  - 变更文件：
    - `apps/api/src/modules/retrieval-profiles/retrieval-profiles.controller.ts`
    - `apps/api/test/auth-provider-boundary.test.js`
    - `apps/api/test/auth-surface-route-policy.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `RetrievalProfilesController` now carries class-level `@AuthenticatedRoute()` metadata, so retrieval-profile endpoints join the authenticated route surface in auth v1
    - route-policy coverage tests now include retrieval-profile controller metadata checks to keep public/authenticated separation explicit
    - scope remains route-protection baseline only: no retrieval-profile service semantics change, no ACL matrix expansion, no guard-logic redesign
  - focused validation：
    - `pnpm test:api:file -- test/auth-provider-boundary.test.js test/auth-surface-route-policy.test.js`

- ✅ auth v1 session provider now includes minimal lifecycle management (activity touch + invalidation-on-read)
  - 变更文件：
    - `apps/api/src/modules/auth/session-cookie-auth.provider.ts`
    - `apps/api/test/auth-provider-boundary.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - valid session identity resolution now updates `AuthSession.lastSeenAt` so the active session can be observed as recently used
    - expired or inactive-user sessions are now proactively revoked (`revokedAt`) during provider resolution before returning unauthenticated
    - scope stays on auth v1 session lifecycle baseline only: no auth contract/schema expansion, no route-policy redesign, no ACL semantic change
  - focused validation：
    - `pnpm test:api:file -- test/auth-provider-boundary.test.js`
  - 实测结果：passed (`12/12`)

- ✅ auth v1 wave now shows a compact current identity card in the desktop app shell
  - 变更文件：
    - `apps/web/src/app/AuthenticatedAppShell.tsx`
    - `apps/web/src/app/AppShell.tsx`
    - `apps/web/test/ui-review-regressions.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `AuthenticatedAppShell` now passes resolved `currentIdentity` into `AppShell`, so shell-level identity display uses the already-bootstrapped auth context
    - desktop left sidebar adds one compact `current identity` card (`userId` / `tenantId` / `authSource` / `sessionId`) to make active auth context directly readable during auth v1 usage
    - scope remains app-shell readout only: no auth contract change, no route-policy change, no page-level redesign
  - focused validation：
    - `node --test apps/web/test/desktop-shell-consistency.test.js`
  - 实测结果：passed (`4/4`)

- ✅ P5 v1 eval run now includes a core-quality threshold gate with warn/fail modes
  - 变更文件：
    - `apps/api/src/modules/eval-question-sets/eval-question-set.schemas.ts`
    - `apps/api/src/modules/eval-question-sets/eval-question-sets.service.ts`
    - `apps/api/test/eval-question-sets.service.test.js`
    - `apps/web/src/types/api.ts`
    - `apps/web/src/features/api/hooks.ts`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `POST /eval/question-sets/:id/runs` 请求新增可选 `qualityGateMode`（`warn` 默认 / `fail`）
    - run 结果新增 `qualityGate`，对五个核心指标（`successRate` / `groundedRate` / `strongRate` / `fallbackRate` / `averageCitationCount`）按固定阈值评估并输出 breach 明细
    - `fail` 模式下若阈值越界将返回 `409`（`EVAL_QUALITY_GATE_FAILED`），并携带当前 run 结果用于定位；`warn` 模式继续返回成功结果
    - markdown/html/json report export 同步包含 quality gate 信息，便于离线复盘
  - focused validation：
    - `pnpm --filter @rag-system/api test:file -- test/eval-question-sets.service.test.js`

- ✅ P5 v1 eval baseline comparison now includes a scan-first diff summary for quick regression review
  - 变更文件：
    - `apps/api/src/modules/eval-question-sets/eval-question-sets.service.ts`
    - `apps/api/test/eval-question-sets.service.test.js`
    - `apps/web/src/types/api.ts`
    - `apps/web/src/pages/reports/ReportCenterPage.tsx`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `POST /eval/question-sets/:id/runs` 的 `baselineComparison` 新增可选 `diffSummary`，汇总回归/改进/不变指标数量、回归指标明细、回归题目数和高频回归原因，便于快速扫描
    - markdown/html report export 新增 `Diff summary` 区块，离线复盘时可直接查看 headline + metric/reason 聚合
    - Report center 新增 `Run diff summary` 展示卡片，优先呈现 headline 和 top regression reasons，减少逐条查看 weakest items 的前置成本
    - 范围保持在 P5 v1 结果可读性增强：不改 schema、不改 retrieval/answer 行为语义、不扩展新评测框架
  - focused validation：
    - `pnpm --filter @rag-system/api test:file -- test/eval-question-sets.service.test.js`

- ✅ P5 v1 eval run now includes per-question failure drilldown so regression review can focus on weakest items first
  - 变更文件：
    - `apps/api/src/modules/eval-question-sets/eval-question-sets.service.ts`
    - `apps/api/test/eval-question-sets.service.test.js`
    - `apps/web/src/types/api.ts`
    - `apps/web/src/pages/reports/ReportCenterPage.tsx`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `POST /eval/question-sets/:id/runs` 在 `baselineComparison` 下新增可选 `failureDrilldown`，按题目给出回归原因码（如 `became_failed` / `quality_degraded` / `fallback_introduced`），并输出按严重程度排序的 `weakestItems`
    - pinned baseline 结果在首次初始化时改为持久化 `summary + items`，用于后续 run 的题目级回归对照；旧版仅 summary 的 baseline 仍兼容（仅不返回 drilldown）
    - markdown/html 报告导出新增 `Failure drilldown` 区块，便于离线 review 时直接聚焦最弱题目
    - Report center 新增 `Regression weakest items` 展示区，优先呈现题目级回归原因，帮助人工复盘快速定位
    - 范围保持在 P5 v1 评测诊断增强：不改 schema、不改 ask/retrieval 行为语义、不扩展新评测框架
  - focused validation：
    - `pnpm test:api:file -- test/eval-question-sets.service.test.js`

- ✅ P5 v1 eval run now detects question-set drift and marks baseline deltas as meaningful/non-meaningful accordingly
  - 变更文件：
    - `apps/api/src/modules/eval-question-sets/eval-question-sets.service.ts`
    - `apps/api/test/eval-question-sets.service.test.js`
    - `apps/web/src/types/api.ts`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `POST /eval/question-sets/:id/runs` 的 `baselineComparison` 新增 `comparisonMeaningful` 与 `questionSetDrift`（`hasDrift` + 题集差异计数），用于显式识别当前 question set 与 baseline snapshot 是否漂移
    - 当检测到题集漂移时，run 结果会抑制 `baselineComparison.deltas`，避免输出可能误导的 baseline 指标差异
    - markdown/html 报告导出同步包含上述漂移与可比性字段，便于离线复盘时判断该次对比是否可直接解读
    - 范围保持在 P5 v1 eval 可比性守卫，不改 persistence schema、不扩展新评测框架
  - focused validation：
    - `pnpm test:api:file -- test/eval-question-sets.service.test.js`

- ✅ P5 v1 eval run output now includes reusable report exports in `markdown/json/html` for storage and sharing
  - 变更文件：
    - `apps/api/src/modules/eval-question-sets/eval-question-sets.service.ts`
    - `apps/api/test/eval-question-sets.service.test.js`
    - `apps/web/src/types/api.ts`
    - `apps/web/src/pages/reports/ReportCenterPage.tsx`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `POST /eval/question-sets/:id/runs` 返回值新增 `reportExports`，一次性提供 `markdown` / `json` / `html` 三种可复用报告内容（含 `fileName`、`mimeType`、`content`）
    - 导出内容使用同一份 run payload（metadata/totals/summary/items + baseline comparison），避免前端再拼装不同格式语义
    - Report center 在 run 完成后新增三种导出按钮，可直接下载并用于存档/分享
    - 范围保持在 P5 v1 报告导出，不扩展新 persistence schema、不引入额外报表平台能力
  - focused validation：
    - `pnpm test:api:file -- test/eval-question-sets.service.test.js`

- ✅ P5 v1 report center is now a dedicated route that groups eval outputs and quality summaries in one place (without expanding usage into a generic dashboard)
  - 变更文件：
    - `apps/web/src/pages/reports/ReportCenterPage.tsx`
    - `apps/web/src/pages/usage/UsagePage.tsx`
    - `apps/web/src/app/router.tsx`
    - `apps/web/src/app/AppShell.tsx`
    - `apps/web/test/trace-router.test.js`
    - `apps/web/test/desktop-shell-consistency.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - 新增 `/reports`（Report center）页面，集中承载 P5 v1 eval run 触发、题目级输出列表、以及质量汇总读数（成功率/grounded/strong/fallback/平均引用 + quality distribution）
    - `Usage` 页面保留 workspace usage 统计，并改为指向 report center 的入口，避免将该页继续演进为通用仪表盘平台
    - 左侧导航新增 `Report center` 路由入口，保持 trace/usage/report 三者并列
  - focused validation：
    - `node --test apps/web/test/trace-router.test.js apps/web/test/desktop-shell-consistency.test.js`

- ✅ route policy baseline now marks owner-scoped business controllers as authenticated while keeping auth/health public
  - 变更文件：
    - `apps/api/src/modules/knowledge-bases/knowledge-bases.controller.ts`
    - `apps/api/src/modules/documents/documents.controller.ts`
    - `apps/api/src/modules/assistants/assistants.controller.ts`
    - `apps/api/src/modules/conversations/conversations.controller.ts`
    - `apps/api/src/modules/traces/traces.controller.ts`
    - `apps/api/test/auth-provider-boundary.test.js`
    - `docs/current-dev-setup.md`
    - `docs/current-progress.md`
  - 同步内容（最小范围）：
    - knowledge-base / document / assistant / conversation / trace controllers now carry class-level `authenticated` route policy metadata
    - public auth/health exceptions remain unchanged, including `AuthController` class-level public policy and `GET /auth/me` authenticated policy
    - `docs/current-dev-setup.md` now reflects the authenticated business-route baseline
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/auth-provider-boundary.test.js`

- ✅ opencode loop session titles now show remaining queue work and omit the year
  - `scripts/opencode-loop/runtime.mjs` titles now read like `loop #N · X left · <item-id> · MM-DD HH:mm:ss`
  - `scripts/opencode-loop/planner.mjs` titles now use the same no-year session time format
  - `scripts/opencode-loop/queue.mjs` adds a shared `formatSessionTitleTime()` helper for loop session titles
  - `scripts/opencode-loop/self-test.mjs` now checks the clearer title shape
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`

- ✅ ACL docs and focused regression baseline are now aligned to the implemented owner-only access rules
  - 变更文件：
    - `package.json`
    - `apps/api/package.json`
    - `docs/current-dev-setup.md`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - repo root now exposes `pnpm test:api:focus:acl`
    - API package now exposes `pnpm test:focus:acl` with the current ACL-ready regression set:
      - `test/auth-provider-boundary.test.js`
      - `test/resource-access-policy.contract.test.js`
      - `test/knowledge-bases-auth-write-path.test.js`
      - `test/kb-document-access.test.js`
    - the baseline is intentionally limited to already-implemented owner-scoped rules and does not broaden into assistant/trace ACL expansion
    - `docs/current-dev-setup.md` now records both the current `owner_only_v1` deny-by-default stance and the narrow regression baseline coverage
    - scope remains docs + validation-baseline sync only: no ACL policy expansion, no new resource access semantics
  - focused validation：
    - `pnpm test:api:focus:acl`

- ✅ knowledge-base read/detail now applies owner-only ACL policy evaluation at the service read boundary (and kb-scoped document read entrypoints already reusing this codepath inherit it)
  - 变更文件：
    - `apps/api/src/modules/knowledge-bases/knowledge-bases.service.ts`
    - `apps/api/src/modules/documents/documents.service.ts`
    - `apps/api/test/knowledge-bases-auth-write-path.test.js`
    - `docs/current-progress.md`
  - 完成内容（最小范围）：
    - `KnowledgeBasesService.getKnowledgeBase` now reads by `id` then evaluates `evaluateOwnerResourceAccess` with `action: "read"` and `kind: "knowledge_base"`
    - `DocumentsService.getDocument` now reuses `knowledgeBasesService.getKnowledgeBase(document.kbId, scope)` when scope is present, so `documents/:id` and related read entrypoints inherit the same owner-only read policy codepath
    - deny decision keeps existing behavior-preserving `NotFound` response semantics
    - no RBAC/share expansion, no route-policy redesign, no unrelated refactor
  - focused validation：
    - `pnpm test:api:file -- test/knowledge-bases-auth-write-path.test.js`
  - 实测结果：passed (`6/6`)

- ✅ knowledge base / document read-write paths now enforce owner-based access checks via request identity (ACL baseline increment)
  - 变更文件：
    - `apps/api/src/modules/knowledge-bases/knowledge-bases.controller.ts`
    - `apps/api/src/modules/knowledge-bases/knowledge-bases.service.ts`
    - `apps/api/src/modules/documents/documents.controller.ts`
    - `apps/api/src/modules/documents/documents.service.ts`
    - `apps/api/test/knowledge-bases-auth-write-path.test.js`
    - `apps/api/test/kb-document-access.test.js`
  - 完成内容（最小范围）：
    - knowledge-base `list/get/update` 现在统一从 request identity 进入 owner scope，并在 service 层按 `tenantId + ownerId` 收口
    - knowledge-base 绑定的 document read/write 入口（`knowledge-bases/:id/*` + `documents/:id/*`）现在统一传入 current identity 做 ownership 检查
    - scope 仅收口 owner-based ACL baseline；未引入 RBAC/share 扩展，未改 schema/persistence
  - focused validation：
    - `pnpm test:api:file -- test/knowledge-bases-auth-write-path.test.js test/kb-document-access.test.js`
  - 实测结果：passed (`8/8`)

- ✅ external source re-sync recovery boundary now covers legacy missing-config paths for feed/sitemap (in addition to web-page), with normalized URL fallback from source identity
  - 变更文件：
    - `apps/api/src/modules/documents/documents.service.ts`
    - `apps/api/test/external-source-sync.test.js`
    - `docs/current-dev-setup.md`
  - 完成内容（最小范围）：
    - `DocumentsService.resolveLegacyExternalSourceConfigFromDocumentIdentity` now recovers `feed` / `sitemap` from `sourceType + sourceName` when `sourceConfigJson` is missing, using the same default bound fallback (`maxItems/maxPages=20`) and URL normalization (hash stripped)
    - unrecoverable legacy identities (for example invalid `sourceName` URL) still keep the existing `EXTERNAL_SOURCE_CONFIG_INVALID` failure path, preserving run-history failure visibility
    - scope remains existing source families only (`web_page` / `feed` / `sitemap`); no new connector expansion, no retry-policy rewrite, no schema changes
  - focused validation：
    - `pnpm test:api:file -- test/external-source-sync.test.js`
  - 实测结果：focused external-source sync tests passed (`27/27`)

- ✅ direct trace read (`GET /traces/:id`) now follows the same current-identity ownership baseline as conversation-scoped trace reads (owner-only ACL baseline)
  - 变更文件：
    - `apps/api/src/modules/traces/traces.controller.ts`
    - `apps/api/src/modules/traces/traces.service.ts`
    - `apps/api/test/traces.service.test.js`
  - 最小行为改动（收口范围）：
    - `TracesController.getTrace` 现在与 conversation 路径一致，先解析 request current identity，再将 identity scope 传给 trace 读取
    - `TracesService.getTrace` 在提供 identity scope 时改为按 `trace.id + trace.conversation(tenantId,userId)` 读取；不在 scope 内时保持 `NotFoundException`
    - `traceSummary` 生成语义保持不变；未引入新策略框架，未扩展 assistant ACL 或 schema/contract redesign
  - focused validation：
    - `pnpm test:api:file -- test/traces.service.test.js`
  - 实测结果：passed (`28/28`)

- ⚠️ P2 `assistant conversation trace checks` implemented one focused ACL increment for assistant ownership scoping (owner-only baseline, no RBAC/share expansion)
  - 变更文件：
    - `apps/api/src/modules/assistants/assistants.controller.ts`
    - `apps/api/src/modules/assistants/assistants.service.ts`
    - `apps/api/src/modules/assistants/ask-assistant.service.ts`
    - `apps/api/test/assistants-api.test.js`
  - 完成内容（最小范围）：
    - assistant `list/get/update` 现在统一从 request identity 进入 owner-only scope，并复用现有 knowledge-base ownership 口径（`owner_only_v1`）做可见性收口
    - ask / ask-stream 在 assistant 解析阶段也改为按 current identity 做同一 owner-only 校验；仅收口 assistant 访问边界，不改 retrieval/answering 行为语义
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/assistants-api.test.js`
  - 实测结果：当前环境失败（`DATABASE_URL` 未设置，seed 阶段报 `Environment variable not found: DATABASE_URL`），需在具备 DB 环境变量后复跑同一命令

- ✅ P2 `resource access matrix` 已完成第一版 ACL 边界盘点（聚焦 knowledge base / assistant / conversation / trace）
  - 变更文件：`docs/next_steps_rag_project_plan.md`
  - 盘点基于当前代码路径：
    - `apps/api/src/modules/knowledge-bases/knowledge-bases.controller.ts`
    - `apps/api/src/modules/documents/documents.controller.ts`（knowledge-base 相关入口）
    - `apps/api/src/modules/assistants/assistants.controller.ts`
    - `apps/api/src/modules/assistants/ask-assistant.service.ts`
    - `apps/api/src/modules/conversations/conversations.controller.ts`
    - `apps/api/src/modules/conversations/conversations.service.ts`
    - `apps/api/src/modules/traces/traces.controller.ts`
    - `apps/api/src/modules/auth/auth-route-policy.guard.ts`
  - 结论（最小范围）：
    - conversation 面已具备 `tenantId + userId` owner-based baseline
    - knowledge base / assistant / direct trace read 仍存在按 id 可读写入口，待后续 ACL 收口
    - route policy 当前仅对显式 `authenticated` 路由生效，业务路由默认仍未统一收口
  - 新增 / 更新验证：
    - `git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md`

- ✅ ACL baseline now has a minimal resource-access policy contract aligned with auth identity shape (owner-only, no role matrix expansion)
  - `apps/api/src/modules/auth/resource-access-policy.contract.ts` adds one small service-layer ACL contract (`ResourceAccessPolicyInput` / `ResourceAccessDecision`) with owner-only v1 decision reasons (`owner_match`, `tenant_mismatch`, `owner_mismatch`, `owner_unassigned`)
  - contract identity is intentionally aligned to existing auth identity fields (`tenantId`, `userId`) via `Pick<AuthIdentity, "tenantId" | "userId">`
  - `apps/api/test/resource-access-policy.contract.test.js` adds focused coverage for allow/deny reason paths under this owner-only baseline
  - scope remains ACL contract baseline only: no controller guard expansion, no resource wiring changes, no RBAC/ABAC enterprise policy design
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/resource-access-policy.contract.test.js`
  - 实测结果：focused ACL contract tests passed (`4/4`)

- ✅ web auth state now bootstraps from `GET /auth/me` and protects app routes with a minimal login gate
  - `apps/web/src/lib/api.ts` now sends `credentials: "include"` for API and stream requests, and surfaces HTTP status on request errors so auth bootstrap can distinguish `401`
  - `apps/web/src/types/api.ts` adds minimal `AuthIdentity` / `AuthMeResponse` types aligned with the backend auth contract
  - `apps/web/src/features/api/hooks.ts` adds minimal auth hooks (`useAuthMe`, `useLogin`, `useLogout`) and keeps auth bootstrap query key scoped to `['auth','me']`
  - `apps/web/src/app/AuthenticatedAppShell.tsx` now bootstraps login state from `/auth/me` and redirects unauthenticated users to `/login`
  - `apps/web/src/app/router.tsx` now registers `/login` and wraps existing app routes behind `AuthenticatedAppShell`
  - `apps/web/src/pages/auth/LoginPage.tsx` adds a minimal login form that calls `POST /auth/login` and redirects to `/` on success
  - scope remains web auth bootstrap/plumbing only: no backend contract changes, no UI redesign, no ACL expansion
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/web build`
  - 实测结果：web build passed

- ✅ auth route policy baseline now distinguishes public routes from authenticated routes with a minimal guard/decorator contract
  - `apps/api/src/modules/auth/auth-route-policy.ts` adds a tiny route-policy metadata contract (`public` / `authenticated`)
  - `apps/api/src/modules/auth/auth-route-policy.guard.ts` adds a global guard that enforces only `authenticated` routes and checks real session identity (`request.authContext.identity`) instead of dev fallback identity
  - `apps/api/src/modules/auth/auth.module.ts` now wires the guard as `APP_GUARD`
  - `apps/api/src/common/health.controller.ts` marks health as `public`; `apps/api/src/modules/auth/auth.controller.ts` keeps auth controller public but marks `GET /auth/me` as `authenticated`
  - focused guard regressions added in `apps/api/test/auth-provider-boundary.test.js`
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/auth-provider-boundary.test.js`
  - 实测结果：focused auth boundary tests passed (`9/9`)

- ✅ conversation read/write paths now scope by current identity (ACL-ready baseline, behavior-preserving by default dev identity)
  - `apps/api/src/modules/conversations/conversations.controller.ts` now resolves request auth context for all conversation routes and scopes list/detail reads to current identity
  - conversation messages/traces route reads now verify scoped conversation ownership first (`getConversation` within identity scope) before listing related records
  - `apps/api/src/modules/conversations/conversations.service.ts` now supports optional identity-scoped list/get (`tenantId + userId`), while preserving legacy unscoped behavior when scope is omitted
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now scopes existing-conversation lookup in both ask and ask-stream paths using current identity before writing new messages/traces
  - focused regressions added:
    - `apps/api/test/conversations.service.test.js`
    - `apps/api/test/ask-success.test.js`
    - `apps/api/test/ask-stream-service.test.js`
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/conversations.service.test.js test/ask-success.test.js test/ask-stream-service.test.js`
  - 实测结果：focused API tests passed (`54/54`)

- ✅ auth/login wave docs are now synced to implemented status with a focused validation baseline note
  - `docs/next_steps_rag_project_plan.md` now records P1 (`鉴权 / 用户登录`) as implemented/closed for tasks `1~12` and adds a reusable focused validation baseline for the auth/login wave
  - this file (`docs/current-progress.md`) now aligns the old "未开始"/"下一步" status blocks with the already-implemented auth/login baseline and keeps ACL as the next mainline
  - 新增 / 更新验证：
    - `git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md`
  - 实测结果：diff check passed

- ✅ opencode loop now has small strategy hooks and an ordered auth/ACL/source queue wave
  - `scripts/opencode-loop/strategy.mjs` adds a minimal strategy normalization layer with callbacks for next-item selection, run eligibility, failure handling, and completion hooks
  - `scripts/opencode-loop/runtime.mjs` now accepts an optional `strategy` object, supports inline `promptText` queue items, and lets queue failures with `failureMode: "defer"` continue later items in the same run while keeping the deferred item for the next loop invocation
  - `.opencode/loop/queue.json` now carries the ordered `P1/P2/P3` auth/login → ACL → external-source follow-up wave as pending queue items
  - `scripts/opencode-loop/self-test.mjs` adds focused coverage for predicate-based item selection, deferred-item handling, inline promptText items, and the failure-defer path
  - `scripts/opencode-loop.md` now documents the strategy hook and inline promptText / failureMode queue metadata
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test passed

- 📝 RAG 质量证明方向已整理为后续可执行清单（暂未进入 queue）
  - 已在 `docs/next_steps_rag_project_plan.md` 新增 `P5：RAG 质量证明（eval / regression / demo）`
  - 这一波次明确拆分了两类工作：
    - **可自动化**：固定题集执行、指标采集、regression report、demo 回放
    - **需要人工**：题集挑选、期望答案 / 期望引用标注、基线文档集版本确认、开放式答案验收
  - 当前仍保持“先记录、后进入 queue”的方式，等抽空再把该波次拆成可执行 queue item

- ✅ source-fetch redirect diagnostics now keep a bounded raw redirect target in invalid/non-HTTP redirect-follow errors
   - `apps/api/src/infra/http/fetch-with-retry.ts` now appends bounded raw `Location` text (`...<truncated>` when long) on two existing redirect-follow failure paths: invalid redirect location and non-`http(s)` redirect target
   - `apps/api/test/fetch-with-retry.test.js` adds one focused regression for long non-`http(s)` redirect target diagnostics so raw target visibility remains readable but bounded
   - 新增 superpowers scoped note:
     - `docs/superpowers/specs/2026-03-28-source-fetch-redirect-target-diagnostics-design.md`
     - `docs/superpowers/plans/2026-03-28-source-fetch-redirect-target-diagnostics-plan.md`
   - scope remains diagnostics-only for redirect-follow error wording: no retry-policy rewrite, no source-family expansion, no ingestion/persistence behavior changes
   - 新增 / 更新验证：
     - `pnpm test:api:file -- test/fetch-with-retry.test.js`
   - 实测结果：focused fetch-with-retry tests passed (`13/13`)

- ✅ source-fetch timeout/abort diagnostics now keep the source URL and surface the abort reason text
  - `apps/api/src/infra/http/fetch-with-retry.ts` now preserves the existing retry path but includes the normalized abort/timeout reason after the source URL and timeout boundary
  - `apps/api/test/fetch-with-retry.test.js` updates the focused timeout regression to lock the clearer timeout wording
  - scope remains diagnostics-only for source fetch timeout/abort wording: no retry-policy rewrite, no source-family expansion, no ingestion/persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`

- ✅ embedding runtime now fails fast on malformed/non-HTTP base URL config for Ollama/OpenAI embedding providers
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now validates configured `OLLAMA_BASE_URL` and `OPENAI_BASE_URL` with explicit `EmbeddingRuntimeConfigError` diagnostics when URL parsing fails or protocol is not `http(s)`
  - `apps/api/test/embedding-runtime-config.test.js` adds focused regressions for malformed `OPENAI_BASE_URL` and non-HTTP `OLLAMA_BASE_URL`
  - unsupported OpenAI embedding model diagnostics now also include the resolved embedding endpoint so the error carries one more already-resolved context value on that path
  - 新增 superpowers scoped note:
    - `docs/superpowers/specs/2026-03-28-embedding-base-url-guardrail-design.md`
    - `docs/superpowers/plans/2026-03-28-embedding-base-url-guardrail-plan.md`
  - scope remains one embedding config guardrail only: no provider-order changes, no retrieval behavior changes, no embedding redesign
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/embedding-runtime-config.test.js`
  - 实测结果：focused embedding runtime config tests passed (`16/16`)

- ✅ opencode loop now retries up to three fresh sessions after assistant-wait timeout
  - `scripts/opencode-loop/runtime.mjs` now treats the `180000ms` assistant-wait expiry as a typed timeout path, logs `message:timeout-retry`, clears stale session/message state for the item, and retries up to three times with fresh sessions before failing the loop
  - when the final retry still times out, the queue item is now reset back to `pending` with stale runtime metadata cleared, so the next loop start does not get pinned to a dead `in_progress` session
  - resumed items still keep the existing resume behavior when a reply eventually arrives, but no longer stay pinned to a dead session after a no-reply timeout
  - resumed long sessions now still complete even when the baseline assistant message falls out of the latest `limit=200` window, because the runtime treats a missing baseline as "use the latest different assistant reply" instead of timing out forever
  - `scripts/opencode-loop/runtime.mjs` now also forwards `afterMessageId` in the `POST /session/:id/message` body and records lock ownership with Linux process identity (`/proc/<pid>/stat` + `/proc/<pid>/cmdline`) so stale lock directories are less likely to block a new loop after PID reuse
  - `scripts/opencode-loop/planner.mjs` now dedupes auto-refill proposals against existing queue prompt contents when the prompt file is available, instead of fingerprinting only the prompt file path
  - `scripts/opencode-loop/self-test.mjs` adds focused coverage for successful timeout fresh-session retry, final-timeout reset-to-pending behavior, long-session resume window rollover, stale-lock recovery, and planner dedupe against an already-materialized generated prompt
  - scope remains loop-runtime / planner robustness only: no queue schema expansion, no task-generation policy changes
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test passed, including deferred recovery, resume window rollover, stale-lock recovery, and timeout fresh-session retry coverage

- ✅ ask / ask-stream final payload now expose additive top-level `rewriteReadabilityLabel` aligned with trace-summary wording
  - `apps/api/src/modules/retrieval/strategy-readability.ts` now centralizes existing rewrite readability sentence builder (`rewrite <enabled|disabled>; rewrite applied: <yes|no>; rewrite fallback: <yes|no|unknown>; rewrite prompt: <id|unknown>.`) for shared projection reuse
  - `apps/api/src/modules/traces/traces.service.ts` now reuses the shared helper so trace-summary wording/semantics remain unchanged while avoiding duplicated builder logic
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now includes top-level `rewriteReadabilityLabel` in both one-shot ask and ask-stream final payloads using existing `strategySummary` rewrite metadata
  - `apps/api/test/ask-success.test.js` and `apps/api/test/ask-stream-service.test.js` add focused assertions for the new top-level field on representative rewrite-enabled and rewrite-disabled paths
  - `apps/web/src/types/api.ts` `AskResponse` now includes optional `rewriteReadabilityLabel`; `apps/web/test/ask-answering-metadata-contract.test.js` now guards the field in the existing web contract check
  - `docs/current-dev-setup.md` ask response metadata semantics list is aligned
  - scope remains additive contract/readability convergence only: no retrieval/answering behavior semantics changes, no persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ask-success.test.js test/ask-stream-service.test.js`
  - 实测结果：focused ask tests passed (`48/48`)

- ✅ ask/trace docs contract note is refreshed after ask top-level metadata surface expansion
  - `docs/current-dev-setup.md` now explicitly notes that the `current ask response metadata semantics` top-level field list is kept aligned with `apps/web/test/ask-answering-metadata-contract.test.js`
  - scope remains docs-only alignment: no backend/web runtime changes, no shared contract changes, no retrieval/answering semantics changes

- ✅ ask/trace contract docs were tightened to match the currently shipped ask top-level metadata surface
  - `docs/current-dev-setup.md` `current ask response metadata semantics` now lists the already-shipped top-level ask provenance/readability fields for attribution/evidence/text-source/status-source/provenance sentences, so it stays aligned with the existing web ask metadata contract guard
  - scope is docs-only alignment: no backend/web runtime changes, no shared contract changes, no retrieval/answering semantics changes

- ✅ ask / ask-stream final payload now expose additive top-level `missingInformationProvenanceSentence` aligned with trace-summary wording
  - `apps/api/src/modules/answering/missing-information-provenance.ts` now centralizes existing missing-information provenance sentence wording (`Missing-information source is <...>; insufficient-context reason is <...>; missing-information count is <...>.`)
  - `apps/api/src/modules/traces/traces.service.ts` now reuses that helper so trace-summary wording path remains unchanged while shared with ask-path projection
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now includes top-level `missingInformationProvenanceSentence` in both one-shot ask and ask-stream final payloads using existing resolved missing-information source / insufficient-context reason / count metadata
  - `apps/api/test/ask-success.test.js` and `apps/api/test/ask-stream-service.test.js` add focused assertions for the new top-level field on representative `none` and `model` missing-information source paths
  - `apps/web/src/types/api.ts` `AskResponse` now includes optional `missingInformationProvenanceSentence`; `apps/web/test/ask-answering-metadata-contract.test.js` now guards the field in the existing web contract check
  - `docs/current-dev-setup.md` ask response metadata semantics list is aligned
  - scope remains additive contract/readability convergence only: no retrieval/answering behavior semantics changes, no persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ask-success.test.js test/ask-stream-service.test.js`
  - 实测结果：focused ask tests passed (`48/48`)

- ✅ trace summary now exposes additive `missingInformationSourceReadabilityLabel` for easier missing-information provenance scanning
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `missingInformationSourceReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits this label from existing missing-information source metadata, with readable wording for `none` / `model` / `deterministic_default` / `suppressed_by_policy` and raw-value fallback for unknown legacy values
  - `apps/api/test/traces.service.test.js` updates baseline trace-summary snapshots and adds one legacy fallback assertion for missing source metadata; `apps/web/test/trace-summary-contract.test.js` now also guards the new shared contract field
  - `docs/current-dev-setup.md` trace-summary field list is aligned
  - scope remains additive/readability-only trace metadata: no retrieval execution semantics, source-family behavior, or persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`

- ✅ trace summary now exposes additive `retrievalModeProvenanceSentence` for clearer retrieval-mode fallback provenance scanning
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `retrievalModeProvenanceSentence: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits this one-line sentence from existing resolved `retrievalMode`, `strategySummary.usedFallback`, and `fallbackReason`
  - `apps/api/test/traces.service.test.js` updates baseline summary snapshots and adds one legacy regression assertion for the `usedFallback=true + fallbackReason missing` wording path
  - `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field; `docs/current-dev-setup.md` trace-summary field list is aligned
  - scope remains additive/readability-only trace metadata: no retrieval execution semantics, source-family behavior, or persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`

- ✅ trace summary now exposes additive `citationCountReadabilitySentence` for faster citation-budget scanning
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `citationCountReadabilitySentence: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits this one-line sentence from existing citation count readability label (`Citation count summary: <label>.`)
  - `apps/api/test/traces.service.test.js` updates both baseline trace-summary snapshots to guard the new field; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field
  - `docs/current-dev-setup.md` trace-summary field list is aligned
  - scope remains additive/readability-only trace metadata: no retrieval execution semantics, source-family behavior, or persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`

- ✅ trace summary now exposes additive `contextReadabilitySentence` for easier prompt-context composition scanning
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `contextReadabilitySentence: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits this one-line sentence from existing context metadata (`contextMode`, `promptContextCount`, `inputChunkCount`, `contextGroupCount`, `retrievedChunkCount`)
  - `apps/api/test/traces.service.test.js` updates both baseline trace-summary snapshots to guard the new field; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field
  - `docs/current-dev-setup.md` trace-summary field list is aligned
  - scope remains additive/readability-only trace metadata: no retrieval execution semantics, source-family behavior, or persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`

- ✅ 当前 queue 已重排
  - 本次只调整现有 queue 的执行顺序，本次整理不新增也不删除任务
  - 排序规则：先阻塞项，再收尾项，最后优化项
  - 当前顺序：`packages/shared` 契约收口 → 验证分层 → read-model 派生层收拢 → 兼容逻辑治理 → 外部输入标准化 → 本地环境摩擦下降

- ✅ trace summary now exposes additive `candidateCountReadabilitySentence` for easier final candidate-flow scanning
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `candidateCountReadabilitySentence: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits this one-line sentence from existing candidate flow counts (`ranked`, `merged`, `vector`, `lexical`, `candidateLimit`)
  - `apps/api/test/traces.service.test.js` updates both baseline trace-summary snapshots to guard the new field; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field
  - `docs/current-dev-setup.md` trace-summary field list is aligned
  - scope remains additive/readability-only trace metadata: no retrieval execution semantics, source-family behavior, or persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`

- ✅ trace summary now exposes additive `answerProvenanceReadabilitySentence` for easier final-answer provenance scanning
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `answerProvenanceReadabilitySentence: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits this sentence from existing answer text/status readability labels plus `answerAttributionReadabilitySentence`
  - `apps/api/test/traces.service.test.js` adds focused assertions for both baseline and legacy-fallback trace summary paths; `apps/web/test/trace-summary-contract.test.js` now guards the shared contract field
  - `docs/current-dev-setup.md` trace-summary field list is aligned
  - scope remains additive/readability-only trace metadata: no retrieval execution semantics, source-family behavior, or persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`

- ✅ trace summary now exposes additive `failureReadabilitySentence` for easier failed-stage + message scanning
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `failureReadabilitySentence: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits the sentence from existing `failedStageReadabilityLabel` + `failureMessage` (`<stage label>; message: <message>.`), with `message unavailable` fallback when no message exists
  - `apps/api/test/traces.service.test.js` adds focused assertions for known-stage, unknown-stage(raw), and no-message paths; `apps/web/test/trace-summary-contract.test.js` guards the shared contract field
  - `docs/current-dev-setup.md` trace-summary field list is aligned
  - scope remains additive/readability-only trace metadata: no retrieval execution semantics, source-family behavior, or persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`

- ✅ trace summary now exposes additive `answerTextSourceReadabilitySentence` for easier final-answer text-source scanning
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `answerTextSourceReadabilitySentence: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits this one-line sentence directly from existing text-source label (`Answer text source is <label>.`)
  - `apps/api/test/traces.service.test.js` updates both baseline trace-summary snapshots and legacy/raw-source checks to guard the new sentence
  - `apps/web/test/trace-summary-contract.test.js` now guards the shared contract field; `docs/current-dev-setup.md` trace-summary field list is aligned
  - scope remains additive/readability-only trace metadata: no retrieval execution semantics, source-family behavior, or persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`

- ✅ trace summary now exposes additive `answerStatusSourceReadabilitySentence` for easier final-answer status-source scanning
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `answerStatusSourceReadabilitySentence: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits this one-line sentence from existing status-source label (`Answer status source is <label>.`)
  - `apps/api/test/traces.service.test.js` updates both baseline trace-summary expectation snapshots for unknown and retrieval-inferred status-source paths
  - `apps/web/test/trace-summary-contract.test.js` now guards the new shared trace-summary field; `docs/current-dev-setup.md` trace-summary field list is aligned
  - scope remains additive/readability-only trace metadata: no retrieval execution semantics, source-family behavior, or persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`

- ✅ trace summary now exposes additive `answerEvidenceSourceReadabilitySentence` for easier final-answer evidence-source scanning
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `answerEvidenceSourceReadabilitySentence: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits this one-line sentence directly from existing evidence-source label (`Answer evidence source is <label>.`)
  - `apps/api/test/traces.service.test.js` updates both baseline trace-summary expectation snapshots for unknown and heuristic evidence-source paths
  - `apps/web/test/trace-summary-contract.test.js` now guards the new shared trace-summary field; `docs/current-dev-setup.md` trace-summary field list is aligned
  - scope remains additive/readability-only trace metadata: no retrieval execution semantics, source-family behavior, or persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`

- ✅ ask / ask-stream / trace summary now expose additive top-level `answerAttributionReadabilitySentence`
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now reuses `answerAttributionSummary` in one-shot and stream final payloads, and adds `answerAttributionReadabilitySentence` from summary readability text
  - `apps/api/src/modules/traces/traces.service.ts` now projects the same readability sentence into `traceSummary.answerAttributionReadabilitySentence` for top-level trace readability access
  - `packages/shared/src/trace-contracts.ts` and `apps/web/src/types/api.ts` are aligned with the additive field (`TraceSummary.answerAttributionReadabilitySentence` + optional `AskResponse.answerAttributionReadabilitySentence`)
  - focused tests updated in `apps/api/test/traces.service.test.js`, `apps/api/test/ask-success.test.js`, and `apps/api/test/ask-stream-service.test.js`
  - scope remains readability-only contract convergence: no retrieval behavior changes, no source expansion changes, no persistence/schema semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/traces.service.test.js test/ask-success.test.js test/ask-stream-service.test.js`
  - 实测结果：focused API tests passed (`74/74`)

- ✅ trace detail execution summary now surfaces trace-summary provenance readability rows
  - `apps/web/src/pages/traces/TraceDetailPage.tsx` now adds two additive execution-summary rows bound to existing trace-summary fields: `answerProvenanceSentence` and `missingInformationProvenanceSentence`
  - `apps/web/test/ui-review-regressions.test.js` adds one focused UI regression guard to ensure these provenance rows remain visible in trace detail
  - scope remains web read-model surfacing only: no backend contract changes, no trace-summary generation logic changes, no page redesign
  - 新增 / 更新验证：
    - `node --test apps/web/test/ui-review-regressions.test.js`

- ✅ trace summary `strategyReadabilityLabel` now avoids ambiguous `fallback: none` wording when fallback usage is known true
  - `apps/api/src/modules/traces/traces.service.ts` now renders `fallback: unspecified` (instead of `fallback: none`) when resolved strategy summary indicates `usedFallback=true` but `fallbackReason` is missing (legacy partial metadata path)
  - `apps/api/test/traces.service.test.js` updates the legacy top-level `usedFallback` regression expectation to guard the new wording
  - scope remains readability-only for resolved strategy summary fallback traces: no retrieval execution semantics, mode resolution, persistence schema, or API route changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；legacy fallback traces with missing reason now read as `fallback: unspecified; fallback used: yes`

- ✅ trace summary now enforces contract-safe enum values for `answerTextSource` / `answerStatusSource`
  - `apps/api/src/modules/traces/traces.service.ts` now normalizes these two fields through explicit trace-contract enum guards, so out-of-contract legacy/raw values no longer leak into `traceSummary` typed fields
  - invalid/raw source values are still preserved in readability labels (`unknown ... (<raw>)`) for diagnostics readability
  - `apps/api/test/traces.service.test.js` updates the invalid-stage regression path to assert contract-safe `null` values plus preserved raw readability labels
  - scope remains trace read-model contract guard only: no retrieval/answering execution semantics, persistence schema, or API route changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed (`26/26`)

- ✅ ask / ask-stream final payload now expose additive `answerEvidenceSource` + `answerEvidenceSourceReadabilityLabel` aligned with trace-summary evidence-source wording
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now includes the two fields in both one-shot ask and stream final payload using the existing attribution-source resolution path (`answerEvidenceSource` mirrors `answerAttributionSource`)
  - `apps/web/src/types/api.ts` `AskResponse` now includes optional `answerEvidenceSource` + `answerEvidenceSourceReadabilityLabel` to keep web-side contract typing aligned with backend payload
  - `apps/api/test/ask-success.test.js` and `apps/api/test/ask-stream-service.test.js` now assert the new fields on representative one-shot and stream final response paths
  - scope remains additive/read-model contract alignment only: no retrieval execution semantics, ranking/defaults, or source-family behavior changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ask-success.test.js test/ask-stream-service.test.js`
  - 实测结果：focused ask tests passed (`48/48`)

- ✅ ask / ask-stream final payload now expose additive top-level `retrievalModeProvenanceSentence` aligned with trace-summary wording
  - `apps/api/src/modules/retrieval/strategy-readability.ts` now exports `buildRetrievalModeProvenanceSentence(...)` using the existing trace-summary wording variants, and `apps/api/src/modules/traces/traces.service.ts` now reuses this shared helper
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now includes `retrievalModeProvenanceSentence` in both one-shot ask and stream final payloads from existing `retrievalMetadata.strategySummary` fields (`retrievalMode`, `usedFallback`, `fallbackReason`)
  - `apps/web/src/types/api.ts` `AskResponse` now includes optional `retrievalModeProvenanceSentence` to keep web-side contract typing aligned
  - `apps/api/test/ask-success.test.js` and `apps/api/test/ask-stream-service.test.js` add focused assertions for one-shot and stream final payloads
  - scope remains additive/readability-only contract alignment: no retrieval behavior changes, no persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ask-success.test.js test/ask-stream-service.test.js`
  - 实测结果：focused ask tests passed (`48/48`)

- ✅ ask / ask-stream final payload now expose additive top-level missing-information source readability fields aligned with trace-summary wording
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now includes `missingInformationSource` and `missingInformationSourceReadabilityLabel` in both one-shot ask and stream final payloads, derived directly from existing `answeringMetadata.missingInformationSource`
  - `apps/web/src/types/api.ts` `AskResponse` now includes optional `missingInformationSource` + `missingInformationSourceReadabilityLabel` to keep web-side contract typing aligned
  - `apps/api/test/ask-success.test.js` and `apps/api/test/ask-stream-service.test.js` now assert these fields on one-shot and stream final paths (`none` and `model` source cases)
  - scope remains additive/readability-only contract alignment: no retrieval behavior changes, no persistence/schema changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ask-success.test.js test/ask-stream-service.test.js`

- ✅ feed Atom canonical alternate-link extraction now accepts mixed-case multi-token `rel` values containing `alternate`
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now treats Atom `<link rel>` as tokenized (case-insensitive) and continues preferring canonical alternate href when any `rel` token is `alternate`
  - `apps/api/test/parsing.test.js` adds one focused regression for `rel="Via ALTERNATE preview"` to guard canonical alternate-link preference over self link
  - scope remains one feed parsing edge case only: no feed dedup/refresh-window/source-family behavior changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed (`30/30`)

- ✅ 继续压缩 web 首屏负担，去掉了不必要的外链字体和首屏通知层
  - `apps/web/src/styles/global.css` now uses a local/system font stack only, so the app no longer depends on Google Fonts at runtime
  - `apps/web/index.html` no longer preconnects to Google Fonts origins
  - `apps/web/src/app/App.tsx` removed the always-mounted Mantine notifications layer and its stylesheet import
  - `apps/web/src/styles/theme.ts` now uses the same system font stack for Mantine theme text and headings
  - `apps/web/src/app/AppShell.tsx` no longer hard-codes a missing display font family for the shell brand mark and title
  - `apps/web/src/features/api/hooks.ts` now allows shell-level queries to be deferred until hydration, so the workspace badges do not compete with the first paint
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/web build`
  - 实测结果：web build passed again, with the main initial JS chunk dropping from roughly 442.73 kB to 396.95 kB and HTML shrinking slightly as well

- ✅ 5174 Lighthouse static test setup now avoids cross-origin API calls
  - `apps/web/src/lib/api.ts` now uses a same-origin `/api` base when the app is served from port 5174
  - `apps/web/serve-dist.mjs` now reverse-proxies `/api/*` to the local API server on `localhost:3000`
  - this removes the browser-side CORS dependency for local Lighthouse testing while preserving the static dist serving path, brotli compression, and cache headers
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/web build`
    - `node --check apps/web/serve-dist.mjs`
    - `curl http://127.0.0.1:5174/api/health`
  - 实测结果：`/api/health` now returns the proxied API response from 3000 through 5174 without cross-origin fetches

- ✅ web entry now has better SEO and lower initial route weight
  - `apps/web/src/app/router.tsx` now lazy-loads route pages instead of statically importing every page component up front, which should reduce initial JS pressure and unused bundle weight
  - `apps/web/index.html` now includes a meta description plus font preconnect hints
  - `apps/web/public/robots.txt` now exists with valid allow-all syntax so the app has a real robots file for crawler audits
  - this is a frontend performance/SEO hardening increment only: no backend contract changes and no visual redesign
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/web build`
  - 实测结果：web build passed after the route-splitting and SEO header update

- ✅ feed Atom canonical link extraction now tolerates single-quoted attributes and `rel`/`href` order variants
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now parses Atom `<link>` tag attributes quote-agnostically and resolves canonical entry links by preferring `rel="alternate"` regardless of attribute order; when no alternate link exists, existing first-link fallback remains
  - `apps/api/test/parsing.test.js` adds focused regression coverage for Atom entries using single-quoted `rel`/`href` attributes in both `rel->href` and `href->rel` orders
  - scope remains one feed parsing edge case only: no refresh-window changes, no dedup redesign, no new source-family work
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed (`29/29`)

- ✅ sitemap source fetch now tolerates missing/`text/plain` content-type only when payload clearly looks like sitemap XML
  - `apps/api/src/infra/sitemap-source/sitemap-source.service.ts` now applies one narrow sitemap payload fallback in both root sitemap fetch and child sitemap fetch path: when `content-type` is missing (`unknown`) or starts with `text/plain`, payloads containing `<urlset>` or `<sitemapindex>` proceed through existing sitemap parsing
  - strict behavior is preserved for non-sitemap payloads under `text/plain`/missing content-type (`Unsupported sitemap content type` remains)
  - `apps/api/test/parsing.test.js` adds focused regression coverage for sitemap-index root `unknown` content-type + child `text/plain` sitemap XML acceptance, and a guard test that `text/plain` non-XML payload still fails
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed (`28/28`)

- ✅ sitemap-index parsing now accepts namespaced XML tags (`<sm:sitemapindex>`, `<sm:urlset>`) in one-level index expansion flow
  - `apps/api/src/infra/sitemap-source/sitemap-source.service.ts` now uses namespace-tolerant sitemap regex patterns for root format detection and `<url>/<loc>` / `<sitemap>/<loc>` extraction, so valid prefixed sitemap-index payloads no longer fail as unsupported format
  - `apps/api/test/parsing.test.js` adds focused regression coverage for namespaced sitemap-index + namespaced child urlset parsing
  - scope remains one sitemap-index parsing edge case only: no new source family, no retry-policy rewrite, no ingestion/persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed (`26/26`)；带 XML namespace 前缀的 sitemap-index/child-urlset 现在可正常展开页面并继续抓取内容

- ✅ feed freshness window selection now avoids timestamp-only reordering when feed entries have mixed date availability
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now keeps the original feed polling order (`slice(0, maxItems)`) when `maxItems` truncation applies but extracted entries contain mixed timestamp availability (some entries dated, some undated)
  - this closes one narrow stale-feed refresh gap in existing `feed` source updates: undated entries (common in partial/legacy feeds) are no longer dropped purely because other entries include parseable dates
  - full freshness sort-by-date behavior is preserved when all candidate entries have timestamps
  - `apps/api/test/parsing.test.js` adds focused regression coverage for the mixed-timestamp truncation path
  - scope remains feed refresh-window selection only: no new source family, no retry-policy rewrite, no ingestion/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed (`25/25`)；feed 轮询窗口在“日期字段混合缺失”场景下现在优先保持源顺序，避免把顶部无日期的新条目误当成旧条目而被截断

- ✅ external-source stale-run guard now short-circuits before remote fetch when a newer document version is already active
  - `apps/api/src/modules/documents/documents.service.ts` now applies a pre-fetch stale guard (`shouldContinueCurrentExternalRun`) immediately after reserving/queueing an external-source run (`createWebPageDocument` / `createFeedDocument` / `createSitemapDocument` / `resyncExternalDocument`), so superseded runs are skipped before calling remote source fetchers
  - this closes one narrow duplicate-fetch edge case in concurrent external resync/create paths: when version `N` is superseded by `N+1` before fetch starts, the stale `N` run no longer performs redundant upstream HTTP fetch + local generated-file persistence attempt
  - `apps/api/test/external-source-sync.test.js` adds focused coverage for this pre-fetch stale path (`createWebPageDocument` skips fetch and records `EXTERNAL_SOURCE_RUN_SUPERSEDED`)
  - scope remains stale-run guard only: no source-family expansion, no retry-policy rewrite, no ingestion/persistence schema changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/external-source-sync.test.js`
  - 实测结果：focused external-source sync tests passed；并发场景下被新版本 supersede 的旧 run 会在 fetch 前直接标记 skipped，不再重复抓取同一 external source

- ✅ external-source redirect diagnostics now fail clearly when upstream redirect response omits `Location`
  - `apps/api/src/infra/http/fetch-with-retry.ts` now treats `301/302/303/307/308` without `Location` as an explicit redirect-follow failure: `Failed to follow redirect for <url>: missing redirect location header.`
  - this closes one narrow redirect edge case across existing `web page` / `feed` / `sitemap` fetches: malformed redirect responses no longer flow downstream as opaque non-2xx HTTP/content-type failures
  - `apps/api/test/fetch-with-retry.test.js` adds focused coverage for the missing-`Location` redirect path
  - scope remains redirect diagnostics-only: no source-family expansion, no retry-policy rewrite, no ingestion/persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - 实测结果：focused fetch-with-retry tests passed；当上游返回 `302` 但缺失 `Location` header 时，错误现在会直接提示 `missing redirect location header`，便于快速定位上游响应问题

- ✅ feed source fetch now accepts RSS/Atom XML payload when upstream content-type is mis-labeled as `text/plain`
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now adds one narrow fallback: when `content-type` is missing (`unknown`) or starts with `text/plain`, and payload clearly looks like feed XML (`<rss>` / `<feed>`), it proceeds with existing feed parsing instead of immediately failing with `Unsupported feed content type`
  - this closes one narrow HTTP response edge case for existing `feed` source ingestion where upstream serves valid RSS/Atom payload but labels response as plain text
  - behavior remains strict for explicit non-feed content types/payloads (unsupported content-type and unsupported feed format paths are preserved)
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed；被标成 `text/plain` 的 RSS/Atom feed payload 现在可以继续解析并生成内容，不再在 source-fetch 阶段被误判为 unsupported content type

- ✅ external-source fetch failures now include exhausted retry-attempt context on final network/timeout errors
  - `apps/api/src/infra/http/fetch-with-retry.ts` now appends one additive suffix on final retry-exhausted fetch exceptions: `(after <N> attempts).` (for `Fetch request failed ...` and `Fetch request timed out ...` paths only)
  - this closes one narrow fetch-visibility gap across existing `web page` / `feed` / `sitemap` source families: diagnostics can now immediately distinguish one-shot failure from retry-exhausted failure without inferring from runtime config
  - `apps/api/test/fetch-with-retry.test.js` adds focused coverage for the retry-exhausted network-failure path (`attempts=2`)
  - scope remains diagnostics-only: no source-family expansion, no retry-policy rewrite, no ingestion/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - 实测结果：focused fetch-with-retry tests passed (`11/11`)；重试耗尽时错误消息现在会显式附带尝试次数（例如 `... (after 2 attempts).`）

- ✅ feed-source dedup now prefers canonical entry link identity to avoid duplicate ingestion when metadata drifts
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now resolves feed-entry dedup key as:
    - `link:<normalized-link>` when link exists (including relative-link resolution against feed URL and hash stripping)
    - fallback to metadata-only key (`title + publishedAt + summary`) when link is missing
  - this closes one narrow duplicate-ingest edge case in existing `feed` source flow: repeated entries with the same URL but changed title/summary/pubDate are now treated as duplicates and skipped
  - `apps/api/test/parsing.test.js` adds focused regression coverage for same-link feed entries with different metadata
  - scope remains dedup-guard-only: no source-family expansion, no retry-policy rewrite, no ingestion/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed (`23/23`)

- ✅ external-source re-sync now recovers legacy web-page documents when stored `sourceConfigJson` is missing
  - `apps/api/src/modules/documents/documents.service.ts` now applies one narrow legacy fallback during `POST /documents/:id/reindex` parsing: when external config is missing but the document identity is still `sourceType=web_page` + `sourceName=<url>`, re-sync reconstructs `{ kind: "web_page", url: sourceName }` and continues re-fetch instead of failing early with `EXTERNAL_SOURCE_CONFIG_INVALID`
  - `apps/api/test/external-source-sync.test.js` adds focused regression coverage for this stale-state path (`sourceConfigJson: null` on a legacy web-page document) and asserts re-sync proceeds through fetch/finalize/enqueue
  - scope remains re-sync recovery only: no new source family, no retry-policy rewrite, no ingestion/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/external-source-sync.test.js`
  - 实测结果：focused external-source sync tests passed；legacy web-page source config 丢失时不再直接失败，可继续 remote re-fetch 并进入后续 ingestion

- ✅ sitemap source URL dedup now ignores hash-only differences to avoid duplicate page fetches in urlset/sitemapindex flows
  - `apps/api/src/infra/sitemap-source/sitemap-source.service.ts` now normalizes sitemap URL dedup keys by stripping URL fragment (`#...`) before duplicate checks for:
    - direct `urlset` page URL extraction
    - merged page URL collection across `sitemapindex` child sitemaps
    - child sitemap URL extraction from `sitemapindex`
  - this closes one narrow external-source duplication failure mode: the same page/sitemap repeated with hash-only variants (for example `.../page#intro` vs `.../page#summary`) no longer consumes `maxPages` budget or causes redundant page fetch attempts
  - `apps/api/test/parsing.test.js` adds focused regression coverage for hash-only duplicate page URLs across sitemap-index children
  - scope remains duplicate-suppression-only: no source-family expansion, no retry-policy rewrite, no ingestion/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed

- ✅ external-source fetch-failure diagnostics now include explicit source identity fields for run-level attribution
  - `apps/api/src/modules/documents/documents.service.ts` now appends additive `sourceType` + `sourceName` fields on `EXTERNAL_SOURCE_FETCH_FAILED` diagnostics when current document context is available
  - this closes one narrow source-execution visibility gap: failed runs can now be attributed to the exact source family and normalized source URL without relying only on free-form error message parsing
  - `apps/api/test/external-source-sync.test.js` updates the existing web-page fetch-failure assertion path to guard the new diagnostic fields on both document failure state and run failure record
  - scope remains diagnostics-only: no retry-policy changes, no ingestion state/persistence semantics changes, no source-family expansion
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/external-source-sync.test.js`
  - 实测结果：focused external-source sync tests passed (`23/23`)

- ✅ P0 closeout queue `opencode model split review`：当前 root/api/web 分工保持不变（无需调整）
  - 复核文件：`opencode.jsonc`、`apps/api/opencode.jsonc`、`apps/web/opencode.jsonc`
  - 结论：继续保持 `plan/review-risk -> gpt-5.4`、`build -> gpt-5.3-codex`、`explore -> gpt-5.3-mini`
  - 保持原因：
    - root 与 app-local 配置当前语义一致，未出现分工漂移
    - 当前进度未记录由模型分工导致的稳定质量回归或持续成本/时延压力
    - 现有分工已匹配本阶段“plan/review 质量优先、build 快验证、explore 低成本检索”的执行策略
  - 未变更内容：未改 loop harness、未改 command 模板语义、未改 plugin 边界

- ✅ opencode loop harness cleanup is complete
  - `scripts/opencode-loop/jsonc.mjs` now handles repo config comments, so `scripts/opencode-loop/runtime.mjs` stays focused on orchestration
  - self-test passed after the split: `node scripts/opencode-loop.mjs --self-test`
  - loop has been stopped cleanly; `p0-complete-010` is done and `007` / `009` remain `deferred`
  - docs now keep commit cadence and push/PR timing separate from the harness itself

- ✅ embedding runtime diagnostics now make partial OpenAI embedding env drift and model-source resolution easier to spot
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now adds one additive unusable-provider hint when `OPENAI_EMBEDDING_MODEL` is set without `OPENAI_API_KEY` (and includes configured `OPENAI_BASE_URL` when present)
  - OpenAI embedding dimension-mismatch diagnostics now also include `Resolved OpenAI embedding model source: <env|default>` so it is explicit when the default model path won
  - `apps/api/test/embedding-runtime-config.test.js` adds focused coverage for the new unusable-provider wording and model-source hint
  - scope remains diagnostics-only: no provider-order changes, no retrieval behavior changes, no schema/persistence changes

- ✅ P0 closeout queue `eval/regression baseline`：已补最小可复用回归基线清单
  - 变更文件：`docs/next_steps_rag_project_plan.md`（在 queue item 8 下补充 closeout wave baseline）
  - baseline 命令（可重复执行）：
    - `pnpm test:api:file -- test/traces.service.test.js`
    - `pnpm test:api:file -- test/ask-success.test.js`
    - `node --test apps/web/test/trace-summary-contract.test.js`
  - 回归确认口径：三条命令全部通过即可判定本轮 ask/trace contract closeout 未回归；失败时先在对应路径修复后重跑同一组命令
  - 未变更内容：未引入新测试框架、未改 backend/web 运行时语义、未改 retrieval 或持久化行为

- ✅ P0 closeout queue `progress closeout note`：已补本轮简短收口记录
  - 变更内容：仅追加 `docs/current-progress.md` 当前进展条目，记录本轮完成状态
  - 未变更内容：未改 `apps/api` / `apps/web` / `packages/shared` 实现，未改 retrieval 语义、共享契约或持久化行为
  - 验证：`git diff --check -- "docs/current-progress.md"` 通过

- ✅ P0 closeout queue 已按计划完成，当前波次收口结束
  - `docs/next_steps_rag_project_plan.md` 已补入详细 queue-ready tasks，并附上可直接作为 queue item title 使用的短标题版：`ask/trace contract align`、`web trace contract guard`、`legacy fallback regressions`、`unknown/fallback wording unify`、`trace-summary doc sync`、`progress closeout note`、`third-party boundary note`、`eval/regression baseline`、`opencode model split review`、`mark P0 complete`
  - 完成结论：本轮仅做既定 closeout，不引入新方向；`P0: read-model / metadata convergence` 现已可标记完成

- ✅ P0 closeout queue `mark P0 complete`：已完成 phase closeout 状态更新
  - 变更文件：`docs/next_steps_rag_project_plan.md`、`docs/current-progress.md`
  - 完成说明：仅更新 P0 状态与收口结论，不追加新实现任务

- ✅ opencode loop now has a dedicated read-model/metadata build prompt template in the prompt path
  - added `.opencode/loop/prompts/read-model-metadata-build.md` to avoid reusing generic `prompts/build.md` wording for read-model/metadata convergence queue work
  - `scripts/opencode-loop/runtime.mjs` now ensures the dedicated prompt template exists under `.opencode/loop/prompts/` alongside existing default prompt bootstrap
  - `scripts/opencode-loop.md` prompt-family guidance and queue example now point read-model/metadata items to `prompts/read-model-metadata-build.md`
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；loop prompt path 现在提供了专用 read-model/metadata build 模板，不再要求这类任务复用 generic build prompt wording

- ✅ trace summary unknown/fallback readability wording now aligns for failed-stage and answer-source labels
  - `apps/api/src/modules/traces/traces.service.ts` now keeps known labels unchanged, while aligning null-fallback wording to `failed stage unavailable` / `answer status source unavailable` / `answer text source unavailable`; raw unknown values still keep `unknown ... (<raw>)`
  - `apps/api/test/traces.service.test.js` updates focused assertions for the aligned null-fallback wording
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；本轮仅收口可读文案，不改 retrieval 语义、契约、持久化或其他无关标签

- ✅ trace summary legacy fallback coverage now includes execution-level `fallbackReason -> strategySummary.usedFallback` backfill path
  - `apps/api/test/traces.service.test.js` adds one focused regression case to lock consistency when older retrieval metadata only has `retrievalMetadata.execution.fallbackReason` (missing explicit `usedFallback` fields)
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed (`24/24`)；legacy execution fallback-reason-only traces now have explicit regression guard that `traceSummary.strategySummary.usedFallback` resolves to `true` and aligns with strategy readability wording

- ✅ opencode loop now correctly parses repo `opencode.jsonc` comments for command model split
  - `scripts/opencode-loop/runtime.mjs` now strips JSONC line/block comments before parsing the repo command config, so `command.plan` / `command.build` can be loaded from `opencode.jsonc`
  - this closes the earlier fallback-to-`server-default` path when the repo config contained comments
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；loop 现在可以正确读取带注释的 `opencode.jsonc`，不再因为 `JSON.parse` 直接失败而忽略模型分工配置

- ✅ opencode loop can now auto-refill a small follow-up queue wave before exiting
  - added `scripts/opencode-loop/planner.mjs` as a guarded planner path that uses the repo `command.plan` agent/model when available, asks for strict JSON follow-up tasks, writes planner audit handoffs, and materializes generated prompts under `.opencode/loop/prompts/generated/`
  - `scripts/opencode-loop/runtime.mjs` now triggers one optional refill pass when the queue drains, appends generated items back into `.opencode/loop/queue.json`, then keeps processing them in the same run
  - `scripts/opencode-loop/queue.mjs` now exposes `appendQueueItems(...)` for atomic append-style queue growth during refill; `scripts/opencode-loop.mjs` now supports `OPENCODE_LOOP_AUTO_REFILL_MAX_CYCLES` and `OPENCODE_LOOP_AUTO_REFILL_MAX_ITEMS`
  - tuned `.opencode/loop/prompts/plan-next.md` toward the current repository wave (single-line mainline, backend/API-first, additive read-model/diagnostics/contract closeout) and set the systemd loop service template to run with `OPENCODE_LOOP_AUTO_REFILL_MAX_CYCLES=2`
  - `scripts/opencode-loop/self-test.mjs` now covers three harness paths together: normal draining, interrupted-session resume, and one guarded auto-refill cycle
  - `scripts/opencode-loop.md` now documents the planner/refill behavior and the new env knobs
  - scope kept conservative on purpose: default refill budget is one planner pass and two generated items per loop invocation, so the runner can continue automatically without turning into an unbounded self-expanding queue
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；空队列时 loop 现在可先生成一小波后续任务并继续执行，同时保留 planner handoff 审计轨迹

- ✅ current-progress closeout note appended for this increment
  - changed files: `docs/current-progress.md`
  - focused validation: `git diff --check -- "docs/current-progress.md"`

- ✅ ask final payload and trace summary now share one backend helper for answer-attribution readability wording
  - added `apps/api/src/modules/answering/answer-attribution-summary.ts` with `buildAnswerAttributionSummary(...)` to centralize attribution/source label and readability sentence/resolved-label mapping
  - `apps/api/src/modules/traces/traces.service.ts` now uses the shared helper when composing `traceSummary.answerAttributionSummary`
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now uses the same shared helper for ask final payload `answerAttributionSummary`
  - scope kept additive/readability-only; no retrieval behavior changes, no schema/persistence changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 46/46 passed；ask final payload 与 trace summary 的 attribution readability wording now comes from the same helper path, reducing drift risk

- ✅ trace summary now exposes additive `rewriteReadabilityLabel` for one-line rewrite provenance readability
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `rewriteReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.rewriteReadabilityLabel` from resolved rewrite metadata (`rewriteEnabled` / `rewriteApplied` / `rewriteUsedFallback` / `rewritePromptId`) with stable wording (`rewrite <enabled|disabled>; rewrite applied: <yes|no>; rewrite fallback: <yes|no|unknown>; rewrite prompt: <id|unknown>.`)
  - `apps/api/test/traces.service.test.js` now asserts the new field in both default/no-rewrite and rewrite-fallback strategy-summary paths; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field
  - `docs/current-dev-setup.md` trace-summary field list now includes `rewriteReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 rewrite 启用/是否生效/是否 fallback/prompt 来源的一行可读摘要，减少跨字段拼接阅读成本

- ✅ OpenAI embedding dimension-mismatch guardrail now logs the resolved embedding endpoint for faster config drift diagnosis
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now appends one additive endpoint hint on OpenAI dimension mismatch: `Resolved OpenAI embedding endpoint: <OPENAI_BASE_URL>/embeddings.`
  - this keeps the increment strictly diagnostics-only on one existing guardrail path: no provider-order changes, no retrieval behavior changes, no schema/persistence changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/embedding-runtime-config.test.js`
  - 实测结果：focused embedding runtime config tests passed；当 OpenAI embedding 返回维度与模型不匹配时，报错会同时给出当前实际命中的 embedding endpoint，便于直接识别 `OPENAI_BASE_URL` 端点漂移

- ✅ OpenAI embedding dimension-mismatch diagnostics now explicitly clarify default-model fallback selection
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now appends one extra hint only when OpenAI embedding model selection comes from the default path (`OPENAI_EMBEDDING_MODEL` unset): `OPENAI_EMBEDDING_MODEL is unset, so the default embedding model "text-embedding-3-small" is currently in use.`
  - `apps/api/test/embedding-runtime-config.test.js` now adds focused coverage for this default-model mismatch wording
  - this is a narrow embedding model-selection clarity increment only: no provider-order changes, no retrieval behavior changes, no schema/persistence changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/embedding-runtime-config.test.js`
  - 实测结果：focused embedding runtime config tests 13/13 passed；当 OpenAI embedding 维度不匹配且模型来自默认路径时，报错会明确提示“当前在用默认模型”，降低“未显式设置模型却误以为用了自定义模型”的排障歧义

- ✅ feed-source entry dedup now ignores URL hash-only differences to avoid duplicate ingestion of the same entry
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now normalizes feed entry dedup links by stripping URL fragment (`#...`) before dedup key comparison (with existing safe fallback for non-URL link strings)
  - this is a narrow dedup guard increment for existing `feed` source extraction only: no source-family expansion, no fetch retry policy change, no ingestion persistence/schema behavior change
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed；当同一 feed entry 仅 `#fragment` 不同（如 `.../a#top` 与 `.../a#latest`）时，现在会被视为重复条目并跳过后者，避免重复 entry 写入生成内容

- ✅ external-source fetch network-failure errors now include explicit source URL attribution
  - `apps/api/src/infra/http/fetch-with-retry.ts` now normalizes non-redirect fetch exceptions into `Fetch request failed for <url>: <original message>` while preserving existing redirect-follow diagnostics wording
  - this is a narrow source-fetch diagnostics increment for existing `web page` / `feed` / `sitemap` paths only: no source-family expansion, no retry-policy rewrite, no ingestion/persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - 实测结果：focused fetch-with-retry tests passed；当上游网络失败仅返回通用 `fetch failed` 时，错误现在会携带具体 source URL（例如 `Fetch request failed for https://example.com/source.xml: fetch failed`），便于 run diagnostics 直接定位失败来源

- ✅ external-source fetch now reports clearer redirect-follow failures when upstream redirects to non-HTTP(S) targets
  - `apps/api/src/infra/http/fetch-with-retry.ts` now performs one bounded manual redirect-follow loop (`301/302/303/307/308`, max `5`) so invalid redirect targets can be reported deterministically; when a redirect points to non-HTTP(S) scheme, the helper now throws `Failed to follow redirect for <url>: redirect target must use http/https.`
  - this is a narrow source-fetch diagnostics increment for existing `web page` / `feed` / `sitemap` fetch paths only: no source-family expansion, no retry-policy rewrite, no ingestion state/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - 实测结果：focused fetch-with-retry tests passed；当上游返回 `302` 且 Location 为 `mailto:` 等非 HTTP(S) scheme 时，错误信息现在会直接指向“redirect target must use http/https”，不再仅返回模糊的 `fetch failed`

- ✅ opencode loop `pick` status now shows cursor-distance steps to the next pending item
  - `scripts/opencode-loop/runtime.mjs` now computes one additive visibility field in `buildQueueCursorVisibility()`:
    - `nextPendingCursorDistance`
  - the value reports how many queue steps the active cursor is away from the next pending task index (wrap-around aware)
  - this is a narrow queue observability increment only: no queue schema change, no pick/complete semantics change, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；`pick` 日志现在可直接看到“游标距离下一个 pending 任务还差几步”，无需再手动对比 `queueCursor` 与 `nextPendingItemIndex`

- ✅ opencode loop `pick` status now adds resume-preview fields around the active queue cursor item
  - `scripts/opencode-loop/runtime.mjs` now adds a small `buildActiveCursorResumeVisibility()` helper and extends the existing cursor visibility payload with:
    - `queueCursorItemTitle`
    - `queueCursorResumePreview`
    - `queueCursorResumeSessionId`
    - `queueCursorResumeMessageId`
    - `queueCursorResumeStartedAt`
  - resume-preview fields only appear when the active cursor item is `in_progress`, preserving current queue format and scheduling semantics
  - this is a narrow queue observability increment only: no queue schema change, no pick/complete behavior change, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；恢复/中断任务在 `pick` 状态里现在可直接读到“是否已有可复用 session、是否已有已跟踪 assistant message、以及该中断任务起始时间”

- ✅ opencode loop status now adds pending/completed family counts (derived from queue item id prefix)
  - `scripts/opencode-loop/runtime.mjs` now adds a small `buildQueueFamilyCountVisibility()` helper and includes two additive status fields on existing `pick` / `idle` logs:
    - `queuePendingByFamily`
    - `queueCompletedByFamily`
  - family is resolved from the queue item `id` prefix (split by `-` / `_` / `:` / `/` / `.`), preserving current queue format and scheduling behavior
  - this is a narrow queue observability increment only: no queue schema change, no pick/complete semantics change, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；状态日志现在可直接看到按任务 family/prefix 聚合的 pending/completed 计数（例如默认 `build-*` 队列会显示 `queuePendingByFamily={"build":...}`）

- ✅ trace summary `failedStageReadabilityLabel` now includes raw diagnostics stage when stage value is outside trace contract
  - `apps/api/src/modules/traces/traces.service.ts` now keeps current normalized `failedStage` behavior (`retrieval` / `answering` only) and, for non-contract stage values, emits readability wording as `unknown failed stage (<raw-stage>)` instead of dropping the raw diagnostic stage context
  - this is a narrow readability-only increment for failure traces; no retrieval execution semantics, stage normalization semantics, or persistence contracts are changed
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；当失败诊断里出现 `source_fetch` 这类非 trace 合约 stage 时，`traceSummary.failedStageReadabilityLabel` 现在会直接显示 `unknown failed stage (source_fetch)`，比仅显示 `unknown failed stage` 更易读

- ✅ trace summary `strategyReadabilityLabel` now includes explicit fallback-usage wording for clearer retrieval-mode fallback provenance
  - `apps/api/src/modules/traces/traces.service.ts` now appends `fallback used: yes|no|unknown` to existing strategy readability sentence, derived from resolved `strategySummary.usedFallback`
  - this keeps the increment additive/readability-only while preserving existing retrieval execution semantics and mode resolution behavior
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；即使 `fallbackReason` 缺失（例如 legacy 仅有 `usedFallback=true`），trace summary 一行策略摘要也能直接读出 fallback 是否发生

- ✅ trace summary now exposes additive `answerEvidenceSource` + `answerEvidenceSourceReadabilityLabel` for clearer final-answer evidence-source readability
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with:
    - `answerEvidenceSource: TraceCitationSelectionSource | null`
    - `answerEvidenceSourceReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits both fields from existing final-answer citation selection metadata, with stable fallback wording (`structured evidence source` / `inline-marker evidence source` / `heuristic evidence source` / `no evidence source` / `unknown evidence source`)
  - `apps/api/test/traces.service.test.js` now asserts the new fields for both missing-metadata and populated-metadata summary paths; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract fields
  - `docs/current-dev-setup.md` trace-summary field list now includes `answerEvidenceSource` and `answerEvidenceSourceReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 answer evidence source 的别名与可读标签，减少仅看 `citationSelectionSource` 时的语义跳转

- ✅ OpenAI embedding dimension mismatch error now includes explicit endpoint/model compatibility guidance
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now appends one actionable hint when OpenAI embedding response dimensions mismatch expected model dimensions: `Check OPENAI_EMBEDDING_MODEL and OPENAI_BASE_URL compatibility for the embedding endpoint.`
  - `apps/api/test/embedding-runtime-config.test.js` now asserts this guidance in the existing OpenAI dimension-mismatch path
  - this is a narrow embedding config diagnostics increment only: no provider-order changes, no retrieval behavior changes, no schema/persistence changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/embedding-runtime-config.test.js`
  - 实测结果：focused embedding runtime config tests passed；当代理或模型配置导致维度不匹配时，报错会直接提示检查 `OPENAI_EMBEDDING_MODEL` 与 `OPENAI_BASE_URL` 的兼容性，降低“只看到维度数字但定位不到配置漂移点”的排障风险

- ✅ external-source finalize/failure updates now use atomic `id + version` guard to avoid stale overwrite under concurrent re-sync
  - `apps/api/src/modules/documents/documents.service.ts` now applies external finalize/failure document writes through version-guarded `updateMany({ where: { id, version } })` first, instead of relying only on pre-check then blind `update`
  - when the guarded write misses (`count=0`), the existing stale-run skip path is preserved (`EXTERNAL_SOURCE_RUN_SUPERSEDED`), so stale fetch/persist responses cannot overwrite newer in-flight source versions between check and write
  - `apps/api/test/external-source-sync.test.js` now adds focused coverage for this concurrent stale-response race (`finalize uses version-guarded update`)
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/external-source-sync.test.js`
  - 实测结果：focused external-source sync tests 23/23 通过；并发 resync 下旧版本 finalize 响应即使晚到，也会被 `id+version` 原子写入保护拦截，不会回写覆盖新版本文档状态

- ✅ web-page source fetch now accepts HTML payload when upstream content-type is missing or mis-labeled as `text/plain`
  - `apps/api/src/infra/web-page/web-page.service.ts` now adds one narrow fallback: when response `content-type` is missing (`unknown`) or starts with `text/plain`, and payload clearly looks like HTML (`<!doctype html>` / `<html>` / `<head>` / `<body>` / `<title>`), it proceeds with existing HTML extraction instead of immediately failing with `Unsupported web page content type`
  - this closes one real HTTP response edge case for existing `web page` and downstream `sitemap` page fetches where upstream serves valid HTML but omits or mislabels content type
  - behavior remains strict for explicit non-HTML content types (for example `application/pdf` still fails)
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests passed；被标成 `text/plain`（或缺失 `content-type`）的 HTML 页面现在可继续提取 title/content，不再在 source-fetch 阶段被误判为 unsupported content type

- ✅ opencode loop `pick` status now previews next pending queue item index/title for faster cursor-target readability
  - `scripts/opencode-loop/runtime.mjs` now expands existing queue cursor visibility logs with:
    - `nextPendingItemIndex`
    - `nextPendingItemTitle`
  - existing `nextPendingItemId` is preserved; this is a narrow observability-only increment to make the next pending target easier to identify at a glance
  - no queue schema change, no scheduling-policy change, no pick/complete semantics change, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；`pick` 日志现在可同时看到 next pending item 的 `id + index + title`，更容易快速判断下一项具体指向

- ✅ opencode loop `idle` status now reports remaining queue work at a glance
  - `scripts/opencode-loop/runtime.mjs` now adds `buildIdleQueueWorkVisibility()` and extends the existing `logStatus("idle", ...)` payload with:
    - `remainingQueueWork`
    - `queuePending`
    - `queueInProgress`
    - `queueCompleted`
    - `queueTotal`
  - this is a narrow idle-log observability increment only: no queue schema change, no pick/complete behavior change, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；队列空闲时现在可直接看到剩余工作是否为 `0`，并同时看到 pending/in-progress/completed 的当前计数

- ✅ trace read-model now backfills `strategySummary.usedFallback` from legacy top-level `retrievalMetadata.usedFallback`
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.usedFallback` in this order: `retrievalMetadata.execution.usedFallback` -> persisted `strategySummary.usedFallback` -> legacy `retrievalMetadata.usedFallback` -> derived from resolved `fallbackReason`
  - this closes a minimal fallback-clarity gap where older traces could persist top-level fallback usage without `execution` / `strategySummary`, causing resolved strategy summary to under-report effective fallback usage
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；legacy top-level `usedFallback` metadata 下 `traceSummary.strategySummary.usedFallback` 现在可直接对齐

- ✅ trace summary now exposes additive `candidateCountReadabilityLabel` for at-a-glance candidate-flow count wording
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `candidateCountReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.candidateCountReadabilityLabel` from existing `candidateLimit` / `vectorCandidateCount` / `lexicalCandidateCount` / `mergedCandidateCount` / `rankedCandidateCount` with stable wording (`vector <V>, lexical <L>, merged <M>, ranked <R> (candidate limit <C>)`)
  - `apps/api/test/traces.service.test.js` now asserts the new field for both failed and successful trace-summary paths
  - `docs/current-dev-setup.md` trace-summary field list now includes `candidateCountReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 `candidateCountReadabilityLabel`，比分散读取多个 candidate 数字更容易一眼识别候选流规模

- ✅ trace summary now exposes additive `citationCountReadabilityLabel` for at-a-glance citation-count wording
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `citationCountReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.citationCountReadabilityLabel` from existing `citationCount` / `citationCountBeforeLimit` / `citationLimitHit` with stable wording (`no citations` / `1 citation` / `<N> citations` / `<N> citations shown (<M> before limit)`)
  - `apps/api/test/traces.service.test.js` now asserts the new field for both non-limited and citation-limit-hit trace-summary paths
  - `docs/current-dev-setup.md` trace-summary field list now includes `citationCountReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 `citationCountReadabilityLabel`，比裸 `citationCount` / `citationCountBeforeLimit` 更容易一眼识别“是否命中 citation 限制”

- ✅ trace summary now exposes additive `missingInformationCountReadabilityLabel` for at-a-glance missing-information count wording
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `missingInformationCountReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.missingInformationCountReadabilityLabel` from existing `missingInformationCount` with stable wording (`no missing-information items` / `1 missing-information item` / `<N> missing-information items`)
  - `apps/api/test/traces.service.test.js` now asserts the new field for both zero-count and singular-count trace-summary paths; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field
  - `docs/current-dev-setup.md` trace-summary field list now includes `missingInformationCountReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 `missingInformationCountReadabilityLabel`，比裸数字更容易一眼理解缺失信息条目数量

- ✅ trace summary now exposes additive `failedStageReadabilityLabel` for failed-stage readability at a glance
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `failedStageReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.failedStageReadabilityLabel` with stable wording from existing `failedStage` (`retrieval stage failed` / `answering stage failed` / `unknown failed stage`)
  - `apps/api/test/traces.service.test.js` now asserts the new field for failed and invalid-stage trace-summary paths
  - `docs/current-dev-setup.md` trace-summary field list now includes `failedStageReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 `failedStageReadabilityLabel`，更快识别失败阶段语义

- ✅ trace summary now exposes additive `answerStatusSourceReadabilityLabel` for final-answer status-source readability
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `answerStatusSourceReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerStatusSourceReadabilityLabel` with stable fallback wording (`model-decided answer status` / `retrieval-inferred answer status` / `deterministic policy answer status` / `unknown answer status source`) derived from existing `answerStatusSource`
  - `apps/api/test/traces.service.test.js` now asserts the new field for both missing-metadata and populated-metadata trace-summary paths
  - `docs/current-dev-setup.md` trace-summary field list now includes `answerStatusSourceReadabilityLabel`
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 20/20 passed；trace summary 现在可直接读取 `answerStatusSourceReadabilityLabel` 来快速识别最终答案状态来源语义

- ✅ trace summary now exposes additive `answerTextSourceReadabilityLabel` for final-answer text-source readability
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `answerTextSourceReadabilityLabel: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerTextSourceReadabilityLabel` with stable fallback wording (`model-generated answer text` / `deterministic policy answer text` / `unknown answer text source`) derived from existing `answerTextSource`
  - `apps/api/test/traces.service.test.js` now asserts the new field for both missing-metadata and populated-metadata trace-summary paths
  - compatibility preserved: additive trace read-model readability only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取 `answerTextSourceReadabilityLabel` 来快速识别最终答案文本来源语义

- ✅ opencode loop `pick` status now includes queue cursor item and next pending item at a glance
  - `scripts/opencode-loop/runtime.mjs` now adds `buildQueueCursorVisibility()` and extends the existing `logStatus("pick", ...)` payload with:
    - `queueCursor`
    - `queueCursorItemId`
    - `queueCursorItemStatus`
    - `nextPendingItemId`
  - this is a narrow queue observability increment only: no queue schema change, no pick/complete behavior change, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；`pick` 日志现在可同时看到“当前游标指向哪个任务”与“下一个 pending 任务 id”，更快判断当前项与后续项

- ✅ trace summary now exposes additive `missingInformationProvenanceSentence` for one-line missing-information provenance readability
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `missingInformationProvenanceSentence: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.missingInformationProvenanceSentence` with stable fallback wording (`Missing-information source is <...>; insufficient-context reason is <...>; missing-information count is <...>.`) from existing `missingInformationSource` / `insufficientContextReason` / `missingInformationCount`
  - `apps/api/test/traces.service.test.js` now asserts the new field for both missing-metadata and populated-metadata trace-summary paths; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field
  - compatibility preserved: additive trace read-model clarity only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取一行 `missingInformationProvenanceSentence` 来快速识别缺失信息来源、insufficient-context 原因与缺失条目数量

- ✅ opencode loop now recovers stale "end-of-queue" cursor when pending items still exist
  - `scripts/opencode-loop/queue.mjs` now treats `cursor === items.length` with remaining pending items as recoverable stale state and normalizes it back to the first safe pending index (`reason: "past_pending"`)
  - `scripts/opencode-loop/self-test.mjs` now adds focused coverage for this `past_pending` cursor recovery edge case
  - this is a narrow queue guardrail increment only: no queue schema change, no scheduling-policy change, no pick/complete semantics redesign
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；当手工把游标放到队列尾部但仍有 pending 任务时，loop 会先回写安全游标并继续按既有 pending 选择逻辑执行

- ✅ embedding runtime now derives OpenAI embedding endpoint from `OPENAI_BASE_URL`
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now resolves OpenAI embedding `apiUrl` as `${OPENAI_BASE_URL}/embeddings` (with existing default `https://api.openai.com/v1`), instead of hard-coding only the hosted OpenAI endpoint
  - `apps/api/test/embedding-runtime-config.test.js` now adds focused coverage for the `OPENAI_BASE_URL`-derived embedding endpoint path
  - `docs/current-dev-setup.md` now clarifies that `OPENAI_BASE_URL` applies to both chat/rewrite and embeddings
  - this is a narrow backend env/default alignment increment only: no provider ordering changes, no retrieval behavior changes, no schema/persistence changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/embedding-runtime-config.test.js`
  - 实测结果：focused embedding runtime config tests passed；当使用 OpenAI-compatible proxy 时，embedding 请求不再默认漂移到 hosted OpenAI 根端点

- ✅ trace summary now exposes additive `answerProvenanceSentence` for one-line final-answer provenance readability
  - `packages/shared/src/trace-contracts.ts` extends `TraceSummary` with `answerProvenanceSentence: string`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerProvenanceSentence` using stable fallback wording (`Answer text source is <...>; status source is <...>; attribution summary is <...>.`) from existing `answerTextSource` / `answerStatusSource` and resolved attribution label
  - `apps/api/test/traces.service.test.js` now asserts the new field for both missing-metadata and populated-metadata trace-summary paths; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field
  - compatibility preserved: additive trace read-model clarity only; no retrieval execution semantics/source scope/schema-persistence behavior changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed；trace summary 现在可直接读取一行 `answerProvenanceSentence` 来快速识别最终答案文本来源、答案状态来源与归因摘要

- ✅ embedding runtime now rejects orphan `OLLAMA_EMBEDDING_DIMENSIONS` config when Ollama embedding provider is not enabled
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now fails fast when `OLLAMA_EMBEDDING_DIMENSIONS` is set without Ollama provider prerequisites (`OLLAMA_BASE_URL` + `OLLAMA_EMBEDDING_MODEL` or `OLLAMA_MODEL`), instead of silently ignoring the dimension guardrail setting
  - `apps/api/test/embedding-runtime-config.test.js` now adds focused coverage for this orphan-env guardrail path
  - this is a narrow backend config validation increment only: no provider selection order changes, no retrieval behavior changes, no schema or persistence changes
  - 新增 / 更新验证：
    - `pnpm test:api:fast:llm`
  - 实测结果：focused embedding runtime config tests passed；配置了 `OLLAMA_EMBEDDING_DIMENSIONS` 但未启用 Ollama provider 时会立刻报错，避免“以为启用了维度 guardrail、实际未生效”的静默漂移

- ✅ opencode loop now auto-recovers out-of-range queue cursor before picking work
  - `scripts/opencode-loop/queue.mjs` now adds `resolveQueueCursor()` and uses it in `pickNextItem()`, so a stale manual cursor like `cursor: 99` no longer stays opaque and is normalized to a safe pending index
  - `scripts/opencode-loop/runtime.mjs` now persists the corrected cursor and logs one explicit `游标恢复` status with `cursorFrom` / `cursorTo` / `cursorReason`
  - `scripts/opencode-loop/self-test.mjs` now includes focused coverage for the out-of-range cursor recovery edge case
  - this is a narrow queue guardrail increment only: no queue schema changes, no new scheduling policy, no pick/complete semantics redesign
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；当队列游标越界时，loop 会先回写安全游标并记录恢复原因，然后继续按现有 pending 任务选择逻辑执行

- ✅ opencode loop `pick` status now also shows completed queue count at a glance
  - `scripts/opencode-loop/runtime.mjs` now extends queue visibility fields with `queueCompleted` in the existing `logStatus("pick", ...)` summary
  - this is a narrow observability-only increment for queue status logs: no queue schema changes, no pick/complete behavior changes, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；`pick` 日志现在可同时看到 `queuePending` 与 `queueCompleted`，更容易快速判断剩余与已完成进度

- ✅ external source re-sync now recovers legacy feed/sitemap bounds when stored source config misses `maxItems` / `maxPages`
  - `apps/api/src/modules/documents/documents.service.ts` now treats missing `maxItems` / `maxPages` in persisted external source config as a legacy shape and falls back to the existing default bound `20` during `POST /documents/:id/reindex` re-sync parsing
  - this closes one stale-state missed-update scenario where older external source documents could fail re-sync with `EXTERNAL_SOURCE_CONFIG_INVALID` before any re-fetch, even though URL/kind were still valid
  - `apps/api/test/external-source-sync.test.js` now adds focused coverage for a legacy feed config (kind+url only) and asserts re-sync proceeds with `maxItems: 20`
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/external-source-sync.test.js`
  - 实测结果：focused external-source sync tests passed；legacy feed/sitemap config 缺失数量边界时不再直接失败，可继续触发 re-fetch 并进入后续 ingestion

- ✅ external-source fetch retry now also treats upstream HTTP 408 as transient
  - `apps/api/src/infra/http/fetch-with-retry.ts` now retries once for `408` in addition to existing `429` / `5xx` statuses, so transient upstream request-timeout responses in existing `web page` / `feed` / `sitemap` fetch paths are less likely to fail immediately
  - `apps/api/test/fetch-with-retry.test.js` now adds focused coverage for `408 -> 200` retry recovery
  - this is a minimal backend retry guardrail increment for existing source families only: no new source family, no connector architecture changes, no ingestion state/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - 实测结果：focused retry tests passed；当上游首次返回 `408 Request Timeout` 时，当前 source fetch helper 会按配置尝试一次重试并在第二次成功时继续返回成功响应

- ✅ opencode loop `pick` log now exposes remaining queue work at selection time
  - `scripts/opencode-loop/runtime.mjs` now adds a narrow `buildQueueWorkVisibility()` helper and includes `remainingAfterPick` / `queuePending` / `queueInProgress` / `queueTotal` in `logStatus("pick", ...)`
  - this is an observability-only increment for queue runtime logs: no queue schema changes, no pick/complete semantics changes, no dashboard/UI expansion
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test 通过；每次 `pick` 状态日志现在可直接看到“当前取走此任务后剩余多少待处理工作”

- ✅ feed all-invalid failure diagnostics now include a concrete failed entry anchor
  - `apps/api/src/infra/feed-source/feed-source.service.ts` now appends `First failed entry ref: <ref>.` when feed extraction fails because all selected entries are invalid
  - this is a minimal backend diagnostics clarity increment for existing `feed` flow only: no source-family expansion, no retry policy rewrite, no ingestion state/persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests 18/18 通过；当 feed 因全部 entry 无效而失败时，错误信息现在可直接定位首个失败 entry（例如 `Broken Entry`），减少排查时的上下文丢失

- ✅ final answer attribution readability now also exposes additive `readabilityResolvedLabel` for always-readable fallback wording across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` extends `TraceAnswerAttributionSummary` with `readabilityResolvedLabel: string` (always present, with unknown fallback wording)
  - `apps/api/src/modules/traces/traces.service.ts` now emits `answerAttributionSummary.readabilityResolvedLabel` as a stable resolved label (`<attribution label or unknown attribution> via <source label or unknown source>`) while preserving existing readability/readabilityHint/readabilitySentence semantics
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now emits the same `answerAttributionSummary.readabilityResolvedLabel` in one-shot and stream final payloads with aligned mapping
  - `apps/api/test/traces.service.test.js` and `apps/api/test/ask-success.test.js` now assert the new additive resolved-label field
  - compatibility preserved: additive read-model/metadata readability only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 45/45 通过；ask final payload 与 trace summary 现在都可直接读取 `answerAttributionSummary.readabilityResolvedLabel`（例如 `explicit attribution via structured source`、`unknown attribution via unknown source`），并继续兼容现有 attribution readability 字段

- ✅ final answer attribution readability now also exposes additive `readabilitySentence` for clearer human-readable wording across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` extends `TraceAnswerAttributionSummary` with `readabilitySentence: string | null`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `answerAttributionSummary.readabilitySentence` as a stable sentence (`Answer attribution is <value>; source evidence is <value>.`) derived from resolved attribution/source metadata (with `unknown` fallback)
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now emits the same `answerAttributionSummary.readabilitySentence` in one-shot and stream final payloads with aligned mapping
  - `apps/api/test/traces.service.test.js` and `apps/api/test/ask-success.test.js` now assert the new additive sentence field; `apps/web/test/trace-summary-contract.test.js` now also guards the shared contract field
  - compatibility preserved: additive read-model/metadata readability only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 45/45 通过；ask final payload 与 trace summary 现在都可直接读取 `answerAttributionSummary.readabilitySentence`（例如 `Answer attribution is explicit; source evidence is structured.`），并继续兼容现有 attribution readability 字段

- ✅ final answer attribution readability now also exposes additive `readabilityHint` for partial-metadata clarity across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` extends `TraceAnswerAttributionSummary` with `readabilityHint: string | null`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `answerAttributionSummary.readabilityHint` as a readable fallback hint when attribution/source metadata is partially missing (e.g. `explicit attribution via unknown source`), while preserving existing `readabilityLabel` semantics
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now emits the same `answerAttributionSummary.readabilityHint` in one-shot and stream final payloads with aligned mapping
  - `apps/api/test/traces.service.test.js`, `apps/api/test/ask-success.test.js`, and `apps/web/test/trace-summary-contract.test.js` now assert the new additive hint field
  - compatibility preserved: additive read-model/metadata readability only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 45/45 通过；ask final payload 与 trace summary 在 attribution/source 元数据不完整时现在可直接读取可读 fallback hint，同时保持现有 `readability` / `readabilityLabel` 兼容

- ✅ final answer attribution readability now also exposes additive split labels (`attributionLabel` / `sourceLabel`) across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` extends `TraceAnswerAttributionSummary` with:
    - `attributionLabel: string | null`
    - `sourceLabel: string | null`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerAttributionSummary.attributionLabel` and `sourceLabel` from resolved attribution/source, while keeping existing `readability` + `readabilityLabel`
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now emits top-level `answerAttributionSummary.attributionLabel` and `sourceLabel` in one-shot and stream final payloads with the same mapping
  - `apps/api/test/traces.service.test.js` and `apps/api/test/ask-success.test.js` now assert the new additive split-label fields
  - compatibility preserved: additive read-model/metadata clarity only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 44/44 通过；ask final payload 与 trace summary 现在都可直接读取 `answerAttributionSummary.attributionLabel` / `sourceLabel`（例如 `explicit attribution` + `structured source`），并继续兼容现有 `attribution` / `source` / `readability` / `readabilityLabel`

- ✅ final answer attribution readability now also exposes additive human-readable `readabilityLabel` across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` extends `TraceAnswerAttributionSummary` with `readabilityLabel: string | null`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerAttributionSummary.readabilityLabel` from resolved attribution + source
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now emits `answerAttributionSummary.readabilityLabel` in one-shot and stream final payloads
  - `apps/api/test/traces.service.test.js` and `apps/api/test/ask-success.test.js` now assert the new additive label field
  - compatibility preserved: additive read-model/metadata clarity only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 44/44 通过；ask final payload 与 trace summary 现在都可直接读取 `answerAttributionSummary.readabilityLabel`（例如 `explicit attribution via structured source`），同时保持现有 attribution/source/readability 字段兼容

- ✅ final answer attribution readability now also exposes additive combined `readability` key in grouped summary (`<attribution>:<source>`) across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` adds `TraceAnswerAttributionReadability` and extends `TraceAnswerAttributionSummary` with `readability: TraceAnswerAttributionReadability | null`
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerAttributionSummary.readability` from resolved attribution + source
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now emits `answerAttributionSummary.readability` in one-shot and stream final payloads
  - `apps/api/test/traces.service.test.js` and `apps/api/test/ask-success.test.js` now assert the new combined readability field
  - compatibility preserved: additive read-model/metadata clarity only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 44/44 通过；ask final payload 与 trace summary 现在都可直接读取 `answerAttributionSummary.readability`（例如 `explicit:structured`），同时保持现有 attribution/source 字段兼容

- ✅ final answer attribution readability now also exposes additive grouped `answerAttributionSummary` across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` adds `TraceAnswerAttributionSummary` and `TraceSummary.answerAttributionSummary` (`{ attribution, source }`) as a compact readability view while preserving existing flat fields (`answerAttribution` / `answerAttributionSource` and legacy `citation*` compatibility aliases)
  - `apps/api/src/modules/traces/traces.service.ts` now emits `traceSummary.answerAttributionSummary` from resolved attribution + source
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now includes top-level `answerAttributionSummary` in both one-shot and stream final payloads
  - `apps/web/src/types/api.ts` and web contract guards now include additive ask response field `answerAttributionSummary?: TraceAnswerAttributionSummary`
  - compatibility preserved: additive read-model/metadata clarity only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 44/44 通过；ask final payload 与 trace summary 现在都可直接读取 grouped `answerAttributionSummary`，同时保持现有 attribution/source 字段兼容

- ✅ final answer attribution readability now also exposes additive `answerAttributionSource` alias across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` adds `TraceSummary.answerAttributionSource: TraceCitationSelectionSource | null` as a readability alias while preserving existing `citationSelectionSource`
  - `apps/api/src/modules/traces/traces.service.ts` now resolves citation selection source once and emits both `answerAttributionSource` and `citationSelectionSource` in `buildTraceSummary()`
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now includes top-level `answerAttributionSource` in both one-shot and stream final payloads, derived from `answeringMetadata.citationSelectionSource` via a narrow normalization helper
  - `apps/web/src/types/api.ts` and web contract guards now include additive ask response field `answerAttributionSource?: TraceCitationSelectionSource | null`
  - compatibility preserved: additive read-model/metadata clarity only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js`
  - 实测结果：focused API tests 44/44 通过；ask final payload 与 trace summary 现在都可直接读取 `answerAttributionSource`，同时保持原有 `citationSelectionSource` 兼容

- ✅ answer attribution readability now has an additive top-level alias aligned across ask response / trace summary / shared contracts
  - `packages/shared/src/trace-contracts.ts` adds `TraceSummary.answerAttribution: TraceCitationAttribution | null` as a readability alias while preserving existing `citationAttribution`
  - `apps/api/src/modules/traces/traces.service.ts` now resolves citation attribution once and emits both `answerAttribution` and `citationAttribution` in `buildTraceSummary()`
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now includes top-level `answerAttribution` in both one-shot and stream final payloads, derived from `answeringMetadata.citationAttribution` via a narrow normalization helper
  - `apps/web/src/types/api.ts` and web contract guards now include the additive ask response field `answerAttribution?: TraceCitationAttribution | null`
  - compatibility preserved: additive read-model/metadata clarity only; no retrieval behavior/source scope/schema-persistence semantics changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 19/19 通过；trace summary 与 ask final payload 现在都可直接读取 `answerAttribution`，同时保持原有 `citationAttribution` 兼容

- ✅ ask/trace shared contract guard now also locks `strategySummary.rewriteApplied` alignment
  - `apps/web/test/ask-retrieval-metadata-contract.test.js` now also asserts shared `RetrievalStrategySummary.rewriteApplied: boolean`
  - `apps/web/test/trace-summary-contract.test.js` now also asserts shared `RetrievalStrategySummary.rewriteApplied: boolean`
  - this keeps ask response retrieval metadata usage and trace summary strategy-summary usage aligned with shared rewrite-applied provenance semantics while staying additive and behavior-preserving
  - 新增 / 更新验证：
    - `node --test apps/web/test/ask-retrieval-metadata-contract.test.js apps/web/test/trace-summary-contract.test.js`
  - 实测结果：focused web contract tests 2/2 通过；ask response、trace summary 与 shared strategy summary 的 `rewriteApplied` 合约 guard 对齐已补齐

- ✅ ask-side strategy summary contract guard now also locks shared `rewritePromptId` / `rewriteUsedFallback` alignment
  - `apps/web/test/ask-retrieval-metadata-contract.test.js` now also asserts shared `RetrievalStrategySummary` includes:
    - `rewritePromptId: string | null`
    - `rewriteUsedFallback: boolean | null`
  - this keeps ask response retrieval metadata strategy-summary usage aligned with trace summary / shared contract rewrite provenance fields while staying additive and behavior-preserving
  - 新增 / 更新验证：
    - `node --test apps/web/test/ask-retrieval-metadata-contract.test.js`
  - 实测结果：focused web contract test 1/1 通过；ask response、trace summary 与 shared strategy summary 的 rewrite prompt/fallback provenance guard 对齐已补齐

- ✅ trace read-model now backfills `rewriteApplied` from `queryRewrite.finalQuerySource="rewritten"` when `applied` is missing
  - `TracesService.buildTraceSummary()` now resolves `rewriteApplied` in this order: `trace.rewrittenQuery` -> `retrievalMetadata.queryRewrite.applied` -> persisted `strategySummary.rewriteApplied` -> `retrievalMetadata.queryRewrite.finalQuerySource="rewritten"` -> persisted `strategySummary.retrievalQuerySource="rewritten"` -> legacy top-level `retrievalMetadata.retrievalQuerySource="rewritten"`
  - this closes a minimal readability gap where older traces could carry `queryRewrite.finalQuerySource="rewritten"` without `queryRewrite.applied`, causing `traceSummary.rewriteApplied` / `strategySummary.rewriteApplied` to under-report effective rewrite application
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 19/19 通过；legacy `queryRewrite.finalQuerySource="rewritten"` metadata 下 `traceSummary.rewriteApplied` 现在可直接读出 `true`

- ✅ trace read-model now backfills `rewriteApplied` from persisted `strategySummary.retrievalQuerySource="rewritten"`
  - `TracesService.buildTraceSummary()` now resolves `rewriteApplied` in this order: `trace.rewrittenQuery` -> `retrievalMetadata.queryRewrite.applied` -> persisted `strategySummary.rewriteApplied` -> persisted `strategySummary.retrievalQuerySource="rewritten"` -> legacy top-level `retrievalMetadata.retrievalQuerySource="rewritten"`
  - this closes a minimal trace readability gap where older traces could persist `strategySummary.retrievalQuerySource="rewritten"` without `rewriteApplied`, causing `traceSummary.rewriteApplied` / `strategySummary.rewriteApplied` to under-report effective rewrite application
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 18/18 通过；legacy strategy-summary-only rewrite query-source metadata 下 `traceSummary.rewriteApplied` 现在可直接读出 `true`

- ✅ trace read-model now backfills `retrievalQuerySource` from resolved rewrite-enabled state when legacy final query source is missing
  - `TracesService.buildTraceSummary()` still resolves `retrievalQuerySource` from `queryRewrite.finalQuerySource` / persisted `strategySummary.retrievalQuerySource` / legacy top-level source first; when all are missing, it now additionally derives `original_disabled` or `original_unchanged` from the resolved `rewriteEnabled` signal
  - this closes a minimal readability gap where older traces could persist `queryRewrite.enabled` without `finalQuerySource`, causing `traceSummary.retrievalQuerySource` and `strategySummary.retrievalQuerySource` to under-report the effective final query source
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 17/17 通过；legacy rewrite-enabled metadata 缺失 `finalQuerySource` 时，trace summary 现在可直接读出 `original_unchanged` / `original_disabled` 语义

- ✅ trace read-model now backfills `strategySummary.rewriteEnabled` from legacy top-level `retrievalMetadata.rewriteEnabled`
  - `TracesService.buildTraceSummary()` now resolves `rewriteEnabled` in this order: `retrievalMetadata.queryRewrite.enabled` -> persisted `strategySummary.rewriteEnabled` -> legacy `retrievalMetadata.rewriteEnabled` -> derived from resolved rewrite/query-source signals
  - this closes a minimal readability gap where older traces could persist top-level rewrite enablement without `queryRewrite` / `strategySummary`, causing `traceSummary.strategySummary.rewriteEnabled` to under-report effective rewrite enablement provenance
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 16/16 通过；legacy top-level rewrite enablement metadata 下 `traceSummary.strategySummary.rewriteEnabled` 现在可直接对齐

- ✅ trace read-model now backfills rewrite prompt/model provenance from legacy top-level retrieval metadata
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.rewritePromptId` in this order: `retrievalMetadata.queryRewrite.promptId` -> persisted `strategySummary.rewritePromptId` -> legacy `retrievalMetadata.rewritePromptId`
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.rewriteModelName` in this order: `retrievalMetadata.queryRewrite.modelName` -> persisted `strategySummary.rewriteModelName` -> legacy `retrievalMetadata.rewriteModelName`
  - this closes a minimal resolved-strategy provenance readability gap where older traces could persist rewrite prompt/model at top level without `queryRewrite` / `strategySummary`, causing strategy summary provenance to under-report effective rewrite metadata
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 15/15 通过；legacy top-level rewrite provenance metadata 下 `traceSummary.strategySummary.rewritePromptId` 与 `rewriteModelName` 现在可直接对齐

- ✅ trace read-model now backfills `strategySummary.rewriteUsedFallback` from legacy top-level `retrievalMetadata.rewriteUsedFallback`
  - `TracesService.buildTraceSummary()` now resolves `rewriteUsedFallback` in this order: `retrievalMetadata.queryRewrite.usedFallback` -> persisted `strategySummary.rewriteUsedFallback` -> legacy `retrievalMetadata.rewriteUsedFallback`
  - this closes a minimal provenance-readability gap where older traces persisted rewrite fallback usage at top level without `queryRewrite`/`strategySummary`, causing `traceSummary.strategySummary.rewriteUsedFallback` to under-report effective rewrite fallback
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 14/14 通过；legacy top-level rewrite fallback metadata 下 `traceSummary.strategySummary.rewriteUsedFallback` 读取现在可直接对齐

- ✅ trace read-model now backfills `strategySummary.retrievalQuerySource` from legacy top-level `retrievalMetadata.retrievalQuerySource`
  - `TracesService.buildTraceSummary()` now resolves `retrievalQuerySource` in this order: `retrievalMetadata.queryRewrite.finalQuerySource` -> persisted `strategySummary.retrievalQuerySource` -> legacy `retrievalMetadata.retrievalQuerySource` -> derived from `rewriteApplied`
  - for older traces that only persisted top-level `retrievalQuerySource="rewritten"`, `rewriteApplied` now also backfills from that same legacy value, so strategy summary readability stays internally aligned
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 13/13 通过；legacy top-level retrieval metadata 下 `traceSummary.retrievalQuerySource` 与 `strategySummary.retrievalQuerySource`/`rewriteApplied` 读取现在可直接对齐

- ✅ trace read-model now backfills `strategySummary.retrievalMode` from legacy top-level `retrievalMetadata.retrievalMode`
  - `TracesService.buildTraceSummary()` now resolves `retrievalMode` in this order: `retrievalMetadata.execution.actualMode` -> persisted `strategySummary.retrievalMode` -> legacy `retrievalMetadata.retrievalMode`
  - this closes a minimal resolved-strategy readability gap where older traces persisted top-level `retrievalMode` without `execution`/`strategySummary`, causing `traceSummary.strategySummary.retrievalMode` to under-report effective retrieval mode provenance
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 11/11 通过；legacy top-level retrieval metadata 下 `traceSummary.retrievalMode` 与 `strategySummary.retrievalMode`/`strategySummary.strategyMode` 读取现在可直接对齐

- ✅ trace read-model now backfills `strategySummary.fallbackReason` from legacy top-level `retrievalMetadata.fallbackReason`
  - `TracesService.buildTraceSummary()` now resolves `fallbackReason` in this order: `retrievalMetadata.execution.fallbackReason` -> persisted `strategySummary.fallbackReason` -> legacy `retrievalMetadata.fallbackReason`
  - this closes a minimal readability gap where older traces could persist fallback provenance without `execution`/`strategySummary`, causing `traceSummary.strategySummary.fallbackReason` to under-report effective fallback cause
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 10/10 通过；legacy fallback metadata 下 `traceSummary.fallbackReason` 与 `strategySummary.usedFallback` 读取现在可直接对齐

- ✅ trace read-model now backfills `strategySummary.usedFallback` from legacy `fallbackReason`
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.usedFallback` in this order: `retrievalMetadata.execution.usedFallback` -> persisted `strategySummary.usedFallback` -> derived from resolved `fallbackReason`
  - this closes a minimal readability gap where legacy traces could persist `fallbackReason` but miss `usedFallback`, causing strategy summary fallback provenance to under-report effective fallback resolution
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 9/9 通过；legacy strategy summary 下 `fallbackReason` 与 `usedFallback` 读取现在可直接对齐

- ✅ trace read-model now backfills `strategySummary.rewriteEnabled` from legacy `queryRewrite.applied`
  - `TracesService.buildTraceSummary()` now resolves `rewriteEnabled` in this order: `retrievalMetadata.queryRewrite.enabled` -> persisted `strategySummary.rewriteEnabled` -> derived from resolved `rewriteApplied` -> derived from `retrievalQuerySource`
  - this closes a minimal readability gap where legacy traces could persist `queryRewrite.applied=true` without `enabled` / `finalQuerySource`, causing `traceSummary.strategySummary.rewriteEnabled` to under-report rewrite enablement while `rewriteApplied` was already true
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family/schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 8/8 通过；legacy rewrite metadata 下 `strategySummary.rewriteEnabled` 与 `rewriteApplied` 读取一致，ask response / trace summary / shared contract 的策略摘要语义保持对齐

- ✅ trace read-model now backfills `strategySummary.strategyMode` from legacy `retrievalMode`
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.strategyMode` in this order: `retrievalMetadata.strategy.candidateSelection.mode` -> persisted `strategySummary.strategyMode` -> persisted `strategySummary.retrievalMode` -> resolved `retrievalMode`
  - this closes a minimal contract-alignment gap where older traces persisted `retrievalMode` but no `strategyMode`, causing `traceSummary.strategySummary.strategyMode` to under-report the effective mode versus ask-side strategy summary readability
  - compatibility preserved: additive trace read-model fallback only; no retrieval execution semantics/ranking/default/source-family scope changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 7/7 通过；ask response、trace summary 与 shared strategy summary 的 `strategyMode` 读取对齐覆盖已补齐 legacy retrievalMode 回填路径

- ✅ trace read-model now backfills `strategySummary.rewriteApplied` from persisted `queryRewrite.applied`
  - `TracesService.buildTraceSummary()` now resolves `rewriteApplied` in this order: `trace.rewrittenQuery` -> `retrievalMetadata.queryRewrite.applied` -> persisted `strategySummary.rewriteApplied` -> `false`
  - this closes a minimal contract-alignment gap where legacy traces could carry `queryRewrite.applied=true` without `rewrittenQuery`/`strategySummary`, causing trace summary to under-report rewrite application
  - compatibility preserved: additive read-model fallback only; no retrieval execution semantics/ranking/default/source-family scope changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 6/6 通过；ask metadata 的 query-rewrite applied provenance 与 trace summary/shared strategy summary 的 `rewriteApplied` 读取保持一致

- ✅ `strategySummary` now carries additive `rewriteEnabled` for ask/trace/shared contract alignment
  - `packages/shared/src/trace-contracts.ts` updates `RetrievalStrategySummary` with `rewriteEnabled: boolean`
  - `AskAssistantService` now persists `strategySummary.rewriteEnabled` from resolved retrieval strategy on both success and retrieval-failure metadata paths
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.rewriteEnabled` from `queryRewrite.enabled` first, then falls back to persisted `strategySummary.rewriteEnabled`, and finally derives from `retrievalQuerySource` for legacy traces
  - compatibility preserved: additive read-model/metadata alignment only; no retrieval execution semantics/ranking/default/source-family changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/ask-success.test.js test/traces.service.test.js`
  - 实测结果：focused API tests 30/30 通过；ask response、trace summary 与 shared contract 现在可一致表达 query rewrite 是否启用

- ✅ ask-side strategy summary contract guard now explicitly locks shared `rewriteModelName` alignment
  - `apps/web/test/ask-retrieval-metadata-contract.test.js` now also asserts:
    - `AskRetrievalMetadata.strategySummary?: RetrievalStrategySummary`
    - shared `RetrievalStrategySummary.rewriteModelName: string | null`
  - this keeps ask response / retrieval metadata strategy summary usage aligned with the shared contract while staying additive and behavior-preserving
  - 新增 / 更新验证：
    - `node --test apps/web/test/ask-retrieval-metadata-contract.test.js`
  - 实测结果：focused web contract test 1/1 通过；ask response、trace summary 与 shared strategy summary 的 rewrite model provenance guard 继续对齐

- ✅ ask read-model contract guard now also locks `queryRewrite.modelName` alignment
  - `apps/web/test/ask-retrieval-metadata-contract.test.js` now asserts `AskRetrievalMetadata.queryRewrite.modelName: string | null`
  - this keeps ask response retrieval metadata and shared `strategySummary.rewriteModelName` provenance alignment guarded from future type drift
  - compatibility preserved: additive contract-guard only, no retrieval execution/ranking/default/source-scope changes
  - 新增 / 更新验证：
    - `node --test apps/web/test/ask-retrieval-metadata-contract.test.js`
  - 实测结果：focused web contract test 1/1 通过；ask response 的 query rewrite model provenance 字段现在有显式 guard

- ✅ `strategySummary` now carries additive `rewriteModelName` for ask/trace/shared contract convergence
  - `packages/shared/src/trace-contracts.ts` updates `RetrievalStrategySummary` with `rewriteModelName: string | null`
  - `AskAssistantService` now writes query-rewrite model provenance into both `retrievalMetadata.queryRewrite.modelName` and `strategySummary.rewriteModelName` on success and retrieval-failure metadata paths
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.rewriteModelName` from `queryRewrite.modelName` first, then falls back to persisted `strategySummary.rewriteModelName`
  - web API type alignment: `apps/web/src/types/api.ts` now includes `AskRetrievalMetadata.queryRewrite.modelName`
  - compatibility preserved: no retrieval execution semantics/ranking/default changes, no source-family scope changes, additive metadata/read-model contract alignment only
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/ask-success.test.js test/traces.service.test.js`
  - 实测结果：focused API tests 30/30 通过；ask response、trace summary、shared contract 现在可一致携带 query rewrite model 归因字段

- ✅ `strategySummary` now carries additive `rewritePromptId` for ask/trace/shared contract alignment
  - `packages/shared/src/trace-contracts.ts` updates `RetrievalStrategySummary` with `rewritePromptId: string | null`
  - `AskAssistantService` now writes `strategySummary.rewritePromptId` from query-rewrite prompt metadata on both success and retrieval-failure metadata paths
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.rewritePromptId` from `queryRewrite.promptId` first, then falls back to persisted `strategySummary.rewritePromptId`
  - compatibility preserved: no retrieval execution semantics/ranking/default changes, no source-family scope changes, additive metadata/read-model contract convergence only
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 5/5 通过；ask response、trace summary、shared contract 的 strategy summary 现在可一致携带 rewrite prompt 归因字段
- ✅ 继续压缩 web 首屏负担，去掉了不必要的外链字体和首屏通知层
  - `apps/web/src/styles/global.css` now uses a local/system font stack only, so the app no longer depends on Google Fonts at runtime
  - `apps/web/index.html` no longer preconnects to Google Fonts origins
  - `apps/web/src/app/App.tsx` removed the always-mounted Mantine notifications layer and its stylesheet import
  - `apps/web/src/styles/theme.ts` now uses the same system font stack for Mantine theme text and headings
  - `apps/web/src/app/AppShell.tsx` no longer hard-codes a missing display font family for the shell brand mark and title
  - `apps/web/src/features/api/hooks.ts` now allows shell-level queries to be deferred until hydration, so the workspace badges do not compete with the first paint
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/web build`
  - 实测结果：web build passed again, with the main initial JS chunk dropping from roughly 442.73 kB to 396.95 kB and HTML shrinking slightly as well

- ✅ 5174 Lighthouse static test setup now avoids cross-origin API calls
  - `apps/web/src/lib/api.ts` now uses a same-origin `/api` base when the app is served from port 5174
  - `apps/web/serve-dist.mjs` now reverse-proxies `/api/*` to the local API server on `localhost:3000`
  - this removes the browser-side CORS dependency for local Lighthouse testing while preserving the static dist serving path, brotli compression, and cache headers
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/web build`
    - `node --check apps/web/serve-dist.mjs`
    - `curl http://127.0.0.1:5174/api/health`
  - 实测结果：`/api/health` now returns the proxied API response from 3000 through 5174 without cross-origin fetches

- ✅ web entry now has better SEO and lower initial route weight
  - `apps/web/src/app/router.tsx` now lazy-loads route pages instead of statically importing every page component up front, which should reduce initial JS pressure and unused bundle weight
  - `apps/web/index.html` now includes a meta description plus font preconnect hints
  - `apps/web/public/robots.txt` now exists with valid allow-all syntax so the app has a real robots file for crawler audits
  - this is a frontend performance/SEO hardening increment only: no backend contract changes and no visual redesign
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/web build`
  - 实测结果：web build passed after the route-splitting and SEO header update

- ✅ OpenCode loop night-run wrapper now prefers corepack for pnpm resolution
  - `scripts/opencode-loop/night-run.sh` now launches `pnpm` through `corepack` first, with Volta/local shim fallbacks if needed
  - this fixes the systemd startup failure caused by the user service lacking the interactive shell PATH; queue semantics and execution flow stay unchanged

- ✅ OpenCode loop start helper now auto-links systemd user units
  - `pnpm loop:start|stop|status` now link the service/timer from `scripts/opencode-loop/systemd/` before managing them, so there is no separate manual copy step
  - this removes the unit-install error seen when the timer was not yet present in the user systemd search path; queue semantics and execution flow stay unchanged

- ✅ OpenCode loop now has pnpm aliases for control commands
  - `pnpm loop:start|status|stop` now wrap `scripts/opencode-loop/control.sh`
  - `README.md` now shows the short pnpm commands for day-to-day unattended loop management
  - this is an operations-only convenience increment; queue semantics and execution flow stay unchanged

- ✅ OpenCode loop now has a one-command start/stop/status helper for the systemd setup
  - added `scripts/opencode-loop/control.sh` so the loop can be started, stopped, or inspected without remembering separate `systemctl` invocations
  - this wraps the existing `systemd --user` setup and keeps the same crash-only restart behavior; it does not change queue semantics or execution flow
  - 新增 / 更新验证：
    - `bash -n scripts/opencode-loop/control.sh`
  - 实测结果：helper syntax is valid and the commands map cleanly to the expected user-unit operations

- ✅ OpenCode loop unattended startup now triggers immediately instead of waiting for a fixed clock time
  - `scripts/opencode-loop/systemd/opencode-loop.timer` now starts the service right after activation rather than only at 23:00
  - this keeps the crash-restart behavior from `systemd --user` while removing the time gate, so the loop will run whenever you start the user unit
  - this is an operations-only increment: no queue semantics change, no prompt change, no execution-flow change
  - 新增 / 更新验证：
    - `bash -n scripts/opencode-loop/night-run.sh`
    - `systemd-analyze verify scripts/opencode-loop/systemd/opencode-loop.service scripts/opencode-loop/systemd/opencode-loop.timer`
  - 实测结果：the unit templates still verify cleanly after removing the 23:00 restriction

- ✅ OpenCode loop now has a systemd --user night-run option with crash-only restarts
  - added `scripts/opencode-loop/night-run.sh` plus `scripts/opencode-loop/systemd/opencode-loop.service` and `scripts/opencode-loop/systemd/opencode-loop.timer`
  - the recommended unattended setup is now `systemd --user` rather than `pm2`, so the loop can restart on failure without turning a normal empty-queue exit into noise
  - this is an operations-only increment: no queue semantics change, no prompt change, no execution-flow change
  - 新增 / 更新验证：
    - `bash -n scripts/opencode-loop/night-run.sh`
    - `systemd-analyze verify scripts/opencode-loop/systemd/opencode-loop.service scripts/opencode-loop/systemd/opencode-loop.timer`
  - 实测结果：service/timer templates are ready for user installation; crash-restart behavior is expressed in the unit file instead of the loop core

- ✅ OpenCode loop handoff and terminal logs are now more scan-friendly
  - handoff markdown now puts the shortest key metadata first and uses concise Chinese section labels so status, session, and timing are easier to spot quickly
  - terminal status lines now keep a fixed short shape with concise Chinese labels and the most important fields front-loaded
  - this is a readability/operations increment only: no queue semantics change, no resume behavior change, no execution flow change
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test passed after the handoff/log simplification update

- ✅ OpenCode loop session titles are now easier to map to queue items
  - new OpenCode sessions now use a readable title shape like `loop #<queue-index> <item-id> YYYY-MM-DD HH:MM:SS`, so it is easier to tell which queue item a session belongs to
  - this is a UX/readability increment only: no queue semantics change, no resume behavior change, no execution flow change
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test still passed after the session title formatting change

- ✅ OpenCode loop queue helpers are now centralized in a dedicated module
  - queue schema/read/write/pick/complete logic now lives in `scripts/opencode-loop/queue.mjs` instead of being spread across `runtime.mjs` and the self-test harness
  - `scripts/opencode-loop/runtime.mjs` now focuses on orchestration, lock handling, prompt composition, and API interaction
  - this is a structure/maintainability increment only: queue semantics, resume behavior, and unattended execution flow stay the same
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test still passed after the queue-module extraction; queue draining and resume recovery remain intact

- ✅ OpenCode loop queue writes now use atomic temp-file replacement
  - `scripts/opencode-loop/runtime.mjs` now writes queue state through a same-directory temp file plus rename, so a crash or interruption is much less likely to leave `.opencode/loop/queue.json` truncated
  - this is a safety hardening increment for unattended night execution only: no queue semantics change, no task-order change, no retrieval / answer behavior change
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test still passed after the queue-write hardening; resume recovery and completion flow remain intact

- ✅ Ollama embedding runtime now enforces an optional expected-dimension guardrail
  - `apps/api/src/infra/embedding/embedding-runtime-config.ts` now reads `OLLAMA_EMBEDDING_DIMENSIONS` as a positive integer when configured
  - `EmbeddingService` now rejects Ollama responses whose vector length does not match the configured dimension, so local embedding config drift fails fast instead of silently propagating
  - this remains a minimal backend config/correctness increment: no provider ranking changes, no retrieval behavior changes, no schema migration
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:fast:llm`
  - 实测结果：focused embedding runtime tests passed; configured Ollama vector dimensions now act as a strict runtime guardrail

- ✅ OpenCode loop harness now provides a narrow queue-driven local execution entrypoint
  - `pnpm opencode:loop` now launches `scripts/opencode-loop.mjs`
  - the harness drains `.opencode/loop/queue.json` one item at a time, manages resume/recovery, writes handoff markdown, and keeps a lock to avoid concurrent consumption
  - `node scripts/opencode-loop.mjs --self-test` now covers fresh queue draining plus interrupted-session resume recovery against a local mock server
  - this is a workflow/supporting-tooling increment only: no core API/retrieval behavior changes
  - 新增 / 更新验证：
    - `node scripts/opencode-loop.mjs --self-test`
  - 实测结果：self-test passed; queue processing, handoff generation, and resume recovery all behave as expected

- ✅ sitemap all-failure diagnostics now include a concrete failed URL anchor
  - `SitemapSourceService` now appends the first failed URL when throwing terminal aggregate failures:
    - all sitemap pages failed: message now includes `First failed page URL`
    - all child sitemap fetches failed: message now includes `First failed child sitemap URL`
  - this is a minimal backend diagnostics clarity increment for existing `sitemap` / `sitemap index` flows only: no source-family expansion, no retry policy rewrite, no state-machine/schema changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
  - 实测结果：focused parsing tests 18/18 通过；当 sitemap 或 sitemap-index 进入全量失败时，错误信息现在直接带出可定位的首个失败 URL，减少排查时的上下文丢失

- ✅ `strategySummary` now carries additive `rewriteUsedFallback` for query-rewrite provenance readability
  - `packages/shared/src/trace-contracts.ts` updates `RetrievalStrategySummary` with `rewriteUsedFallback: boolean | null`
  - `AskAssistantService` now writes `strategySummary.rewriteUsedFallback` from `queryRewrite.usedFallback` on success/failure metadata paths
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.rewriteUsedFallback` from `queryRewrite.usedFallback` first, then falls back to persisted `strategySummary.rewriteUsedFallback`
  - compatibility preserved: no retrieval behavior/default/ranking changes, no persistence/schema migration changes, additive read-model/contract clarity only
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests passed; trace summary 的策略摘要现在可直接读出 query rewrite 是否走了 fallback

- ✅ `strategySummary` now carries additive `usedFallback` for ask/trace/shared convergence
  - `packages/shared/src/trace-contracts.ts` updates `RetrievalStrategySummary` with `usedFallback: boolean | null`
  - `AskAssistantService` now writes `strategySummary.usedFallback` on both success (`execution.usedFallback`) and retrieval-failure (`null`) paths
  - `TracesService.buildTraceSummary()` now resolves `strategySummary.usedFallback` from execution metadata first, then falls back to persisted `strategySummary.usedFallback`
  - `AskResponse` now also exposes a top-level additive `strategySummary` so the ask response, trace summary, and shared contract stay aligned on resolved retrieval provenance
  - compatibility preserved: no retrieval behavior/default/ranking changes, no persistence/schema migration changes, additive read-model/contract clarity only
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/ask-success.test.js`
    - `node --test apps/web/test/trace-summary-contract.test.js apps/web/test/ask-retrieval-metadata-contract.test.js`
  - 实测结果：all focused API/Web contract tests passed; `ask response`、`trace summary` 与 shared contract 的 fallback 使用标记已完成 additive 对齐

- ✅ traceSummary strategy readability now falls back to persisted `retrievalMetadata.strategySummary`
  - `TracesService.buildTraceSummary()` now reads `retrievalMetadata.strategySummary` as a fallback source for additive strategy fields when detailed execution/query-rewrite subfields are missing:
    - `retrievalMode`
    - `retrievalQuerySource`
    - `rewriteApplied`
    - `fallbackReason`
  - this is a minimal backend read-model clarity increment: no retrieval execution changes, no ask-path orchestration changes, no schema/persistence changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 5/5 通过；当 trace 仅保留 `strategySummary` 而缺失 execution/query-rewrite 细节时，`traceSummary` 仍可输出可读的最终策略摘要

- ✅ ask response / trace summary / shared contract now share additive `strategySummary` metadata
  - `packages/shared/src/trace-contracts.ts` adds `RetrievalStrategySummary` and includes `traceSummary.strategySummary`
  - `AskAssistantService` now writes `retrievalMetadata.strategySummary` for both success and retrieval-failure trace metadata paths
  - `TracesService.buildTraceSummary()` now exposes additive `traceSummary.strategySummary` while preserving existing flattened strategy fields (`retrievalMode` / `retrievalQuerySource` / `rewriteApplied` / `fallbackReason`) for compatibility
  - `apps/web/src/types/api.ts` now references shared strategy enums and includes optional `AskRetrievalMetadata.strategySummary`
  - this increment is metadata/read-model convergence only: no retrieval execution behavior changes, no strategy default rewrites, no schema changes
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/traces.service.test.js`
    - `node --test apps/web/test/trace-summary-contract.test.js apps/web/test/ask-retrieval-metadata-contract.test.js`
  - 实测结果：focused traces service tests 和 web contract tests 通过；ask retrieval metadata、trace summary、shared contract 的策略摘要表达已完成 additive 对齐

- ✅ trace strategy summary now carries explicit requested strategy mode provenance
  - `RetrievalStrategySummary.strategyMode` now records the resolved config mode from `retrievalMetadata.strategy.candidateSelection.mode`
  - `AskAssistantService` persists the field in both success and failed retrieval metadata, and `TracesService.buildTraceSummary()` reads it back for trace detail/list views
  - current trace summary can now distinguish the resolved strategy config mode from the runtime `retrievalMode` that actually executed
  - this is still additive read-model / metadata clarity only: no retrieval behavior changes, no schema migration

- ✅ traceSummary failed-stage output now rejects invalid retrieval failure stage values
  - `TracesService.buildTraceSummary()` no longer forwards arbitrary `retrievalMetadataJson.failure.stage` strings into `traceSummary.failedStage`
  - current output only keeps the shared-contract enum values (`retrieval` / `answering`); invalid or legacy stage strings now safely fall back to `null`
  - this is a minimal backend trace read-model correctness increment: no trace persistence write-path changes, no retrieval/answering behavior changes
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/traces.service.test.js`
  - 实测结果：focused traces service tests 4/4 通过；当 `failure.stage` 为非法字符串（例如 `source_fetch`）时，trace detail/list 的 `traceSummary.failedStage` 都会回落为 `null`

- ✅ CI validate now generates Prisma client before API build/typecheck
  - 根因是仓库此前只提供了 `apps/api` 的手动脚本 `prisma:generate`，但 CI `validate` 流程没有显式执行它
  - `apps/api/package.json` 的 `build` 现已改为先执行 `pnpm run prisma:generate` 再 `nest build`
  - `.github/workflows/ci.yml` 现已在 `pnpm install --frozen-lockfile` 后显式执行：
    - `pnpm --filter @rag-system/api prisma:generate`
  - 这样可避免 CI 因隐式 postinstall 未可靠触发而出现 `@prisma/client` 导出缺失，进而导致 API build/typecheck 大面积失败
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api prisma:generate && pnpm build && pnpm typecheck`
  - 实测结果：本地按 CI 等价路径复验通过；API build/typecheck 已可稳定拿到生成后的 Prisma client

- ✅ source diagnostics / run-summary follow-up now keeps boundary drop counts accurate and web summary typing aligned
  - `SitemapSourceService` 在 `sitemapindex` 场景下不再把跨 child sitemap 的重复 page URL 误计入 `boundary.droppedPageUrlCount`
  - 当前仅在**唯一 page URL** 因命中 `maxPages` 被跳过时才累计 dropped page count，因此 `boundaryStats` 与 `latestBoundaryHit.boundarySummary` 不再把去重误报成边界丢弃
  - `apps/web/src/types/api.ts` 现已同步 knowledge-base run summary 的新增响应结构：
    - `boundaryStats`
    - `latestPartialSourceFailure`
    - `latestBoundaryHit.boundarySummary`
  - 这一轮继续保持为单主题 source diagnostics / run-summary 收口：不包含 reopen guard / ingestion reliability 变更
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
    - `pnpm typecheck`
  - 实测结果：focused sitemap parsing tests 与 typecheck 通过；边界 dropped-page 统计现在只反映真实的 limit drop，web 类型定义也已与后端 summary 响应对齐

- ✅ source boundary diagnostics now expose dropped-item counts in run summary anchors
  - `SitemapSourceService` now records explicit boundary counters when `maxPages`/`maxChildSitemaps` bounds are hit:
    - `totalExtractedPageUrlCount` / `selectedPageUrlCount` / `droppedPageUrlCount`
    - `totalExtractedChildSitemapCount` / `selectedChildSitemapCount` / `droppedChildSitemapCount`
  - `DocumentsService.buildExternalSourcePartialDiagnostics()` now preserves canonical partial-envelope fields (`code` / `failedStage` / `sourceKind` / `schemaVersion` / `category` / `message`) even when raw source diagnostics carry overlapping keys
  - `DocumentRunsService` summary now adds bounded boundary aggregation and anchor details:
    - `boundaryStats` (`runsWithBoundaryHit`, `byReason`, and dropped page/child/feed counters)
    - `latestBoundaryHit.boundarySummary` (`reasons` and dropped counters)
  - this remains a minimal backend observability increment: no source-family expansion, no run-state-machine rewrite, no retrieval/answering scope growth
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/parsing.test.js`
    - `pnpm test:api:file -- test/external-source-sync.test.js`
    - `pnpm test:api:file -- test/document-runs-summary.test.js`
    - `pnpm test:api:file -- test/sitemap-source-e2e.test.js`（当前环境缺少 `DATABASE_URL`，seed 阶段失败）
  - 实测结果：3 组 focused fast tests 全部通过；sitemap source E2E 在本地环境前置配置缺失（`DATABASE_URL`）时于 seed 阶段失败，本轮未虚报通过

- ✅ external source stabilization phase 2 (backend-first) now adds boundary-aware diagnostics, dedup signals, and new run-summary anchors
  - `FeedSourceService` 现在在 partial diagnostics 中补充了统一的边界与去重信号：
    - `sourceKind` / `schemaVersion`
    - `retryableFailureCount` / `nonRetryableFailureCount`
    - `skippedDuplicateEntryCount` / `skippedDuplicateEntryRefs`
    - `boundaryHit` / `boundaryReasons` / `boundary`
  - `SitemapSourceService` 现在在 sitemap-index 扩展过程中显式暴露执行边界信息：
    - child sitemap 扩展上限命中（`MAX_CHILD_SITEMAPS_REACHED`）
    - page 收集上限命中（`MAX_PAGES_REACHED`）
    - 对应 `boundaryHit` / `boundaryReasons` / `boundary` 结构
  - `DocumentsService.buildExternalSourcePartialDiagnostics()` 现在会输出更统一的 partial envelope：
    - `category: "external_source_partial"`
    - `partialFailureCount`
    - `retryableFailureCount` / `nonRetryableFailureCount`
    - `boundaryHit` / `boundaryReasons`
  - `DocumentRunsService` summary 现在新增两个轻量 anchor：
    - `latestPartialSourceFailure`
    - `latestBoundaryHit`
  - `DocumentRunsService` 对 `retryable` 的读取也补了兜底：当顶层 `retryable` 缺失时，会回退读取 `retryableFailureCount > 0`
  - 这一轮保持为最小 backend diagnostics / observability 增量：不改外部 source family 范围，不引入 connector 平台化改造
  - 新增 / 更新验证：
    - `pnpm --filter @rag-system/api test:file -- test/parsing.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/external-source-sync.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/document-runs-summary.test.js`
    - `pnpm build`
    - `pnpm typecheck`
  - 实测结果：上述 focused tests 与 build/typecheck 均通过，当前 P0 第二阶段的边界诊断、partial 结构标准化和 summary anchor 能力已落地

- ✅ document-run output now rejects invalid diagnostics `failedStage` values
  - `DocumentRunsService.buildFailureSummary()` 现在只接受属于 `DocumentRunFailedStage` 枚举的 diagnostics `failedStage`，非法字符串不再进入 API 输出
  - 这修复了历史/异常 diagnostics 输入可能把非枚举阶段值透传到 `listDocumentRuns` 输出的问题
  - 这一轮保持为最小 backend diagnostics 增量：不改 run 状态机和失败聚合策略，只补输出层 failedStage 归一化
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/document-runs-summary.test.js`
  - 实测结果：focused document-runs summary tests 18/18 通过；当 diagnostics 里出现非法 failedStage 时，输出会安全回落为 `null`

- ✅ listDocumentRuns now backfills failedStage from diagnostics for terminal runs with null stage columns
  - `DocumentRunsService.resolveOutputFailedStage()` 现在在 `failed/skipped/ready` 的 terminal run 上都支持从 diagnostics 回填 `failedStage`（仅 `pending/processing` 继续固定返回 `null`）
  - 这修复了历史或异常数据中“run.status=failed 但 failedStage 列为空”时 API 输出阶段信息丢失的问题
  - 这一轮保持为最小 backend diagnostics 增量：不改 run 状态机和聚合语义，只补输出层阶段回填一致性
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/document-runs-summary.test.js`
  - 实测结果：focused document-runs summary tests 17/17 通过；`listDocumentRuns` 对 failed run 的 `failedStage` 输出与 diagnostics 对齐

- ✅ issueOnly document-run list/summary behavior no longer drops older issue anchors
  - `DocumentRunsService.listKnowledgeBaseRuns()` 在 `issueOnly=true` 时不再固定“先取前 100 条再过滤后截断”，而是按批次向后扫描，直到收集到请求 `limit` 的 issue runs 或没有更多数据
  - `DocumentRunsService.getKnowledgeBaseRunSummary()` 在 `issueOnly=true` 时仍然保留 `latestSkipped` 锚点，不会因为 issue filter 先行而把 skip anchor 一起过滤掉
  - 这一轮保持为最小 backend diagnostics correctness 增量：不改 issue counters/failure 聚合语义，只修 issueOnly 结果可见性与截断遗漏
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/document-runs-summary.test.js`
  - 实测结果：focused document-runs summary tests 16/16 通过，`issueOnly=true` 现在既能保留 `latestSkipped`，也能在前 100 条非 issue 的情况下返回更老的 issue run

- ✅ issueOnly run summary now keeps `latestSkipped` visible
  - `DocumentRunsService.getKnowledgeBaseRunSummary()` 现在在 `issueOnly=true` 时，仍然会从完整已取 runs 集合里计算 `latestSkipped`，不再因为 issue filter 先行生效而把 skip anchor 一起过滤掉
  - 这一轮保持为最小 backend diagnostics 增量：不改 issueOnly 的 counters / failure aggregates，只修 `latestSkipped` 这个 summary anchor 的可见性
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/document-runs-summary.test.js`
  - 实测结果：focused document-runs summary tests 15/15 通过；`issueOnly=true` 时仍能返回 `latestSkipped`，同时 issue counters 继续只统计 ready/failed issue runs

- ✅ feed source E2E tests now use the current built-entry fallback and tolerate fast in-flight completion
  - `apps/api/test/feed-source-e2e.test.js` 已把 9 处硬编码 `apps/api/dist/main.js` 统一切到 `resolveBuiltApiEntry()` fallback 模式
  - 同文件里一条稳定复现的竞态断言也已收紧：`in-flight reindex from a partial-ready source...` 现在允许 version 2 run 在轮询时已经从 `processing` 快速推进到 `ready`
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件 source-E2E baseline 增量：不改 runtime，只修 feed source 这一个文件的 built-entry drift 与过严测试期望
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/feed-source-e2e.test.js`
  - 实测结果：focused feed source E2E tests 9/9 通过，当前构建产物布局变化与短暂 processing 过渡都不会再让这组测试误失败

- ✅ sitemap source E2E tests now use the current built-entry fallback
  - `apps/api/test/sitemap-source-e2e.test.js` 已把 12 处硬编码 `apps/api/dist/main.js` 统一切到 `resolveBuiltApiEntry()` fallback 模式
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件 source-E2E baseline 增量：只修 sitemap source 这一个文件的 built-entry drift，不改断言逻辑
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/sitemap-source-e2e.test.js`
  - 实测结果：focused sitemap source E2E tests 12/12 通过，当前构建产物布局变化不会再让这组 sitemap source 流程测试因入口路径硬编码而误失败

- ✅ web-page source E2E tests now use the current built-entry fallback
  - `apps/api/test/web-page-source-e2e.test.js` 已把 7 处硬编码 `apps/api/dist/main.js` 统一切到 `resolveBuiltApiEntry()` fallback 模式
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件 source-E2E baseline 增量：只修 web-page source 这一个文件的 built-entry drift，不扩成 feed/sitemap 批量清理
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/web-page-source-e2e.test.js`
  - 实测结果：focused web-page source E2E tests 7/7 通过，当前构建产物布局变化不会再让这组 web source 流程测试因入口路径硬编码而误失败

- ✅ api-flow integration test now uses the current built-entry fallback
  - `apps/api/test/api-flow.test.js` 已从硬编码 `apps/api/dist/apps/api/src/main.js` 切到统一的 `resolveBuiltApiEntry()` fallback 模式
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件 integration baseline 增量：只修一处 built-entry drift，不改 API flow 断言逻辑
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/api-flow.test.js`
  - 实测结果：focused API flow integration test 已通过，当前构建产物布局变化不会再让这条核心链路测试因入口路径硬编码而误失败

- ✅ stale local enqueue-failure supersede handling now has focused regression coverage
  - `DocumentsService` 里已存在的 stale enqueue-failure guard 现在有了 focused test：当旧版本 document 的本地 ingestion enqueue 失败，但数据库里已经有更新版本激活时，不再把旧版本标记为 failed，而是记录 `stale_guard` skip
  - 新增覆盖位于 `apps/api/test/documents.enqueue-failure.test.js`，断言这条路径会写入：
    - `failedStage: "stale_guard"`
    - `code: "INGESTION_RUN_SUPERSEDED"`
    - message: `Skipped stale ingestion enqueue failure handling because a newer document version is already active.`
  - 这一轮保持为最小 observability/test 增量：不改 runtime 行为，只补已存在 stale supersede 保护的回归覆盖
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/documents.enqueue-failure.test.js`
  - 实测结果：focused documents enqueue-failure tests 2/2 通过，stale enqueue-failure supersede path 已被锁定

- ✅ initial ingestion state-write failures now preserve the correct failed-stage classification
  - `DocumentIngestionProcessor` 不再把“初始 processing/parsing 状态写入失败”错误归类成 `INGESTION_INDEXING_FAILED`
  - 当前这类失败会记录为 `INGESTION_STATE_WRITE_FAILED`，并保持 `failedStage: "parsing"`，避免把最初状态写入问题误报成 indexing 阶段故障
  - 这一轮保持为最小 backend correctness / diagnostics 增量：只修正初始状态写入失败的诊断归类，不改其他 ingestion 阶段语义
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ingestion.orchestrator.test.js`
  - 实测结果：focused ingestion orchestrator tests 13/13 通过，初始状态写入失败路径已改为记录 `INGESTION_STATE_WRITE_FAILED` + `failedStage: "parsing"`

- ✅ retrieval-profile filters focused test now uses the current built-entry fallback
  - `apps/api/test/retrieval-profile-filters.test.js` 已从 3 处硬编码 `apps/api/dist/main.js` 切到与同族 `retrieval-profile-strategy.test.js` 一致的 `resolveBuiltApiEntry()` fallback 模式
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件 retrieval-profile 测试基线增量：只修这一处 built-entry drift，不扩成整批测试清理
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/retrieval-profile-filters.test.js`
  - 实测结果：3 个 focused retrieval-profile filters tests 全部通过，当前构建产物路径变化不会再让这组测试因启动入口硬编码而误失败

- ✅ ask-stream E2E focused test now uses the current built-entry fallback
  - `apps/api/test/ask-stream-e2e.test.js` 已从硬编码 `apps/api/dist/main.js` 切到与现有已修测试一致的 `resolveBuiltApiEntry()` fallback 模式
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件 stream E2E 基线增量：只修一处 built-entry drift，不扩成多文件批量清理
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ask-stream-e2e.test.js`
  - 实测结果：focused ask-stream E2E 已通过，当前构建产物路径变化不会再让这条 stream 路径测试因启动入口硬编码而误失败

- ✅ assistants API focused test now uses the current built-entry fallback
  - `apps/api/test/assistants-api.test.js` 已从硬编码 `apps/api/dist/main.js` 切到与现有已修测试一致的 `resolveBuiltApiEntry()` fallback 模式
  - 当前优先尝试 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮保持为最小单文件测试基线增量：只修一处 API integration test 的 built-entry drift，不扩成多文件批量清理
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/assistants-api.test.js`
  - 实测结果：focused assistants API test 已通过，当前构建产物路径变化不会再让这条测试因启动入口硬编码而误失败

- ✅ removed the stray empty Prisma migration artifact
  - 已删除本地未跟踪的空 migration stub：`apps/api/prisma/migrations/20260325201719_ensure_latest_embedding_config_normalization/migration.sql`
  - 审计结论确认这不是实际待收口 schema 变更：
    - `migration.sql` 原本为空
    - `apps/api/prisma/schema.prisma` 没有对应未提交 schema 变更
    - embedding config normalization 已落在 runtime / vector-store 代码中，而不是 Prisma schema
  - 这一轮保持为最小 cleanup 增量：不改数据库 schema、不生成新 migration、不改 runtime 行为，只移除误留的本地 artifact
  - 新增 / 更新验证：
    - `git status --short --branch`
    - glob 校对 `apps/api/prisma/migrations/20260325201719_ensure_latest_embedding_config_normalization/**` 已无文件
  - 实测结果：该 migration 不再出现在工作区未跟踪列表中，当前只剩 `.sisyphus/*` 本地规划文件未跟踪

- ✅ current dev setup doc now matches the current traceSummary field surface
  - `docs/current-dev-setup.md` 的 `current trace read semantics` 段已补齐剩余的 `traceSummary` 字段列表漂移，并和 `docs/retrieval-trace.md` / `packages/shared/src/trace-contracts.ts` 对齐
  - 补齐字段覆盖：
    - `promptId`
    - `missingInformationSource`
    - retrieval candidate-flow counts / limit-hit flags
    - `primaryChunkCount` / `neighborChunkCount`
    - `inputChunkCount` / `promptContextCount` / `contextGroupCount`
    - `citationCountBeforeLimit` / `citationLimitHit`
  - 这一轮保持为最小 doc-only 跟进：只同步 setup 文档中的 traceSummary 列表，不改 runtime、测试或其他文档结构
  - 新增 / 更新验证：
    - read-back 校对 `docs/current-dev-setup.md` 的 `current traceSummary fields are:` 列表，并与 `docs/retrieval-trace.md` 对照一致
  - 实测结果：`current-dev-setup.md` 当前已完整列出 38 个 `traceSummary` 字段，setup 文档与主参考文档已收口一致

- ✅ retrieval trace reference doc now matches the current traceSummary field surface
  - `docs/retrieval-trace.md` 的 `Trace read summary` 段已补齐当前共享 `TraceSummary` contract 中此前遗漏的字段，包括：
    - `promptId`
    - `missingInformationSource`
    - retrieval candidate-flow counts / limit-hit flags
    - `primaryChunkCount` / `neighborChunkCount`
    - `inputChunkCount` / `promptContextCount` / `contextGroupCount`
    - `citationCountBeforeLimit` / `citationLimitHit`
  - 这一轮保持为最小 doc-only 同步：只更新 trace 主参考文档里的字段列表，不改 `current-dev-setup.md`，不改运行时代码或测试
  - 新增 / 更新验证：
    - read-back 校对 `docs/retrieval-trace.md` 中 `Current traceSummary shape includes:` 列表，确认已和 `packages/shared/src/trace-contracts.ts` 对齐
  - 实测结果：`retrieval-trace.md` 当前已完整列出 38 个 `traceSummary` 字段，可直接作为本轮 trace read-model / contract 对齐后的主参考

- ✅ ask-chain E2E traceSummary baseline now matches the current shared contract
  - `apps/api/test/ask-chain-e2e.test.js` 现在已补齐 conversation trace list 与 trace detail 对 `traceSummary` 的新字段断言，包括：
    - `promptId`
    - `missingInformationSource`
    - retrieval candidate-flow counts / limit-hit flags
    - `primaryChunkCount` / `neighborChunkCount`
    - `inputChunkCount` / `promptContextCount` / `contextGroupCount`
    - `citationCountBeforeLimit` / `citationLimitHit`
  - 同文件也顺手修正了过期的 built API entry 路径：优先使用 `apps/api/dist/apps/api/src/main.js`，不存在时再回退到 `apps/api/dist/main.js`
  - 这一轮仍然保持为最小测试基线增量：不改 backend runtime 行为、不改 shared contract、不改 API payload，只补 ask-chain E2E 对现状的验证覆盖
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ask-chain-e2e.test.js`
  - 实测结果：在最小本地 fallback embedding 环境下，ask-chain E2E 已通过，traceSummary 断言与当前共享 contract 对齐

- ✅ web traceSummary contract guard now covers the latest shared fields
  - `apps/web/test/trace-summary-contract.test.js` 现在不再只守旧的 query-source / failed-stage / candidate-flow 子集，也同步守住共享 `TraceSummary` 里最近补齐的字段：
    - `promptId`
    - `missingInformationSource`
    - `primaryChunkCount`
    - `neighborChunkCount`
    - `inputChunkCount`
    - `promptContextCount`
    - `contextGroupCount`
    - `citationCountBeforeLimit`
    - `citationLimitHit`
  - 这一轮继续保持为最小 contract-guard 增量：不改 web runtime 行为、不改 backend read model、不改共享类型定义，只补 source-level drift 防护
  - 新增 / 更新验证：
    - `node --test apps/web/test/trace-summary-contract.test.js`
  - 实测结果：contract test 通过，当前 web 侧对共享 `TraceSummary` 的 source guard 已和最新 shared contract 对齐

- ✅ traceSummary now preserves legacy promptContextCount semantics
  - `TracesService` 现在在读取旧 trace 时，不再把缺失的 `traceSummary.promptContextCount` 一律回退成 `0`
  - 当前会按已有 answering metadata 语义回推：`contextMode=context_groups` 时回退到 `contextGroupCount`，否则回退到 `inputChunkCount`
  - 这一轮继续保持为纯 read-model / traceability correctness 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 legacy trace 在缺失 `promptContextCount` 时仍能按 `contextMode` 回推出正确值
    - `pnpm test:api:file -- test/traces.service.test.js`
    - `pnpm --filter @rag-system/api build`
  - 实测结果：focused traces test 通过；手动构造 legacy `context_groups` trace 时，`traceSummary.promptContextCount=2`、`inputChunkCount=3`、`contextGroupCount=2`，不再错误回退为 `0`

- ✅ traceSummary now exposes neighborChunkCount
  - `TraceSummary` 现在会把持久化在 `retrievalMetadataJson.execution` 里的 `neighborChunkCount` 提升到轻量 summary 读模型，便于直接看见最终进入回答上下文的检索块里，有多少来自 chunk-window / neighbor 扩展，而不必回读整块 retrieval metadata
  - 这一轮和刚落地的 `primaryChunkCount` 一样，属于 retrieval-composition 的纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.neighborChunkCount`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `neighborChunkCount`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `neighborChunkCount`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `retrievalMetadataJson.execution.neighborChunkCount` 对齐；缺失时默认回退为 `0`

- ✅ traceSummary now exposes primaryChunkCount
  - `TraceSummary` 现在会把持久化在 `retrievalMetadataJson.execution` 里的 `primaryChunkCount` 提升到轻量 summary 读模型，便于直接看见最终进入回答上下文的检索块里，有多少是 primary 命中而不是 window/neighbor 扩展块
  - 这一轮标志着此前 answering-side traceSummary 小字段链已经收口，并转入相邻的 retrieval-composition 读模型增量；仍然不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.primaryChunkCount`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `primaryChunkCount`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `primaryChunkCount`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `retrievalMetadataJson.execution.primaryChunkCount` 对齐

- ✅ traceSummary now exposes contextGroupCount
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `contextGroupCount` 提升到轻量 summary 读模型，便于直接看见回答阶段经过上下文分组后的 group 数量，而不必回读整块 answering metadata
  - 这一轮和前几条 traceSummary 增量一样，属于纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.contextGroupCount`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `contextGroupCount`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `contextGroupCount`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.contextGroupCount` 对齐

- ✅ traceSummary now exposes promptId
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `promptId` 提升到轻量 summary 读模型，便于直接看见具体是哪一版 answer prompt 产出了这条 trace，而不必回读整块 answering metadata
  - 这一轮和前几条 traceSummary 增量一样，属于纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.promptId`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `promptId`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `promptId`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.promptId` 对齐

- ✅ traceSummary now exposes inputChunkCount
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `inputChunkCount` 提升到轻量 summary 读模型，便于直接看见回答阶段在上下文整形前的原始 chunk 数量，而不必回读整块 answering metadata
  - 这一轮和前几条 traceSummary 增量一样，属于纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.inputChunkCount`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `inputChunkCount`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `inputChunkCount`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.inputChunkCount` 对齐

- ✅ traceSummary now exposes promptContextCount
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `promptContextCount` 提升到轻量 summary 读模型，便于直接看见真正进入回答阶段 prompt 的上下文单元数量，而不必回读整块 answering metadata
  - 这一轮和前几条 traceSummary 增量一样，属于纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.promptContextCount`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `promptContextCount`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `promptContextCount`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.promptContextCount` 对齐

- ✅ traceSummary now exposes citationCountBeforeLimit
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `citationCountBeforeLimit` 提升到轻量 summary 读模型，便于直接看见 citation 在应用上限前的原始数量，而不必回读整块 answering metadata
  - 这一轮和前两条 `missingInformationSource` / `citationLimitHit` 一样，属于纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.citationCountBeforeLimit`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `citationCountBeforeLimit`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `citationCountBeforeLimit`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.citationCountBeforeLimit` 对齐

- ✅ traceSummary now exposes citationLimitHit
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `citationLimitHit` 提升到轻量 summary 读模型，便于直接区分“最终 citation 数量本来就少”和“citation 被策略上限截断”
  - 这一轮和上一条 `missingInformationSource` 一样，属于纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.citationLimitHit`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `citationLimitHit`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `citationLimitHit`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.citationLimitHit` 对齐

- ✅ traceSummary now exposes missingInformationSource
  - `TraceSummary` 现在会把持久化在 `answeringMetadataJson` 里的 `missingInformationSource` 提升到轻量 summary 读模型，便于在 trace detail 与 conversation trace list 中直接看见缺失信息来源，而不必回读整块 answering metadata
  - 这一轮是纯 read-model / traceability 增量：不改 ask 写路径、不改 schema、不改 retrieval / answering 行为
  - 最小契约对齐：`packages/shared/src/trace-contracts.ts` 已同步加入 `TraceSummary.missingInformationSource`
  - 新增 / 更新验证：
    - `apps/api/test/traces.service.test.js`
      - focused 断言 trace summary detail/list 都暴露 `missingInformationSource`
    - `apps/api/test/api-flow.test.js`
      - integration 断言真实 `/conversations/:id/traces` 与 `/traces/:id` 返回的 `traceSummary` 包含 `missingInformationSource`
    - `pnpm --filter @rag-system/shared build`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm --filter @rag-system/api test:file -- test/api-flow.test.js`
  - 实测结果：focused traces test、shared build、真实 API flow integration 均通过，summary 字段已和 `answeringMetadataJson.missingInformationSource` 对齐

- ✅ initial ingestion state-write failure recording after run activation
  - `DocumentIngestionProcessor` 现在会把第一条 `document.status=processing / processingStage=parsing` 的状态写入也纳入统一的失败收口路径；不再存在“run 已激活，但第一次 document 状态写入抛错后直接逃出 `try/catch`”的窗口
  - 这样同版本 job 在 run activation 成功后，如果最早的 document 状态更新失败，也会正确把 document/run 收口为 failed，而不会把 run 卡在 `processing` 并让后续同版本 retry 无法继续
  - 这一轮只收这个入口窗口，不扩 generic diagnostics 分类策略；当前仍沿用既有 `buildIngestionDiagnostics()` 的默认 generic error 归类
  - 新增 focused coverage：
    - `apps/api/test/ingestion.orchestrator.test.js`
      - initial document state update failure after run activation records failed document and run
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma + 真实 `DocumentRunsService` 跑一个隔离 proof，只在第一次 `document.update(processing/parsing)` 注入 `Synthetic initial document state update failure.`
    - 实测结果：最终 document/run 都收口为 `failed`，`initialStateFailureRecorded=true`，且 `processingHangAvoided=true`

- ✅ enqueue-failure recording after run/document state advances
  - `DocumentsService` 现在会在 document/run 已经推进到 `pending` 之后，如果 `enqueueDocument()` / BullMQ `Queue.add()` 失败，立刻把当前 version 的 document 和 run 收口为 failed，而不再留成“看起来已排队、实际无 job”的假 pending 状态
  - local ingestion 路径现在记为 `INGESTION_ENQUEUE_FAILED`；external source 路径现在记为 `EXTERNAL_SOURCE_ENQUEUE_FAILED`
  - 这一轮继续只收 producer enqueue failure 的状态收口，不改 queue 基础设施、Redis 配置或更大的 producer retry 设计
  - 新增 focused coverage：
    - `apps/api/test/documents.enqueue-failure.test.js`
      - local reindex enqueue failure records failed document and run
    - `apps/api/test/external-source-sync.test.js`
      - external enqueue failure after finalize records failed document and run
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/documents.enqueue-failure.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/external-source-sync.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma 跑一个 local `reindexDocument` proof，并让 producer `enqueueDocument()` 抛出 `Synthetic queue add failure.`
    - 实测结果：最终 `document(version=2)` 与对应 run 都收口为 `failed/parsing`，诊断码一致为 `INGESTION_ENQUEUE_FAILED`，`enqueueFailureRecorded=true`

- ✅ retryable-only same-version run reopen semantics
  - `DocumentRunsService.markRunProcessing()` 现在不再把所有 `failed` run 一律重新拉回 `processing`；当前只允许 `pending`，以及 `diagnosticsJson.retryable === true` 的 `failed` run 重新激活
  - 这样 run-level 语义和前面补上的 processor 入口 guard 现在对齐：non-retryable failed run 仍保持 terminal，而 retryable failed run 继续保留自动重试路径
  - 这一轮只收 run-level reopen 规则，不改 BullMQ `attempts` 配置，也不扩成更大的 retry-policy 重构
  - 新增 focused coverage：
    - `apps/api/test/document-runs.service.test.js`
      - retryable failed run reopens, non-retryable failed run stays blocked
    - `apps/api/test/ingestion.orchestrator.test.js`
      - processor-level non-retryable same-version retry still short-circuits
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/document-runs.service.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma 写入一条 `retryable failed` run 和一条 `non-retryable failed` run，再实际调用 `markRunProcessing()`
    - 实测结果：`retryableResult.count=1` 且 run 进入 `processing`；`nonRetryableResult.count=0` 且 run 保持 `failed`，`onlyRetryableReopened=true`

- ✅ external-source post-fetch persistence failure recording
  - `DocumentsService` 现在会把 external source 在 fetch 成功后的持久化阶段异常也收口为失败：包括 `saveGeneratedTextFile()` 和 finalize/update 链路抛错
  - 这样 external source run 在已创建、fetch 已成功后，如果落盘或 finalize 失败，不会再把 document/run 留在 `pending/uploaded` 的未决状态
  - 这一轮继续只收在 external-source 后处理的 failure-recording 缺口，沿用既有 `source_fetch` failedStage，不扩 enum 或更大的 source workflow 重构
  - 新增 focused coverage：
    - `apps/api/test/external-source-sync.test.js`
      - external source persistence failure after fetch records failed document and run
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/external-source-sync.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma 跑一个 external `reindexDocument` proof：fetch 成功后让 `saveGeneratedTextFile()` 抛出 `Synthetic external persistence failure.`
    - 实测结果：最终 `document(version=2)` 与对应 run 都收口为 `failed/source_fetch`，诊断码一致为 `EXTERNAL_SOURCE_PERSIST_FAILED`，`failedStateRecorded=true`

- ✅ non-retryable same-version ingestion retry guard
  - `DocumentIngestionProcessor` 现在会在处理开始前识别“当前 document 已处于 `failed` 且 `diagnosticsJson.retryable === false`”的情况，并直接跳过同版本 queue retry
  - 这样对 unsupported file type / empty content 之类的 terminal parsing failure，BullMQ 的自动重试不会再把同一 document version 重新拉回 `processing`
  - 这一轮刻意只收 processor 入口 guard，不改 queue `attempts` 配置，也不扩成更大的 run-state / retry-policy 重构
  - 新增 focused coverage：
    - `apps/api/test/ingestion.orchestrator.test.js`
      - non-retryable failed same-version run does not reopen on queue retry
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma 跑一个隔离 proof：先写入 `status=failed`、`retryable=false` 的 document + run，再手动调用同版本 `processDocument`
    - 实测结果：日志显示直接跳过 non-retryable retry，最终 document 与 run 均保持 `failed/parsing`，`stayedFailed=true`、`remainedNonRetryable=true`

- ✅ indexing expected-version guard for stale mid-index vector writes
  - `IndexingService.indexDocument()` 现在支持可选 `expectedVersion`，并且会在真正执行 vector delete / replace 之前再次确认当前 `document.version` 仍匹配本次运行版本
  - 这样旧 ingestion job 即使已经进入 indexing，并在 embedding 计算期间被新版本覆盖，也不会在稍后恢复时继续删除或覆盖当前 vectors
  - `DocumentIngestionProcessor` 现会把当前 `document.version` 传入 indexing，使这道 guard 只收在既有 ingestion → indexing 链路内，不扩到 queue / schema / retrieval
  - 新增 focused coverage：
    - `apps/api/test/indexing.test.js`
      - stale expected version blocks vector replace
      - stale expected version blocks vector delete
    - `apps/api/test/ingestion.orchestrator.test.js`
      - indexing call now threads `expectedVersion`
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/indexing.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma + 本地 file-backed vector store 跑一个隔离 proof：先启动被阻塞的 `indexDocument(documentId, 1)`，在 embedding 阶段把 document 提升到 `version=2` 并写入 `NEW_TOKEN` chunks/vectors，再释放旧 indexing
    - 实测结果：最终 vector 文件只保留 `NEW_TOKEN`，`preservedNewVectors=true`、`staleOldVectorsAbsent=true`，旧 indexing 未发生 stale overwrite

- ✅ ingestion stale mid-flight chunk/vector side-effect guard
  - `DocumentIngestionProcessor` 现在不只在 terminal write 前检查 supersede；在进入 `chunking` 写路径前，以及进入 `indexing` 写路径前，也会再次确认当前 `document.version` 仍匹配运行中的 job
  - 这样旧 ingestion job 如果在 parsing 完成后、chunk rebuild 前，或在 chunk rebuild 完成后、vector replacement 前被新版本覆盖，会直接收口为 `skipped / stale_guard`，不再继续改写当前 document 的 chunks / vectors
  - 这一轮继续只收 ingestion 内部的 stale side-effect 窗口，不改 queue 语义、schema，也不扩成更大的 indexing 架构调整
  - 新增 focused coverage：
    - `apps/api/test/ingestion.orchestrator.test.js`
      - stale before chunk mutation leaves chunks and indexing untouched
      - stale after chunk rebuild leaves indexing untouched
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用真实 Prisma + 本地 storage/vector 文件跑一个隔离 proof：先为同一 document seed `ORIGINAL_TOKEN` 的 chunk 和 vector，再在 parsing 结束后把 document 抬到 `version=2`
    - 实测结果：旧 `version=1` run 收口为 `skipped/stale_guard`，document 保持 `version=2 / pending / uploaded`，chunk 与 vector 内容都仍是 `ORIGINAL_TOKEN`，未被旧 job 改写

- ✅ ingestion queue jobId dedupe for same document version
  - `QueueService` 现在会为带 `documentVersion` 的 ingestion enqueue 生成稳定 `jobId`：同一 `documentId + version` 重复 enqueue 时不再创建第二个 BullMQ ingestion job
  - 这一轮只收口 queue producer 去重，不改已有 run-level stale guard、same-version terminal-run guard 或更大的调度语义
  - 新增 focused coverage：
    - `apps/api/test/queue.service.test.js`
      - duplicate enqueue for the same document version leaves exactly one queued ingestion job
  - focused validation rerun：
    - `pnpm test:api:file -- test/queue.service.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 直接用本地 Redis + BullMQ `QueueService` 在隔离 `QUEUE_PREFIX` 下连续 enqueue 两次同一 `documentId + version`
    - 实测结果只保留 `1` 条 queued job，且两次返回的 `jobId` 相同：`ingest-document-document-runtime-proof-1-8`

- ✅ external source expected-version guard for stale finalize/failure writes
  - `DocumentsService` 现在会在 external source 的 finalize 与 failure 落库前确认当前 document `version` 仍等于本次预留版本
  - 如果旧的 external fetch / resync 在较慢返回时发现自己已被新版本覆盖，当前请求不会再按 `id` 回写 `title` / `storageKey` / `failed` 状态，也不会错误 enqueue 新版本
  - 被覆盖的旧 external run 现在会收口为 `skipped / stale_guard`，诊断码为 `EXTERNAL_SOURCE_RUN_SUPERSEDED`
  - 新增 focused coverage：
    - `apps/api/test/external-source-sync.test.js`
      - stale external finalize does not overwrite a newer document version
      - stale external fetch failure does not overwrite a newer document version
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/external-source-sync.test.js`
    - `pnpm test:api:focus:documents`
    - `pnpm --filter @rag-system/api build`
  - real runtime verification：
    - 用最新 build 的本地 API（port `3012`）配合一个慢速本地 web source，连续发起两次同 URL 的 `createWebPageDocument`
    - 最终只保留 `version=2 / title="Second Title"` 的最新结果，旧 `version=1` 收口为 `skipped/stale_guard`，未发生 stale overwrite

- ✅ ingestion duplicate same-version run activation guard
  - `DocumentIngestionProcessor` 现在会先尝试把对应 run 从可激活状态切到 `processing`，只有激活成功后才会把 document 本身改到 `processing/parsing`
  - `DocumentRunsService.markRunProcessing()` 现仅允许既有 run 处于 `pending` 或 `failed` 时重新进入 `processing`；已是 `ready` / `skipped` 的同版本重复 job 会直接退出，不再把 terminal run 重新打开
  - 新增 focused coverage：
    - `apps/api/test/ingestion.orchestrator.test.js`
      - duplicate same-version job does not reopen a terminal run
  - focused validation rerun：
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification：
    - 用最新 build 的本地 API（port `3011`）先 upload 一个文档至 `ready`
    - 再手动向 BullMQ 注入同一 `documentId + version` 的 duplicate ingestion job
    - 结果保持：document 仍为 `ready/completed`，run 仍只有 1 条，未被重新打开

- ✅ ingestion mid-flight supersede hardening minimum increment
  - `DocumentIngestionProcessor` 现在不再只在 job 开头做一次 stale guard；在 terminal write 前会再确认当前 document `version` 仍与运行中的 job 一致
  - 当旧 ingestion job 在处理中被新的 `reindex` / `external_resync` 版本覆盖时，旧 job 现在会收口为 `skipped / stale_guard`，而不是继续把 document 终态写成 `ready` 或 `failed`
  - 这一轮刻意只修最危险的 terminal-state overwrite 风险，没有扩成更大的并发重构，也没有重开 source-family / retrieval 范围
  - 新增 focused coverage：
    - `apps/api/test/ingestion.orchestrator.test.js`
      - mid-flight superseded success path does not overwrite ready state
      - mid-flight superseded failure path does not overwrite failed state
  - focused validation rerun:
    - `pnpm --filter @rag-system/api test:file -- test/ingestion.orchestrator.test.js`
    - `pnpm test:api:focus:documents`
  - real runtime verification:
    - 本地 API 实跑 upload + 连续两次 `POST /documents/:id/reindex`
    - 观察到 runs 收口为：最新 `v3=ready`，被覆盖的 `v2=skipped/stale_guard`，未出现旧版本覆盖新版本终态

补充进展（2026-03-25）：

- current source-family backend hardening 现已补一个最后的 bounded follow-up，继续只收在既有 `web page` / `feed` / `sitemap` / `sitemap index` family：
  - `sitemap` partial-ready diagnostics 不再把所有 partial case 一律记成 `retryable: true`
  - 当前会按实际 child-sitemap / page failure 结果收口 top-level retryable 语义，避免 run summary 的 `latestRetryableFailure` 被非可重试 partial case 误锚定
  - `sitemap` partial run message 现在也会区分：
    - partial page fetch failures
    - partial child sitemap fetch failures
    - mixed child sitemap + page fetch failures
  - 上述 source hardening follow-up 现已补齐 focused coverage：
    - `apps/api/test/external-source-sync.test.js`
    - `apps/api/test/sitemap-source-e2e.test.js`
  - 本地验证已按要求尝试：
  - `pnpm test:api:focus:sources`
  - `pnpm --filter @rag-system/api test:file -- test/external-source-sync.test.js`
  - 当前工作区存在现成环境阻塞：缺少本地 `node_modules` / `vitest`，两条命令均在测试执行前失败；本次先保留该验证阻塞说明，不虚报通过

- `packages/shared` 现已开始承载真实跨包 contract，首个收口 family 为 `traceSummary`：
  - `packages/shared/src/trace-contracts.ts` 现定义 trace read-model 的共享联合类型与 `TraceSummary`
  - backend `TracesService` 现直接以该共享 contract 约束返回形状
  - web `TraceRecord.traceSummary` 现改为直接复用共享类型，而不再在 `apps/web/src/types/api.ts` 内联重复声明整段 payload
  - `apps/web/test/trace-summary-contract.test.js` 现也改为断言 web 类型从 `@rag-system/shared` 导入并跟随共享源文件

- web ask-response contract 现也已对齐 backend 已稳定返回的 `qualityEvaluation` 最小结构：
  - `overall`
  - `grounding`
  - `completeness`
  - `primaryIssue`
  - `flags`
  - `summary`
- 这样当前前端消费 ask / stream final payload 时，不再把 backend 已稳定返回的质量评估结果继续保留为完全无类型的 `JsonValue`
- 上述 ask quality-evaluation contract alignment 现已补齐最小 source-level 回归覆盖：
  - `apps/web/test/ask-quality-evaluation-contract.test.js`

- web ask-response contract 现也已对齐 backend 已稳定返回的 `answeringMetadata` 最小结构：
  - `promptId`
  - `usedFallback`
  - `answerPolicy`
  - `resolvedLanguage`
  - `generationMode`
  - `contextMode`
  - `inputChunkCount`
  - `promptContextCount`
  - `contextGroupCount`
  - `citationCountBeforeLimit`
  - `citationCount`
  - `citationLimitHit`
  - `citationAttribution`
  - `citationSelectionSource`
  - `missingInformationCount`
  - `missingInformationSource`
  - `answerTextSource`
  - `insufficientContextReason`
  - `answerStatusSource`
  - `answerStatus`
- 这样当前前端消费 ask / stream final payload 时，不再把 backend 已稳定返回的 answering execution metadata 继续保留为完全无类型的 `JsonValue`
- 上述 ask answering-metadata contract alignment 现已补齐最小 source-level 回归覆盖：
  - `apps/web/test/ask-answering-metadata-contract.test.js`

- web ask-response contract 现也已对齐 backend 已稳定返回的 `retrievalMetadata` 最小结构：
  - `strategy`
  - `filters`
  - `queryRewrite`
  - `execution`
- 其中 `execution` 当前也已覆盖现有稳定的 candidate-flow / context-shaping 字段：
  - `candidateLimit`
  - `vectorCandidateCount`
  - `lexicalCandidateCount`
  - `mergedCandidateCount`
  - `rankedCandidateCount`
  - `retrievedChunkCount`
  - `contextGroupCount`
  - `primaryChunkCount`
  - `neighborChunkCount`
- 这样当前前端消费 ask / stream final payload 时，不再把 backend 已稳定返回的 retrieval execution metadata 继续保留为完全无类型的 `JsonValue`
- 上述 ask retrieval-metadata contract alignment 现已补齐最小 source-level 回归覆盖：
  - `apps/web/test/ask-retrieval-metadata-contract.test.js`

- trace 读取接口的 additive `traceSummary` 现已继续补齐 retrieval candidate-flow 诊断字段：
  - `candidateLimit`
  - `vectorCandidateCount`
  - `lexicalCandidateCount`
  - `mergedCandidateCount`
  - `rankedCandidateCount`
  - `vectorCandidateLimitHit`
  - `lexicalCandidateLimitHit`
  - `rankingTopKHit`
- 这样上层读取 `GET /traces/:id` 与 `GET /conversations/:id/traces` 时，不再只能回退到原始 `retrievalMetadataJson.execution` 才能判断候选池是否打满、fallback 前拿到了多少 vector candidates，以及排序前后候选规模
- 当前改动保持为 trace read-model 收口，不改 retrieval 排序、fallback、ask / stream 行为
- 上述 trace-summary candidate-flow 收口现已补齐最小回归覆盖：
  - `apps/api/test/traces.service.test.js`
  - `apps/api/test/api-flow.test.js`
  - `apps/web/test/trace-summary-contract.test.js`

- retrieval execution diagnostics 现在会在 `no_ranked_candidates` 触发 lexical fallback 时，继续保留 fallback 之前已经拿到的 vector candidate 统计：
  - `vectorCandidateCount`
  - `vectorCandidateLimitHit`
- 这样当向量检索“有候选但全被阈值/排序淘汰”时，execution metadata 不再误报成“完全没有 vector candidates”
- 当前改动只收口 retrieval read-model 级执行诊断，不改变既有 fallback 判定、排序或返回 chunk 语义
- 上述 fallback-diagnostics 边界现已补齐最小 source-level 回归覆盖：
  - `apps/api/test/retrieval.test.js`

- web ask-response contract 现也已对齐 backend `contextGroups` 的完整返回形状：
  - `documentId`
  - `documentTitle`
  - `startChunkIndex`
  - `endChunkIndex`
  - `chunkIds`
  - `primaryChunkIds`
  - `mergedContent`
  - `pageNumbers`
  - `sectionTitles`
- 这样当前前端消费 ask / stream final payload 时，不再把 backend 已稳定返回的 context-group metadata 缩窄成只剩 `primaryChunkIds` 和 `mergedContent`
- 上述 ask context-group contract alignment 现已补齐最小 source-level 回归覆盖：
  - `apps/web/test/ask-context-groups-contract.test.js`

- web document-run contract 现也已对齐 backend 已返回的 `failureSummary` 字段：
  - `DocumentRunRecord`
  - `KnowledgeBaseDocumentRunRecord`
  - `KnowledgeBaseDocumentRunSummary.latestRetryableFailure`
  - `KnowledgeBaseDocumentRunSummary.latestSkipped`
  - `KnowledgeBaseDocumentRunSummary.latestFailure`
- 这样当前前端消费 run list / summary anchors 时，不再把 backend 已稳定返回的最小失败摘要遗漏在过时类型之外
- 上述 document-run contract alignment 现已补齐最小 source-level 回归覆盖：
  - `apps/web/test/document-run-contract.test.js`

- web trace contract 现已对齐 backend 已落地的 additive `traceSummary` 枚举值：
  - `retrievalQuerySource`: `rewritten` / `original_disabled` / `original_unchanged`
  - `failedStage`: `retrieval` / `answering`
- 这样当前前端消费 trace summary 时，不再把 backend 已存在的 `original_unchanged` 查询来源和 `retrieval` 失败阶段误缩窄成过时联合类型
- 上述 trace-contract alignment 现已补齐最小 source-level 回归覆盖：
  - `apps/web/test/trace-summary-contract.test.js`

- knowledge-base scoped run summary 现已支持与 run list 对齐的窄过滤输入：
  - `documentId`
  - `sourceType`
  - `status`
  - `trigger`
  - `issueOnly`
  - `sinceHours`
- 这样 `GET /knowledge-bases/:id/document-runs/summary` 不再只能做全量 recent-window 聚合，现也可按已有 observability 过滤口径收窄统计和 latest anchors
- `Knowledge Base` 页当前 recent runs summary 也已跟随现有 `all / failed / processing` 过滤切换同口径请求，避免摘要与下方列表出现口径漂移
- 上述 summary-filter follow-up 现已补齐最小 source-level 回归覆盖：
  - `apps/api/test/document-runs-summary.test.js`

- `traceSummary` 的集成 / E2E 验证基线现已对齐最近新增的 provenance 字段：
  - `apps/api/test/api-flow.test.js`
  - `apps/api/test/ask-chain-e2e.test.js`
- 这样 `GET /traces/:id` 与 `GET /conversations/:id/traces` 的现有重型链路验证，不再只覆盖旧版 summary 结构

- trace 读取接口的 additive `traceSummary` 现已继续补齐常用执行归因字段：
  - `retrievalQuerySource`
  - `contextMode`
  - `resolvedLanguage`
  - `citationSelectionSource`
  - `answerTextSource`
  - `answerStatusSource`
- 这样上层读取 trace 时，不再只能从原始 `retrievalMetadataJson` / `answeringMetadataJson` 中自行重建“最终查询来源、上下文组织方式、语言分流和答案归因”
- 当前改动保持为 read-model 收口，不改 trace 持久化写路径，也不改 ask / stream 行为
- 上述 trace-summary provenance 提升现已补齐最小 source-level 回归覆盖：
  - `apps/api/test/traces.service.test.js`

- streamed answering finalization 现已和 one-shot fallback 结果进一步收口：
  - 当 native stream 走 `fallback-local` 且结构化解析缺少 `answerStatus` / `missingInformation` / citation 选择时，backend 会在 `AnsweringService.finalizeStreamedAnswer()` 内先补齐与 one-shot 相同的 fallback 归一化结果
  - 这样 grounded fallback stream 不再把 `answerStatusSource` 错记为纯 retrieval 推断，也不再把 one-shot 已稳定暴露的 fallback citation provenance 丢成 inline-marker / inferred 语义
  - no-hit `best_effort` fallback stream 现在也会和 one-shot 一样保留稳定的 insufficient-context provenance，而不是让 final payload / trace 退回到二次推断的 `missingInformationSource`
  - 上述 stream/one-shot convergence 现已补齐 focused 回归覆盖：
    - `apps/api/test/answering.test.js`
    - `pnpm test:api:focus:ask`
    - `pnpm --filter @rag-system/api test:file -- test/llm-answer-stream.test.js`

- knowledge-base scoped recent run list 现已支持最小 `issueOnly` 过滤，可直接聚焦真正“需要关注”的 completed issue runs
- 该过滤会对齐现有 run summary 的 failureSummary 口径：
  - 包含 terminal `failed` runs
  - 包含带 partial failureSummary 的 `ready` runs
  - 不包含 `skipped` runs
  - 不包含仅临时保留 partial diagnostics 的 `pending` / `processing` runs
- 当前实现保持现有 `status` 过滤语义不变，只在 `GET /knowledge-bases/:id/document-runs` 上新增窄范围可选过滤
- 上述 issue-only 过滤边界现已补齐最小 source-level 回归覆盖：
  - `apps/api/test/document-runs-summary.test.js`

- API fast test lane 现已切到 `Vitest`，integration / E2E 继续保留当前 Node test runner + `dist` 启动路径，形成快慢分层的 backend test workflow
- `PATCH /retrieval-profiles/:id` 现也已支持 `strategyJson: null`，可显式清空已保存的 retrieval strategy override，回退到既有 flat fields 推导的默认策略语义
- `Assistant` 页面现也已补齐 retrieval `strategyJson` 覆盖编辑能力，可直接管理 query rewrite、candidate mode、candidate budget、hybrid weights 和 rerank override，并在关闭覆盖时提交 `strategyJson: null`
- 上述 `Assistant strategy` 配置区现也已补齐最小 source-level 回归覆盖，锁定关键区块和控件的稳定 selector，便于后续浏览器级验证继续接入
- `pnpm test:api:file -- <path>` 现已按测试文件类型自动分流：fast-lane 文件直接走 `Vitest`，heavy 文件先做 build freshness 检查，再走原 runner
- heavy API test lane 现已具备 on-demand build 检查；仅当 `src/`、`prisma/` 或关键 API 配置文件比当前 built entry（优先 `dist/apps/api/src/main.js`，兼容 `dist/main.js` 旧路径）更新时，才会重新 build
- integration / chain E2E / source E2E 文件现已统一为“每文件 seed 一次默认数据、每条测试前 reset mutable state”，减少重复 seed 与重测试启动成本
- fast-lane test support 现已新增通用 helper：
  - `apps/api/test/support/llm-test-helpers.js`
  - `apps/api/test/support/ask-assistant-test-helpers.js`
- `AskAssistantService` fast tests 的当前支撑层收口已完成到既定 helper 边界；`ask-success.test.js`、`ask-stream-service.test.js`、`ask-failures.test.js`、`ask-stream-retrieval-failure.test.js` 已复用统一依赖默认值和 assistant-record scaffolding
- `ask-success.test.js` / `ask-stream-service.test.js` 中剩余的 localized summary cases 现也已清掉外层手写 `new AskAssistantService(...)` 装配，改为复用统一 helper；当前未继续向更深层 localized payload 文本抽象，以避免为历史编码块引入高风险重写
- 当前这轮 backend test work 的目标仍是“测试支撑层提效”，重点放在减少 fast tests 中重复的 service mock 构造与默认依赖样板，不涉及业务行为调整

- trace 读取接口现在会直接返回 additive `traceSummary`，把 `answerStatus`、`qualityOverall`、`primaryIssue`、`retrievalMode`、`generationMode`、`rewriteApplied`、`fallbackReason`、`citationAttribution`、`missingInformationCount`、`insufficientContextReason`、`failedStage`、`failureMessage`、`retrievedChunkCount`、`citationCount`、`usedFallback` 从持久化 trace JSON 中归一化提取出来
- ask 失败路径现在也会把最小 `failure` 元数据写进现有 `retrievalMetadataJson`，供 trace read-model 直接提取失败阶段和失败消息
- one-shot / stream ask 在 retrieval 阶段抛错时，现在也会先创建 failed trace，再返回 `ASK_PIPELINE_FAILED`，不再只有 answering 阶段失败才能拿到 `traceId`
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
  - [README.md](../README.md)
  - [docs/current-dev-setup.md](current-dev-setup.md)
  - [docs/local-dev-infra.md](local-dev-infra.md)

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
  - RetrievalProfile `strategyJson` override 前端编辑与清空能力
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

## 5. 暂未开始方向

### 5.1 当前下一主线

- [x] 鉴权
- [x] 用户登录

说明：

- `P1: 鉴权 / 用户登录` 最小闭环已按既定范围完成（backend-first、最小 session/identity contract、web 最小登录态承载）
- 当前下一条主线为 `ACL / 文档权限`

### 5.2 暂未开始且排在后面

- [ ] ACL / 文档权限
- [ ] 多租户隔离
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
- [x] `鉴权 / 用户登录`
  - 最小 auth/login 闭环已收口（见本文件 `2026-03-29` auth 相关完成记录）
  - 当前按计划进入下一主线：`ACL / 文档权限`
- 后续自动推进时，默认继续保持严格串行执行，避免本地机器在验证阶段卡死

### 8.3 后续再往后

- ✅ 前后端联调级自动化验证
- ✅ 更完整的文档链 E2E
- ✅ 更完整的 ask 链路 E2E
- ✅ retrieval / answering 更系统化演进
- [ ] 外部知识源扩展
- [ ] 更细的移动端适配
- [ ] ACL / 多租户 / 企业化后续能力
- [ ] 企业能力

### 2026-03-29

- ✅ 后续主线文档顺序已调整为先做 `鉴权 / 用户登录`
  - `docs/next_steps_rag_project_plan.md` 现已把 `鉴权 / 用户登录` 明确为 `P1` 当前主线，`ACL / 文档权限` 作为下一条主线，external knowledge source follow-up 后移为后续独立波次
  - `docs/current-progress.md` 同步区分了“当前下一主线”和“排在后面的未开始方向”，避免继续把 auth/login 归类为“非当前主优先级”
  - 本次仅更新计划/进度文档，不改 `apps/api` / `apps/web` / `packages/shared` 实现
  - 验证：`git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md`

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

- [apps/api/src/modules/assistants/ask-assistant.service.ts](../apps/api/src/modules/assistants/ask-assistant.service.ts)
- [apps/api/src/modules/answering/answering.service.ts](../apps/api/src/modules/answering/answering.service.ts)
- [apps/api/src/modules/retrieval/retrieval.service.ts](../apps/api/src/modules/retrieval/retrieval.service.ts)
- [apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts](../apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts)
- [apps/api/src/modules/traces/traces.service.ts](../apps/api/src/modules/traces/traces.service.ts)
- [apps/api/src/infra/llm/prompt-manager.service.ts](../apps/api/src/infra/llm/prompt-manager.service.ts)
- [apps/api/src/infra/llm/llm.types.ts](../apps/api/src/infra/llm/llm.types.ts)
- [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma)
- [apps/api/prisma/migrations/20260321193000_add_answer_trace_execution_metadata/migration.sql](../apps/api/prisma/migrations/20260321193000_add_answer_trace_execution_metadata/migration.sql)
- [apps/api/test/document-chain-e2e.test.js](../apps/api/test/document-chain-e2e.test.js)
- [apps/api/test/ask-chain-e2e.test.js](../apps/api/test/ask-chain-e2e.test.js)
- [apps/api/test/web-page-source-e2e.test.js](../apps/api/test/web-page-source-e2e.test.js)
- [apps/api/test/feed-source-e2e.test.js](../apps/api/test/feed-source-e2e.test.js)
- [apps/api/test/sitemap-source-e2e.test.js](../apps/api/test/sitemap-source-e2e.test.js)
- [apps/api/test/ask-success.test.js](../apps/api/test/ask-success.test.js)
- [apps/api/test/answering.test.js](../apps/api/test/answering.test.js)
- [apps/web/src/pages/assistant/AssistantPage.tsx](../apps/web/src/pages/assistant/AssistantPage.tsx)
- [apps/web/src/pages/chat/ChatPage.tsx](../apps/web/src/pages/chat/ChatPage.tsx)
- [apps/web/src/pages/chat/chat-page-helpers.ts](../apps/web/src/pages/chat/chat-page-helpers.ts)
- [apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx](../apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx)
- [apps/web/test/chat-page-helpers.test.js](../apps/web/test/chat-page-helpers.test.js)
- [docs/superpowers/specs/2026-03-21-web-page-source-ingestion-design.md](superpowers/specs/2026-03-21-web-page-source-ingestion-design.md)
- [docs/superpowers/plans/2026-03-21-web-page-source-ingestion-plan.md](superpowers/plans/2026-03-21-web-page-source-ingestion-plan.md)
- [docs/superpowers/specs/2026-03-21-external-feed-source-ingestion-design.md](superpowers/specs/2026-03-21-external-feed-source-ingestion-design.md)
- [docs/superpowers/plans/2026-03-21-external-feed-source-ingestion-plan.md](superpowers/plans/2026-03-21-external-feed-source-ingestion-plan.md)
- [docs/superpowers/specs/2026-03-21-sitemap-source-ingestion-design.md](superpowers/specs/2026-03-21-sitemap-source-ingestion-design.md)
- [docs/superpowers/plans/2026-03-21-sitemap-source-ingestion-plan.md](superpowers/plans/2026-03-21-sitemap-source-ingestion-plan.md)
- [docs/superpowers/specs/2026-03-21-external-knowledge-source-expansion-design.md](superpowers/specs/2026-03-21-external-knowledge-source-expansion-design.md)
- [docs/superpowers/plans/2026-03-21-external-knowledge-source-expansion-plan.md](superpowers/plans/2026-03-21-external-knowledge-source-expansion-plan.md)
- [docs/superpowers/specs/2026-03-21-pc-web-chat-experience-polish-design.md](superpowers/specs/2026-03-21-pc-web-chat-experience-polish-design.md)
- [docs/superpowers/plans/2026-03-21-pc-web-chat-experience-polish-plan.md](superpowers/plans/2026-03-21-pc-web-chat-experience-polish-plan.md)
- [docs/superpowers/specs/2026-03-21-retrieval-answering-execution-metadata-design.md](superpowers/specs/2026-03-21-retrieval-answering-execution-metadata-design.md)
- [docs/superpowers/plans/2026-03-21-retrieval-answering-execution-metadata-plan.md](superpowers/plans/2026-03-21-retrieval-answering-execution-metadata-plan.md)

---

## 10.1 Web B 主题迁移补充记录

- 已继续收口 `creative-dark + workspace-app` 的 B 主题工作台壳层，当前 `Chat / Documents / Document Detail / Knowledge Base / Assistant / Traces / Trace Detail / AppShell / StatePanel` 都已统一到同一套深色 panel 语言、hero 骨架和输入控件风格。
- 本轮重点清理了前端页面遗留的中文乱码文案，未改动接口、路由、字段和页面功能逻辑。
- 基于 [ui/审查报告.md](../ui/审查报告.md) 的剩余项已完成第二轮收口：
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
  - [apps/web/src/app/AppShell.tsx](../apps/web/src/app/AppShell.tsx)
  - [apps/web/src/pages/chat/ChatPage.tsx](../apps/web/src/pages/chat/ChatPage.tsx)
  - [apps/web/src/pages/documents/DocumentsPage.tsx](../apps/web/src/pages/documents/DocumentsPage.tsx)
  - [apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx](../apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx)
  - [apps/web/src/pages/assistant/AssistantPage.tsx](../apps/web/src/pages/assistant/AssistantPage.tsx)
  - [apps/web/src/pages/documents/DocumentDetailPage.tsx](../apps/web/src/pages/documents/DocumentDetailPage.tsx)
  - [apps/web/src/pages/traces/TraceListPage.tsx](../apps/web/src/pages/traces/TraceListPage.tsx)
  - [apps/web/src/pages/traces/TraceDetailPage.tsx](../apps/web/src/pages/traces/TraceDetailPage.tsx)
  - [apps/web/src/components/StatePanel.tsx](../apps/web/src/components/StatePanel.tsx)
  - [apps/web/src/i18n/messages.ts](../apps/web/src/i18n/messages.ts)
  - [apps/web/src/styles/global.css](../apps/web/src/styles/global.css)
  - [apps/web/test/ui-review-regressions.test.js](../apps/web/test/ui-review-regressions.test.js)
- 本轮 Playwright 巡检截图目录：
  - 历史本地输出目录：`output/playwright/ui-audit-pass-9`（当前仓库未保留该目录）
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

- [README.md](../README.md)
- [docs/current-dev-setup.md](current-dev-setup.md)
- [docs/local-dev-infra.md](local-dev-infra.md)
- [docs/phase-1-rag-blueprint.md](phase-1-rag-blueprint.md)
- [docs/retrieval-trace.md](retrieval-trace.md)
- [docs/web-i18n.md](web-i18n.md)

### 12. Ingestion reliability hardening（2026-03-27）

- ✅ BullMQ worker final-failure reconciliation now closes the last retry-exhausted ingestion gap
  - `IngestionService` 现在会在 worker `failed` 事件里只对“重试已耗尽”的 job 做兜底收口：如果当前文档版本仍是本次 job 对应版本，且文档还停留在 `pending` / `processing`，就补写 `failed` 文档态与 `document_run` 失败记录
  - 文档失败回写现在使用 version+status guard 的 `updateMany`，避免在极窄并发窗口里把已 supersede 的新版本误写回 `failed`
  - 失败阶段会从当前 `processingStage` 反推：`parsing` / `chunking` / `indexing`
  - 这一轮保持为最小 ingestion reliability 收口：不改队列拓扑、不改 ingest 主链路，只补 worker 最终失败时的状态一致性兜底
  - 新增 / 更新验证：
    - `pnpm test:api:file -- test/ingestion.service.test.js`
    - `pnpm test:api:focus:documents`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm test:api:file -- test/document-chain-e2e.test.js`
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/rag_system pnpm test:api:integration`
  - 实测结果：
    - focused ingestion service tests 3/3 通过，可覆盖“重试耗尽后补写 failed”“重试未耗尽时不提前收口”以及“guard update 命中 0 行时不写 run failed”三条路径
    - focused document/ingestion 快速套件通过（`71 + 9` tests）
    - real document-chain E2E 在补齐 `DATABASE_URL` 后 2/2 通过
    - API integration suite 在补齐 `DATABASE_URL` 后 7/7 通过
