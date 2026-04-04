# Current Progress

> 文档角色：`current-status`
> 当前使用方式：保留最近仍有参考价值的进展摘要、当前活跃边界和 focused validation 基线；更旧的细节型流水记录不再作为默认上下文入口，按需从 git history 回看。
更新时间：2026-04-04

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
  - `apps/api/package.json` 现在在 `build` 前稳定清理构建产物，`start:dev` 和 `start:prod` 共享 clean-build runtime boot path
  - `apps/api/scripts/start-dev.mjs`、`apps/api/scripts/start-prod.mjs` 现在都通过 `apps/api/scripts/resolve-built-api-entry.mjs` 解析实际 built entry
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
