# Current Progress

> 文档角色：`current-status`
> 当前使用方式：保留最近仍有参考价值的进展摘要、当前活跃边界和 focused validation 基线；更旧的细节型流水记录不再作为默认上下文入口，按需从 git history 回看。
更新时间：2026-04-01

## Current Snapshot

- 当前默认方式仍是：单线推进、小步增量、每轮收口。
- 代码现实已明显前于旧计划表述：
  - `P3` external-source family + guardrails：开发已完成，当前只保留维护态 follow-up
  - `P5` eval / regression baseline：工程能力已完成，当前只保留基线治理和使用态 follow-up
- 因此，`P3` / `P5` 不应再被视为“下一步主开发波次”。
- 当前更合适的下一步是：
  - 先完成阶段判断与文档同步
  - 再从 `P4 web capability carry-through` 或新的明确产品波次里选一个最小增量

## Recent Landed Increments

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

- `P5 approved baseline closeout` 已完成主开发闭环
  - fixed-question eval runner、baseline snapshot / compare、quality gate、report export、approved baseline manifest、demo replay pin 都已落地
  - 当前剩余事项更偏向基线治理和使用，而不是继续补工程能力

- `P6 observability readability pass` 已完成 bounded closeout
  - Usage / Report center / Trace Detail 已完成 scan-first readability + docs sync
  - 保持边界不变：不扩成 observability platform

## Active Boundaries

- `P3` 仍允许在现有 source family 内做小型回归修补，但不再重开新的 source expansion wave。
- `P5` 仍允许在现有 eval / replay / report / quality gate 契约内做维护，但不再把它描述成当前主开发方向。
- `P6` 仍保持 scan-first readability 和 docs sync 边界，不扩成平台化重写。
- 当前真正需要推进的新增量，更适合落在：
  - `P4 web capability carry-through`
  - 或新的明确产品波次

## Focused Validation Baseline

- loop harness：`node .opencode/loop/cli.mjs --self-test`
- queue/backlog materialization：`node .opencode/loop/cli.mjs --materialize-wave <wave-id>` 或 `--materialize-append-wave <wave-id>`
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
- 当前阶段判断已经按代码现实收正：`P3` / `P5` 是已完成主开发的阶段，不再默认作为下一步主线。
- 具体下一步方向以 [docs/next_steps_rag_project_plan.md](D:\FeProjects\rag-system\docs\next_steps_rag_project_plan.md) 的更新版口径为主。
