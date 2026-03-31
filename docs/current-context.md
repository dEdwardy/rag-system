# Current Context

> 文档角色：`current-context`
> 当前使用方式：默认给人和 agent 提供短摘要；只保留当前主线、硬边界、最小验证和高频入口，详细历史与长说明按需再读其他文档。

更新时间：2026-03-31

## Current Mainline

- 当前默认工作方式：单线推进、小步增量、每轮收口，不并行展开多个大方向。
- 当前更合适的下一批增量：继续围绕已排入 queue/backlog 的窄范围 closeout 和 external-source guardrail 波次推进，不扩成新的产品波次。

## Current Priorities

- `P3 external-source guardrails`：继续保持 legality / crawl-safety / incremental resync 范围内的小步收口。
- `queue-driven closeout`：优先消费已拆好的 queue-ready 小任务，保持实现、验证、文档同步一起收口。
- `loop harness cost control`：默认关闭 planner auto-refill，优先用 session reuse 和 delta replan 控制 token 成本。

## Do Not Do

- 不同时开启多个大方向，不把当前波次扩成并行 feature wave。
- 不做 broad refactor、架构重写、schema / persistence 大改。
- 不把局部 docs / queue / observability / source-entry closeout 扩成新的平台化 redesign。
- 不在没有明确收益时改 retrieval 语义、默认策略开关或模型分工。

## Validation Baseline

- loop harness focused smoke test：`node .opencode/loop/cli.mjs --self-test`
- 常见 focused 文档/脚本检查：`git diff --check -- <files...>`
- API focused test：`pnpm test:api:file -- test/<file>.test.js`
- web focused test：`node --test --test-name-pattern "<name>" apps/web/test/<file>.test.js`
- 只有在当前增量确实跨范围时，才升级到更重的 `pnpm build` / `pnpm lint` / `pnpm typecheck`

## Loop Notes

- loop 仍保持 one queue item at a time；但相邻相关 item 现在可通过 `sessionAffinityKey` 或兼容 `plannerFamily` 保守复用 session。
- planner auto-refill 默认值现在是 `0`，即默认关闭，只有显式启用时才补货。
- verifier replan prompt 现在走 delta prompt，不再整段回放原始执行 prompt。
- planner/materializer 生成的同 wave sibling items 会自动带 `sessionAffinityKey`，减少未来 queue 的冷启动浪费。

## Key Docs

- 方向与优先级：`docs/next_steps_rag_project_plan.md`
- 当前进展摘要：`docs/current-progress.md`
- 本地开发与验证：`docs/current-dev-setup.md`
- 仓库总览：`README.md`
- loop harness 摘要合同：`.opencode/loop/loop-contract-brief.md`
- loop harness 全量说明：`.opencode/loop/README.md`
