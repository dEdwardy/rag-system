# Current Progress

> 文档角色：`current-status`
> 当前使用方式：保留最近仍有参考价值的进展摘要、当前活跃波次和 focused validation 基线；更旧的细节型流水记录不再作为默认上下文入口，按需从 git history 回看。

更新时间：2026-04-01

## Current Snapshot

- 当前默认方向仍是：单线推进、小步增量、每轮收口。
- 当前更值得继续消费的工作来源：已写入 queue/backlog 的 narrow closeout items 与 `P3 external-source guardrails` 波次。
- 当前 queue 已耗尽；`p4-source-entry-ux-followup-wave` 和 `p6-observability-readability-followup-wave` 只是历史已存在项，materialize 结果为 0，暂不强行重开旧 wave。
- 当前默认上下文入口已收瘦：先读 `docs/current-context.md`，再按需读本文件和其他长文档，避免把 append-only 进展日志默认塞进上下文。
- loop planner 默认摄入会保留本文件这份短 progress 摘要，同时用更短的 `.opencode/loop/loop-contract-brief.md` 替代全量 loop README。

## Recent Landed Increments

- `api build/start cross-environment hardening` completed a narrow Windows/WSL compatibility closeout for backend startup
  - root cause: stale incremental API build artifacts could leave mixed runtime layouts in `apps/api/dist` after environment switches, causing missing runtime modules and missing route registration (`/auth/*` 404)
  - `apps/api/package.json` now cleans build artifacts before `build`, and `start:dev` now follows the same clean-build runtime boot path as `start:prod` to avoid stale-watch output on Windows
  - `apps/api/scripts/start-prod.mjs` and `apps/api/scripts/start-dev.mjs` now resolve the built entry via `apps/api/scripts/resolve-built-api-entry.mjs` instead of assuming one fixed output layout
  - warning cleanup in the same area:
    - Prisma seed config moved from deprecated `package.json#prisma` to `apps/api/prisma.config.ts`
    - build finalize now writes `apps/api/dist/packages/shared/package.json` with `"type": "module"` to remove Node runtime reparsing warnings for emitted shared files
  - focused validation:
    - `node --test apps/api/test/resolve-built-api-entry.test.js`
    - `pnpm --filter @rag-system/api build`
    - `pnpm --filter @rag-system/api start:prod`
    - `pnpm --filter @rag-system/api start:dev`
    - `GET /health` + `GET /auth/providers` + `GET /auth/me` on the restarted API

- ✅ `fix-typescript-errors-and-warnings` completed TypeScript error/warning cleanup and PR #11 merge
  - 修复了 `sitemap-source.service.ts` 类型问题（`contentTypeFallbackApplied`/`upstreamContentType` 可选化 + 类型断言）
  - 修复了 `document-ingestion.processor.ts` 类型问题（所有 `createErrorDiagnostics()`/直接对象字面量的 `IngestionDiagnostics` 类型断言）
  - 修复了 `ask-success.test.js` 测试期望（新增 `documentVersions`/`role` 字段）
  - 移除了 `ReportCenterPage.tsx` 未使用的 recharts 导入
  - 添加了 `ErrorCode.INGESTION_STATE_WRITE_FAILED` 以保持不同错误类型的 distinct code（响应 Codex P2 review）
  - 创建了 `docs/project-full-status-review.md` 综合项目状态审查文档
  - focused validation：`pnpm typecheck`（所有包通过）+ `pnpm test:api:file -- test/ask-success.test.js` + `pnpm test:api:file -- test/fetch-with-retry.test.js` + `pnpm test:api:file -- test/external-source-sync.test.js`

- ✅ `p5-approved-baseline-queue-refresh` recorded closeout bookkeeping as completed
  - `.opencode/loop/execution-backlog.jsonc` and `.opencode/loop/queue.json` now reflect `p5-approved-baseline-closeout` wave/task statuses as completed（`p5-baseline-approval-doc-sync`、`p5-replay-baseline-contract-closeout`、`p5-approved-baseline-queue-refresh`）
  - 保持边界不变：仅 queue/backlog bookkeeping 收口，不新增 benchmark 或 demo-platform 方向
  - focused validation：`git diff --check -- .opencode/loop/execution-backlog.jsonc .opencode/loop/queue.json docs/current-progress.md`

- ✅ `p5-replay-baseline-contract-closeout` kept replay contract surface narrow and explicit
  - `apps/api/scripts/run-p5-v1-eval-runner.mjs` help text now directly states the pinned contract path：`manifest.runnerReplayBinding -> shortlist approvedSet/selected checks -> POST /eval/question-sets/demo-replays/p5-v1/run`
  - 边界保持不变：不引入新的 eval framework / demo 平台 / report-center 重写
  - focused validation：`pnpm --filter @rag-system/api eval:runner:p5-v1 --help`

- ✅ `p5-baseline-approval-doc-sync` kept approved baseline v1 docs aligned (narrow scope)
  - `docs/current-dev-setup.md` and this progress doc both keep `apps/api/scripts/p5-baseline-manifest.v1.json` as the approved engineering baseline v1 source of truth（含 3 题 question set、`p5-v1-demo-replay.questions.v1` dataset pin、annotation layering、`p5-demo-shortlist-4plus1` 4+1 shortlist）
  - 边界保持不变：不重开 benchmark framework 设计、不扩 demo 平台、不改现有 runner/report/gate 契约
  - focused validation：`git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md docs/current-dev-setup.md .opencode/loop/execution-backlog.jsonc`

- ✅ opencode loop token-cost guardrails tightened
  - 默认 planner auto-refill 恢复为 queue-drain 时的一轮 guarded refill，确保推荐方向能自然延续成下一波 queue
  - 相邻相关 item 现在可保守复用 session
  - verifier replan prompt 改为 delta prompt
  - planner/materializer 生成 sibling items 会自动带 `sessionAffinityKey`
  - focused validation：`node .opencode/loop/cli.mjs --self-test`

- ✅ `p3-source-policy-baseline` closed as a narrow policy/docs sync
  - 保持 external-source baseline 边界不变：public / no-login / no-paywall only；不做 access-control bypass
  - focused validation：`git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md docs/current-dev-setup.md .opencode/loop/execution-backlog.jsonc`

- ✅ `p3-external-source-guardrails` wave closed within existing source-family boundary
  - legality/courtesy baseline is now explicit in project docs：public/no-login/no-paywall only；no access-control bypass；`sitemap/sitemapindex` is URL index (not authorization grant)；rights-to-use stays user-side
  - existing source fetch path remains narrow and low-disturbance: robots/domain checks + crawl budget pacing + source throttle/breaker
  - external reindex keeps incremental-first behavior: skip duplicate in-flight resync and skip immediate repeat broad refresh for recently updated external docs
  - focused validation：
    - `git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md docs/current-dev-setup.md .opencode/loop/execution-backlog.jsonc .opencode/loop/queue.json`
    - `pnpm --filter @rag-system/api test:file -- test/external-source-sync.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/fetch-with-retry.test.js`

- ✅ `p3-external-source-guardrail-wave` split and queued
  - 现已拆出 policy baseline / robots-domain guard / crawl budget / throttle breaker / incremental resync bias 等子项
  - focused validation：`node .opencode/loop/cli.mjs --materialize-append-wave p3-external-source-guardrail-wave`

- ✅ external-source resync diagnostics coverage expanded narrowly
  - web page partial-diagnostics path 现在与 feed / sitemap cases 一起被 focused test 锁住
  - focused validation：`pnpm --filter @rag-system/api exec vitest run --maxWorkers=1 test/external-source-sync.test.js -t "reused web page source returns partial results"`

- ✅ P6 observability readability pass stayed explicitly bounded
  - Usage / Report center / Trace Detail 继续只做 scan-first readability 和 docs sync，不扩成新 observability platform
  - focused validation：
    - `node --test --test-name-pattern "usage page" apps/web/test/ui-review-regressions.test.js`
    - `node --test --test-name-pattern "report center" apps/web/test/ui-review-regressions.test.js`
    - `node --test --test-name-pattern "trace detail" apps/web/test/ui-review-regressions.test.js`

- ✅ `p3-source-followup-docs-sync` completed external source follow-up docs and validation baseline sync
  - 已同步 P3 follow-up 边界、验证方式、未做项到项目文档
  - 保持现有 source family 边界不变：`web page`、`feed (RSS/Atom)`、`sitemap/urlset`、`sitemapindex(一层)`
  - 明确后置项：新 source family 扩展、web page JS 渲染抓取能力、跨 source family 的全面错误码体系重构、source 平台化/插件化重构
  - focused validation：`git diff --check -- docs/next_steps_rag_project_plan.md docs/current-progress.md docs/current-dev-setup.md`

- ✅ `p6-observability-readability-pass` completed observability readability improvements
  - Usage / Report center / Trace Detail 已完成 scan-first readability 和 docs sync
  - 保持边界不变：不扩成新 observability platform
  - 已同步观测性相关文档和最小复用验证清单
  - focused validation：
    - `node --test --test-name-pattern "usage page" apps/web/test/ui-review-regressions.test.js`
    - `node --test --test-name-pattern "report center" apps/web/test/ui-review-regressions.test.js`
    - `node --test --test-name-pattern "trace detail" apps/web/test/ui-review-regressions.test.js`
    - `node --test --test-name-pattern "document run" apps/web/test/document-run-observability.test.js`

## Active Boundaries

- external-source 仍限定在既有 `web page` / `feed` / `sitemap` / `sitemap index` 范围内的小步 guardrail 收口。
- P3 follow-up 边界继续保持在同一 source family 的稳定性补强（diagnostics/retry-resync/readability 一致性）；不重开 source expansion、connector 平台化或无关波次。
- P6 观测性边界继续保持在 scan-first readability 和 docs sync；不扩成新 observability platform。
- loop harness 仍是本地辅助开发工具，不是产品 runtime；优先做小而可回退的 token / queue / verifier 优化，不展开新 orchestration 架构。
- docs、queue、progress、backlog 的同步继续保持同一波次内最小收口，不把 bookkeeping 扩成独立产品方向。

## Focused Validation Baseline

- loop harness：`node .opencode/loop/cli.mjs --self-test`
- queue/backlog materialization：`node .opencode/loop/cli.mjs --materialize-wave <wave-id>` 或 `--materialize-append-wave <wave-id>`
- API focused test：`pnpm test:api:file -- test/<file>.test.js`
- web focused test：`node --test --test-name-pattern "<name>" apps/web/test/<file>.test.js`
- docs / queue sync：`git diff --check -- <files...>`
- P3 source follow-up（guardrail 后沿用）：`pnpm test:api:file -- test/external-source-sync.test.js` + `pnpm test:api:file -- test/fetch-with-retry.test.js` + `pnpm test:api:file -- test/parsing.test.js`
- P6 观测性（guardrail 后沿用）：`pnpm test:api:file -- test/traces.service.test.js` + `pnpm test:api:file -- test/ask-success.test.js` + `node --test apps/web/test/trace-summary-contract.test.js` + `node --test --test-name-pattern "document run" apps/web/test/document-run-observability.test.js`

## P3 External Source Follow-up 最小复用验证清单

- 运行前提：在仓库根目录执行，且 API 测试环境依赖可用（沿用当前 dev setup）
- 验证命令：
  1. `pnpm test:api:file -- test/external-source-sync.test.js`
  2. `pnpm test:api:file -- test/fetch-with-retry.test.js`
  3. `pnpm test:api:file -- test/parsing.test.js`
- 回归确认口径：
  - 三条命令全部通过，视为现有 source family 的 re-sync recovery、source fetch diagnostics、source parsing/dedup baseline 仍稳定
  - 若失败，先按失败文件回到对应 source follow-up 子路径修复，再重跑同一组命令，不直接升级到重型全量测试

## P6 观测性（Observability）最小复用验证清单

- 运行前提：在仓库根目录执行，且 API 测试环境依赖可用（沿用当前 dev setup）
- 验证命令：
  1. `pnpm test:api:file -- test/traces.service.test.js`
  2. `pnpm test:api:file -- test/ask-success.test.js`
  3. `node --test apps/web/test/trace-summary-contract.test.js`
  4. `node --test --test-name-pattern "document run" apps/web/test/document-run-observability.test.js`
- 回归确认口径：
  - 四条命令全部通过，视为观测性相关功能（trace summary、document run observability、ask response metadata）仍稳定
  - 若失败，先按失败文件回到对应观测性子路径修复，再重跑同一组命令，不直接升级到重型全量测试

## Notes

- 本文件已从 append-only 长日志收瘦为当前摘要；更早的详细完成记录请按需使用 git history 回看。
- 当前阶段的优先级与不做事项仍以 `docs/next_steps_rag_project_plan.md` 为主。
