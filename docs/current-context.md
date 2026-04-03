# Current Context

> 文档角色：`current-context`
> 当前使用方式：默认给人和 agent 提供短摘要；只保留当前主线、硬边界、最小验证和高频入口，详细历史按需回看其他文档。
更新时间：2026-04-04

## Current Mainline

- 当前默认工作方式：单线推进、小步增量、每轮收口，不并行展开多个大方向。
- 当前代码现实已经明显前于旧计划口径：
  - `P0` read-model / metadata convergence：已完成
  - `P1` auth/login 最小闭环：已完成
  - `P2` owner-only ACL baseline：已完成
  - `P3` external-source family + guardrails：开发已完成，进入维护态
  - `P5` eval / regression baseline：工程化能力已完成，进入基线治理/使用态
- 当前更合适的下一批增量不再是继续把 `P3` / `P5` 当成主开发波次。
- `docs / stage alignment` 和当前这轮 `P4 web capability carry-through` 收口已完成；接下来更适合：
  - 在 `P4/P5/P6` 已完成收口的基础上做 bounded maintenance
  - 或选择一个新的明确产品波次，并保持单线推进
- `Document Detail -> Run -> Trace` 路径补齐了一项可读性维护：文档详情把当前 ingestion 状态与 next action 收敛到一个主状态区域，降低首屏来回扫读成本。
- Documents 工作台的主状态 readout 进一步补齐了状态到动作的窄路径：失败态可直达失败文档诊断、进行中可直达当前 run 观察、就绪态可直达 trace 结果。
- 同一路径补齐 failure summary 文案契约：失败主摘要先用产品语言说明发生了什么，再引导到既有 trace 诊断后续动作，不把后端底层字段作为主视图。
- Report Center 的 pre-run readout 补齐了 URL carry-through 预览，运行前可直接核对 question set、assistant、baseline snapshot 与将写入 URL 的参数串。
- Report Center 的 result readout 补齐了 summary-before-details 顺序：结果区先给出 current inputs / summary / diff / weakest-item / next action 的一屏速读，再进入图表与明细。
- Report Center 的 regression follow-up 文案进一步收紧：回归原因标签优先使用可读产品语言，next action 明确指向现有的 Run diff summary 与 Regression weakest items 路径，不新增详情页。

## Current Priorities

- `bounded stability maintenance`：保留 `P3/P5/P6` 范围内的小型回归修补，但不再把它们描述成主开发方向。
- `next product increment selection`：如果继续做产品增量，优先从已完成的当前收口基础上选择一个新的明确小波次，而不是重新把 `P3/P4/P5` 包装成未完成主线。
- `docs freshness`：继续保持阶段判断、状态摘要和执行边界同步，避免文档再次落后于代码现实。

## Execution Order

1. 维持 `P3/P5/P6` 范围内的 bounded maintenance，只接受窄范围、可验证的小改。
2. 若继续做产品增量，先明确下一条单线主线，再按最小可收口 increment 推进。
3. 继续保持阶段判断、状态摘要和高频入口文档同步。

## Do Not Do

- 不把已经完成主开发的 `P3` / `P5` 重新包装成新的 feature wave。
- 不把当前这轮已完成收口的 `P4` 页面承接工作重新写回“待开发主线”。
- 不在没有明确收益时重开 source expansion、benchmark framework redesign、observability platform 化。
- 不做 broad refactor、架构重写、schema / persistence 大改。
- 不把 docs / queue / progress 的 bookkeeping 扩成新的产品方向。

## Validation Baseline

- focused 文档/脚本检查：`git diff --check -- <files...>`
- API focused test：`pnpm test:api:file -- test/<file>.test.js`
- web focused test：`node --test --test-name-pattern "<name>" apps/web/test/<file>.test.js`
- 只有在当前增量确实跨范围时，才升级到更重的 `pnpm build` / `pnpm lint` / `pnpm typecheck`

## Key Docs

- 方向与优先级：[docs/next_steps_rag_project_plan.md](D:\FeProjects\rag-system\docs\next_steps_rag_project_plan.md)
- 当前进展摘要：[docs/current-progress.md](D:\FeProjects\rag-system\docs\current-progress.md)
- 项目状态总览：[docs/project-status-overview.md](D:\FeProjects\rag-system\docs\project-status-overview.md)
- 本地开发与验证：[docs/current-dev-setup.md](D:\FeProjects\rag-system\docs\current-dev-setup.md)
- 仓库总览：`README.md`
