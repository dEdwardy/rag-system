# Current Progress

> 文档角色：`current-status`
> 当前使用方式：保留最近仍有参考价值的进展摘要、当前活跃边界和 focused validation 基线；更旧的细节型流水记录不再作为默认上下文入口，按需从 git history 回看。
更新时间：2026-04-05

## Current Snapshot

- 当前默认方式仍是：单线推进、小步增量、每轮收口。
- 代码现实已明显前于旧计划表述：
  - `P3` external-source family + guardrails：开发已完成，当前只保留维护态 follow-up
  - `P4` 当前这一轮 web capability carry-through：收口已完成，当前只保留 bounded follow-up
  - `P5` eval / regression baseline：工程能力已完成，当前只保留基线治理和使用态 follow-up
- 因此，`P3` / 当前这轮 `P4` / `P5` 不应再被视为“下一步主开发波次”。
- 当前更合适的下一步是：
  - 在已完成区域内继续做 bounded maintenance
  - 或从新的明确产品波次里选一个最小增量

## Recent Landed Increments

- `RAG retrieval/answering quality baseline refresh` 完成了一轮以稳定性为目标的收口，并形成了当前可复用基线
  - retrieval 默认配置已调整到更适合轻多跳和总结场景的组合：`topK` 提升、`chunkWindow=1`、`hybrid=ON`
  - `apps/api/src/modules/retrieval/retrieval.service.ts` 已补充 retrieval diversity 选择，减少 topK 被同一 section 的相似 chunk 占满
  - `apps/api/src/modules/answering/answering.service.ts` 已补充 `coverageSummary`，用于标记 summary/list 问题中“检到了但没写出来”的 coverage gap
  - `apps/api/src/infra/llm/prompt-manager.service.ts` 已强化 summary prompt，要求优先覆盖并列主项
  - `summaryMainItems` 两步实验已完成对照验证，但本轮明确不默认上线；实验开关保持关闭，避免把子项/示例误抬成主项
  - 本轮质量结论：
    - Fact：稳定可用
    - 2 步以内轻多跳：稳定可用
    - Summary / List：多数可用，但仍存在少量并列主项漏项 / 误归类边界
  - 后续维护约束：
    - 将当前 5 题及其同类题固定为回归评测集
    - 为 summary/list 场景单独跟踪“漏主项率”和“错误归类率”
  - focused validation:
    - `pnpm --filter @rag-system/api typecheck`
    - `pnpm --filter @rag-system/api build`
    - `pnpm --filter @rag-system/api test:file -- test/answering.test.js`

- `chat conversation UX` 又补了一轮很小的会话体验优化
  - `apps/web/src/pages/chat/ChatWorkspacePanels.tsx` 把会话重命名 / 删除收进了单个轻量菜单，减少了列表项里的视觉噪音
  - `apps/web/src/pages/chat/ChatPage.tsx` 在删除当前会话后会自动切到下一个可用会话，避免空白停留
  - focused validation:
    - `pnpm --filter @rag-system/api typecheck`
    - `pnpm --filter @rag-system/web typecheck`

- `chat conversation CRUD` 这次补齐了用户端会话管理的最小闭环
  - `apps/api/src/modules/conversations/conversations.controller.ts` 新增了 `PATCH /conversations/:id` 和 `DELETE /conversations/:id`
  - `apps/api/src/modules/conversations/conversations.service.ts` 现在支持会话重命名和归档式删除，并且会话列表只展示 `active` 会话
  - `apps/web/src/pages/chat/ChatWorkspacePanels.tsx` / `apps/web/src/pages/chat/ChatPage.tsx` 新增了会话重命名和删除入口
  - `apps/web/src/features/api/hooks.ts` 新增了会话更新和删除 mutation
  - `apps/web/src/i18n/messages.en.ts` / `apps/web/src/i18n/messages.zh.ts` 补了对应文案
  - focused validation:
    - `pnpm --filter @rag-system/api typecheck`
    - `pnpm --filter @rag-system/web typecheck`

- `api best-practices hardening wave` 已完成一轮窄范围后端维护收口
  - `apps/api/src/modules/assistants/assistants.controller.ts` 现在会在 `ask/stream` 首字节发出前保留正常 HTTP 失败语义；只有流真正开始后，才回落到 NDJSON `error` event 诊断，避免把 `404/5xx` 预流式失败吞成 `200`
  - `apps/api/src/common/http-exception.filter.ts` 提取了统一异常响应构建逻辑，streaming controller 可在 pre-stream 阶段复用现有错误 JSON 结构，而不是单独拼装返回体
  - `apps/api/src/modules/auth/auth.service.ts` 已把 OAuth 回调后的本地持久化阶段收敛到单个事务：身份链接、用户创建/复用、默认 workspace 初始化、session 创建同属一个写入边界
  - `apps/api/src/modules/auth/auth.controller.ts`、`auth.module.ts`、`auth-rate-limit.guard.ts` 为公开 auth 路由补了基于路由 metadata 的限流保护，当前覆盖 `login`、OAuth start、OAuth callback
  - `apps/api/src/modules/auth/auth-runtime-config.ts`、`apps/api/src/infra/env/api-runtime-config.ts` 与 `apps/api/src/infra/queue/queue-runtime-config.ts` 收敛了 auth / bootstrap / queue 的运行时配置读取，减少散落的 `process.env` 分支
  - 后续遗留项也已按 `Zod-first` 方向补齐一个窄范围增量：新增通用 `ZodValidationPipe`，并把多组 controller 的 `@Body()` / `@Query()` 手动 `schema.parse(...)` 提升到 Nest pipe 层；对当前仓库以 `cuid` 为主的 `id` 路由参数补的是 `trim + non-empty string` 参数 pipe，而不是误用 `ParseUUIDPipe`
  - 当前约束同步收敛为：继续保留 `Zod` 作为单一 schema/type source，通过 `ZodValidationPipe` 承接 `@Body()` / `@Query()` 校验，并按仓库实际主键形态为路由参数补合适的参数 pipe；不为了类型安全切回 `class-validator` / `class-transformer` DTO 栈
  - focused validation:
    - `pnpm --filter @rag-system/api typecheck`
    - `pnpm --filter @rag-system/api test:file -- test/auth-provider-boundary.test.js test/ask-stream-controller.test.js test/http-exception-filter.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/zod-validation-pipe.test.js test/auth-provider-boundary.test.js test/ask-stream-controller.test.js test/http-exception-filter.test.js test/kb-document-access.test.js test/knowledge-bases-auth-write-path.test.js test/retrieval-profiles-auth-scope.test.js test/eval-question-sets.service.test.js`

- `web local bootstrap performance guardrail` narrowed two first-load regressions in the current maintenance wave
  - `apps/web/src/lib/api.ts` now prefers the existing Vite `/api` same-origin proxy during local dev unless `VITE_API_BASE_URL` is explicitly set, removing avoidable browser CORS preflight overhead from the normal `5173 -> 3000` path
  - `apps/web/src/app/AuthenticatedAppShell.tsx` no longer returns a blank screen while `GET /auth/me` is pending; the app now renders a lightweight loading shell immediately so first paint is not blocked on auth bootstrap visibility
  - `apps/web/src/app/AppShell.tsx` now defers non-critical sidebar metrics (`documents` / `conversations` badges) until browser idle time instead of requesting them during the first shell bootstrap on every route
  - `apps/web/src/i18n/messages.ts` is now split into `messages.en.ts` and `messages.zh.ts`, `apps/web/src/main.tsx` boots with only the active locale catalog, and `apps/web/src/i18n/I18nProvider.tsx` lazy-loads the other locale on demand; the production build now emits separate locale chunks and reduces the main `index` bundle from the earlier ~`462 KB` snapshot to ~`408 KB`
  - `apps/web/src/app/router.tsx` now lazy-loads the authenticated root route too, so `AuthenticatedAppShell` / `AppShell` no longer ride inside the entry bundle; the production build now emits a dedicated `AuthenticatedAppShell-*` chunk and further reduces the main `index` bundle from ~`408 KB` to ~`350 KB`
  - `apps/web/src/app/App.tsx` now lazy-loads `AppRouter`, moving `RouterProvider` and the router definition out of the entry bundle; the production build now emits a dedicated `AppRouter-*` chunk and further reduces the main `index` bundle from ~`350 KB` to ~`255 KB`
  - `apps/web/src/pages/reports/ReportCenterPage.tsx` now lazy-loads a dedicated `ReportCharts` submodule, so `recharts` is no longer bundled into the main report page chunk; the production build now reduces `ReportCenterPage-*` from ~`439 KB` to ~`71 KB` and emits a separate `ReportCharts-*` chunk for chart-heavy diagnostics
  - `apps/web/src/pages/assistant/AssistantPage.tsx` now lazy-loads `AssistantSettingsForm`, moving `@mantine/form` and the full answer-settings form body out of the page shell; the production build now reduces `AssistantPage-*` from ~`69 KB` to ~`12 KB` and emits a separate `AssistantSettingsForm-*` chunk for the heavy settings UI
  - `apps/web/src/pages/usage/UsagePage.tsx` now lazy-loads `UsageHealthBoard`, moving the large operations-health JSX block out of the page shell; the production build now reduces `UsagePage-*` from ~`41 KB` to ~`24 KB` and emits a separate `UsageHealthBoard-*` chunk for the deeper operational panels
  - `apps/web/src/pages/chat/ChatPage.tsx` now lazy-loads `ChatWorkspacePanels`, moving the secondary history / citations workspace out of the primary chat page shell; the production build now reduces `ChatPage-*` from ~`36.6 KB` to ~`32.6 KB` and emits a separate `ChatWorkspacePanels-*` chunk for the sidebar workflow
  - `apps/web/src/pages/traces/TraceDetailPage.tsx` now lazy-loads `TraceDetailSupportPanels`, moving metadata / quick jumps / query comparison plus citations / raw payload out of the primary trace review path; the production build now reduces `TraceDetailPage-*` from ~`34.7 KB` to ~`30.6 KB` and emits a separate `TraceDetailSupportPanels-*` chunk for the auxiliary diagnostics workflow
  - `apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx` now lazy-loads `KnowledgeBaseActivityPanel`, moving the recent activity summary, expandable run filters, and run list workflow out of the primary workspace snapshot shell; the production build now reduces `KnowledgeBasePage-*` from ~`25.4 KB` to ~`16.0 KB` and emits separate `KnowledgeBaseActivityPanel-*` and slimmed `DocumentRunList-*` chunks for the deeper maintenance workflow
  - `apps/web/src/pages/documents/DocumentsPage.tsx` now lazy-loads `DocumentsSourceEntryPanel`, moving the web/feed/sitemap source-entry forms and related mutation state out of the primary library snapshot and table shell; the production build now reduces `DocumentsPage-*` from ~`18.5 KB` to ~`14.6 KB` and emits a separate `DocumentsSourceEntryPanel-*` chunk for that secondary source-ingestion workflow
  - `apps/web/src/pages/documents/DocumentDetailPage.tsx` now lazy-loads `DocumentDetailChunksPanel`, moving the chunk query, trace-focused chunk review flow, and metadata payload rendering out of the primary document status shell; the production build now reduces `DocumentDetailPage-*` from ~`15.4 KB` to ~`10.8 KB` and emits a separate `DocumentDetailChunksPanel-*` chunk for the deeper chunk-inspection workflow
  - `apps/web/src/pages/reports/ReportCenterPage.tsx` now lazy-loads `ReportResultsTable`, moving the large sortable/filterable run-item table and its review controls out of the primary report summary shell; the production build now reduces `ReportCenterPage-*` from ~`71.0 KB` to ~`64.9 KB` and emits a separate `ReportResultsTable-*` chunk for the detailed item-review workflow
  - `apps/web/src/pages/reports/ReportCenterPage.tsx` now also lazy-loads `ReportAnalysisPanels`, moving the quality-distribution, gate, diff, regression-weakest-items, run-context, and export panels out of the primary report shell; the production build now further reduces `ReportCenterPage-*` from ~`64.9 KB` to ~`53.9 KB` and emits a separate `ReportAnalysisPanels-*` chunk for the deeper analysis workflow
  - focused validation:
    - `pnpm --filter @rag-system/web build`

- `opencode loop sequential executor` now consumes the active materialized queue in order
  - root `pnpm loop:start|stop|status` now uses the repo-local Node harness under `.opencode/loop/harness/`
  - the runner selects the next runnable pending queue item, reuses the same OpenCode session across a compact wave when possible, runs queue items through the repo `build` command, and stops on failure / replan so the queue does not drift ahead of the checkout
  - this is harness/workflow plumbing only; it does not expand product scope or queue planning scope

- `docs / stage alignment refresh` 已完成当前阶段文档同步
  - `current-context`、`next_steps_rag_project_plan`、`project-status-overview` 现已统一采用同一阶段判断：
    - `P0/P1/P2` 已完成
    - `P3/P5/P6` 已完成主开发并进入维护/治理边界
    - `P4` 是当前最合理的下一条产品收口主线
  - 文档现已补充明确执行顺序：先做 docs 对齐，再做 `P4 Documents / Knowledge Base` 收口，然后是 `Document Detail / Usage / Trace`、`Report center / eval` 和 focused regression
  - 这轮同步只做阶段口径、优先级和执行顺序收正，不引入新的 backend roadmap

- `api build/start cross-environment hardening` 完成了 Windows / WSL 切换下的 narrow backend startup closeout
  - 根因是 API 旧构建产物和增量状态残留会造成 `apps/api/dist` 混合布局，进一步导致运行时模块缺失和 `/auth/*` 路由未注册
  - `apps/api/package.json` 现在在 `build` 前稳定清理构建产物，`start:prod` 继续使用 clean-build runtime boot path
  - `apps/api/scripts/start-dev.mjs` 已重新收回真正的 watch/dev 语义：启动前清理旧构建产物并执行 `prisma generate`，然后进入 `tsx watch src/main.ts`
  - 同区域 warning cleanup 已完成：
    - Prisma seed 配置从废弃的 `package.json#prisma` 迁到 `apps/api/prisma.config.ts`
    - build finalize 会给 `apps/api/dist/packages/shared/package.json` 写入 `"type": "module"`，去掉 Node runtime reparsing warning
  - focused validation：
    - `node --test apps/api/test/resolve-built-api-entry.test.js`
    - `pnpm --filter @rag-system/api build`
    - `pnpm --filter @rag-system/api start:prod`
    - `pnpm --filter @rag-system/api start:dev`
    - `GET /health` + `GET /auth/providers` + `GET /auth/me`

- `fix-typescript-errors-and-warnings` 完成了 TypeScript error/warning cleanup 并已 merge 为 PR #11
  - 修复了 `sitemap-source.service.ts` 和 `document-ingestion.processor.ts` 的类型问题
  - 修复了 `ask-success.test.js` 的接口期望同步
  - 移除了 `ReportCenterPage.tsx` 的未使用导入
  - 添加了 `ErrorCode.INGESTION_STATE_WRITE_FAILED`
  - 补充了 `docs/project-full-status-review.md`
  - focused validation：
    - `pnpm typecheck`
    - `pnpm test:api:file -- test/ask-success.test.js`
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
    - `pnpm test:api:file -- test/external-source-sync.test.js`

- `P3 external-source guardrails` 已完成主开发闭环
  - 现有 source family 维持为 `web page` / `feed` / `sitemap` / `sitemap index`
  - legality / courtesy / retry / timeout / incremental resync / one-level sitemap index 边界都已落地到代码和 focused tests
  - 当前只保留同一家族内的小型维护位，不再把 `P3` 当成主开发主线

- `P4 DocumentsPage source-entry carry-through` 已完成基础承接
  - web 侧已具备 `web page` / `feed` / `sitemap` 三类 URL 入口
  - 当前这轮 `P4` 收口已完成；后续若继续改动，更适合作为 bounded maintenance，而不是把入口承接继续记为待开发
  - 本轮已补一个小范围收口：`DocumentsPage` 在无 active knowledge base 时不再对文档列表和 source-entry 走隐式 `default-kb` 兜底，而是切到显式空态与引导动作
  - 当前 source-entry 收口口径：三类 URL 入口都带有前端 `http/https` 校验、提交中忙态与提交成功后的行内状态反馈；focused web regression 已补齐并锁定这组行为
  - 当前 source-entry 进一步统一为单一路径：字段错误只保留一处主状态表达，`busy` / `empty` / `no-active-kb` / `success` 在 `web page` / `feed` / `sitemap` 三个入口下保持一致，且页头不再把无 active knowledge base 误显示为 `Default KB`

- `P5 approved baseline closeout` 已完成主开发闭环
  - fixed-question eval runner、baseline snapshot / compare、quality gate、report export、approved baseline manifest、demo replay pin 都已落地
  - 当前剩余事项更偏向基线治理和使用，而不是继续补工程能力

- `P5 quality governance usage loop` 已完成一轮前端使用态收口
  - `ReportCenterPage` 已从只读结果页推进到可操作的质量治理工作台：
    - 优先复盘题目 / Top 3 issues
    - review progress、本地 reviewed / pending 状态
    - 本地结论分类（检索 / 引用 / 回答 / 暂不处理）
    - 结论分布驱动的 current improvement focus
    - focus-specific troubleshooting path、第一条相关 diagnostics 跳转
    - quality gate 的 pass / warn / fail 治理提示
    - report-to-trace carry-through context
    - 本地复盘记录、改后复查建议、复制/导出本地复盘摘要
  - `TraceDetailPage` 已补 report-driven 首屏复盘顺序和来自质量报告的上下文提示，减少从报告进入后的重新定向成本
  - `DocumentDetailPage` 已补 focused chunk 的首屏检查顺序，明确先看 chunk 内容、再看命中依据、最后回诊断判断问题归因
  - `AssistantPage` 已补稳定锚点与来自质量报告的回流提示，使 `质量报告 -> 回答设置 -> 回质量报告` 成为明确路径
  - 边界保持不变：以上全部为前端本地治理层，不新增 backend review/persistence contract

- `normal-user readiness loop` 已完成一轮前端收口
  - `Library / Workspace settings / Chat` 现已统一为同一套 readiness 判断和下一步动作模型
  - `Chat` 首屏 onboarding 明确收敛到三步：添加资料 -> 确认回答设置 -> 开始聊天
  - `资料库 -> 回答设置 -> 对话` 的完成路径已补齐，ready 态不再误导到 diagnostics 或回设置页

- `P6 observability readability pass` 已完成 bounded closeout
  - Usage / Report center / Trace Detail 已完成 scan-first readability + docs sync
  - 保持边界不变：不扩成 observability platform

## Runtime Validation Addendum

- `P4 regression hardening wave` 已完成 web 页面逻辑提取和测试准备
  - `DocumentsPage` 的 URL 验证逻辑提取到 `documents-page-helpers.ts`
  - `ReportCenterPage` 的 eval URL 参数归一区、字段标签、回归原因标签提取到 `report-center-page-helpers.ts`
  - `TraceDetailPage` 的失败分类、标签、颜色、链接构建提取到 `trace-detail-page-helpers.ts`
  - `UsagePage` 的健康信号、告警项、跳转目标提取到 `usage-page-helpers.ts`
  - 所有提取保持现有 UI 行为，启用 focused regression testing，构建验证通过

## Active Boundaries

- `P3` 仍允许在现有 source family 内做小型回归修补，但不再重开新的 source expansion wave。
- `P5` 仍允许在现有 eval / replay / report / quality gate 契约内做维护，但不再把它描述成当前主开发方向。
- `P6` 仍保持 scan-first readability 和 docs sync 边界，不扩成平台化重写。
- 当前这轮 `P4` 只保留已完成页面收口范围内的小型 follow-up，不再把它写回默认主线。
- 当前真正需要推进的新增量，更适合落在：
  - 新的明确产品波次
  - 或已完成区域内的 bounded maintenance

## Next Execution Order

1. bounded maintenance in completed areas
2. keep docs and stage judgment fresh
3. choose the next single product increment before opening a new wave

## Focused Validation Baseline

- API focused test：`pnpm test:api:file -- test/<file>.test.js`
- web focused test：`node --test --test-name-pattern "<name>" apps/web/test/<file>.test.js`
- docs / queue sync：`git diff --check -- <files...>`
- current source-family maintenance baseline：
  - `pnpm test:api:file -- test/external-source-sync.test.js`
  - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - `pnpm test:api:file -- test/parsing.test.js`
- current observability baseline：
  - `pnpm test:api:file -- test/traces.service.test.js`
  - `pnpm test:api:file -- test/ask-success.test.js`
  - `node --test apps/web/test/trace-summary-contract.test.js`
  - `node --test --test-name-pattern "document run" apps/web/test/document-run-observability.test.js`

## Notes

- 本文件已从 append-only 长日志收瘦为当前摘要；更早的详细完成记录请按需从 git history 回看。
- 当前阶段判断已经按代码现实收正：`P3` / 当前这轮 `P4` / `P5` 是已完成主开发或收口的阶段，不再默认作为下一步主线。
- 具体下一步方向以 [docs/next_steps_rag_project_plan.md](D:\FeProjects\rag-system\docs\next_steps_rag_project_plan.md) 的更新版口径为主。
- API review 的输入校验 follow-up 已继续推进一小步：当前 controller 侧 `@Body()` / `@Query()` 已开始迁移到 `ZodValidationPipe`，路由参数按仓库主键实际形态补的是非空字符串参数 pipe；仍不为了“全局验证”或类型安全把现有校验体系整体切到 `class-validator` / `class-transformer` DTO 栈。

## Recent React 19 UX Pass

- `apps/web` completed a small React 19 user-experience pass focused on the highest-traffic flows, without changing backend contracts.
  - `ChatPage` conversation rename/delete now uses optimistic UI updates.
  - `UsagePage`, `ReportCenterPage`, and `TraceListPage` now defer heavy list recomputation and transitions so selection changes feel more responsive.
  - `LoginPage`, `InviteGatePage`, and `AssistantSettingsForm` now use more consistent pending feedback and input blocking during submission / save.
  - focused validation:
    - `pnpm --filter @rag-system/web typecheck`
    - `git diff --check -- apps/web/src/pages/chat/ChatPage.tsx apps/web/src/pages/usage/UsagePage.tsx apps/web/src/pages/reports/ReportCenterPage.tsx apps/web/src/pages/traces/TraceListPage.tsx apps/web/src/pages/auth/LoginPage.tsx apps/web/src/pages/auth/InviteGatePage.tsx apps/web/src/pages/assistant/AssistantSettingsForm.tsx`
