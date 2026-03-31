# Current Progress

> 文档角色：`current-status`
> 当前使用方式：保留最近仍有参考价值的进展摘要、当前活跃波次和 focused validation 基线；更旧的细节型流水记录不再作为默认上下文入口，按需从 git history 回看。

更新时间：2026-03-31

## Current Snapshot

- 当前默认方向仍是：单线推进、小步增量、每轮收口。
- 当前更值得继续消费的工作来源：已写入 queue/backlog 的 narrow closeout items 与 `P3 external-source guardrails` 波次。
- 当前 queue 已耗尽；`p4-source-entry-ux-followup-wave` 和 `p6-observability-readability-followup-wave` 只是历史已存在项，materialize 结果为 0，暂不强行重开旧 wave。
- 当前默认上下文入口已收瘦：先读 `docs/current-context.md`，再按需读本文件和其他长文档，避免把 append-only 进展日志默认塞进上下文。
- loop planner 默认摄入会保留本文件这份短 progress 摘要，同时用更短的 `.opencode/loop/loop-contract-brief.md` 替代全量 loop README。

## Recent Landed Increments

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

## Active Boundaries

- external-source 仍限定在既有 `web page` / `feed` / `sitemap` / `sitemap index` 范围内的小步 guardrail 收口。
- P3 follow-up 边界继续保持在同一 source family 的稳定性补强（diagnostics/retry-resync/readability 一致性）；不重开 source expansion、connector 平台化或无关波次。
- loop harness 仍是本地辅助开发工具，不是产品 runtime；优先做小而可回退的 token / queue / verifier 优化，不展开新 orchestration 架构。
- docs、queue、progress、backlog 的同步继续保持同一波次内最小收口，不把 bookkeeping 扩成独立产品方向。

## Focused Validation Baseline

- loop harness：`node .opencode/loop/cli.mjs --self-test`
- queue/backlog materialization：`node .opencode/loop/cli.mjs --materialize-wave <wave-id>` 或 `--materialize-append-wave <wave-id>`
- API focused test：`pnpm test:api:file -- test/<file>.test.js`
- web focused test：`node --test --test-name-pattern "<name>" apps/web/test/<file>.test.js`
- docs / queue sync：`git diff --check -- <files...>`
- P3 source follow-up（guardrail 后沿用）：`pnpm test:api:file -- test/external-source-sync.test.js` + `pnpm test:api:file -- test/fetch-with-retry.test.js` + `pnpm test:api:file -- test/parsing.test.js`

## Notes

- 本文件已从 append-only 长日志收瘦为当前摘要；更早的详细完成记录请按需使用 git history 回看。
- 当前阶段的优先级与不做事项仍以 `docs/next_steps_rag_project_plan.md` 为主。
