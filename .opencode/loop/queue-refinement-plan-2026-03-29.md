# Queue Refinement Plan (2026-03-29)

## Goal

将当前文档中已经明确的后续主线，拆成可以直接进入 `.opencode/loop/queue.json` 并由 loop 自动消费的最小执行单元。

本轮计划目标不是重新定义 wave，而是把当前已经确认的下一波主线收束成 execution-ready increments，并保持以下顺序：

`P3 main queue -> P5/P6 closeout queue -> loop queue refresh`

同时保留以下约束：

- 继续单线推进，不并行展开多个大主题
- 每个 queue item 只对应一个最小可消费增量
- 每个 queue item 都要有明确边界和一个 focused validation
- 不把明显依赖人工判断的任务塞进自动 queue

## Post-Drain Refresh

在上一轮 `P5 -> P6 -> docs sync` closeout queue 已消费完成后，当前 queue 曾短暂处于 drained 状态；本文件现在记录 drain 之后重新建队的 12-item core wave，并在其后追加一条更小的 P3 follow-up micro-wave。

当前默认执行顺序更新为：

`P3 main queue -> P5/P6 closeout queue -> loop queue refresh`

原因与边界：

- `P0` / `P1` / `P2` 已显式收口，不再回头重开 auth/ACL 主线
- `P3` 仍有适合自动 loop 消费的稳定性补强缺口，且与当前 docs/plan 结论一致
- `P5` 只继续消费已经落地能力的 docs/contract closeout，不把人工 baseline 判断项塞进自动 queue
- `P6` 只继续做 scan-first/readability/docs closeout，不扩成 observability dashboard 平台化
- `P4` 仍保持条件触发，不在本轮 queue 中单独抢跑

本轮追加 batch 的目标仍然是 execution-ready 收口，不是重开新架构或大范围产品改版。

## Source Of Truth

本轮计划依据以下文档与现有 queue 状态整理：

- `docs/next_steps_rag_project_plan.md`
- `docs/current-progress.md`
- `docs/current-dev-setup.md`
- `.opencode/loop/queue.json`

执行提示来源说明：

- queue 的短标题只用于识别和展示
- 真正执行边界由 queue item 的 `promptText` 或 `promptFile` 承载
- loop runtime 会在任务 prompt 之前叠加 execution directive 和 repo build template
- 因此 queue item 可以保持短标题，但 prompt 必须精确、收敛、不可过宽

## Included Queue Items

### Main Queue

1. `p3-source-gaplist-refresh-055`
   - title: `source gaplist refresh`

2. `p3-source-diagnostics-consistency-056`
   - title: `source diagnostics consistency`

3. `p3-source-resync-recovery-057`
   - title: `source resync recovery guards`

4. `p3-sitemap-boundary-guard-058`
   - title: `sitemap boundary guard`

5. `p3-web-feed-partial-diagnostics-059`
   - title: `web-feed partial diagnostics`

6. `p3-source-followup-docs-sync-060`
   - title: `source follow-up docs sync`

### Closeout Queue

7. `p5-runner-report-contract-sync-061`
   - title: `runner/report contract sync`

8. `p6-usage-scan-closeout-062`
   - title: `usage scan-first closeout`

9. `p6-report-center-closeout-063`
   - title: `report center closeout`

10. `p6-trace-detail-closeout-064`
   - title: `trace detail closeout`

11. `p6-observability-docs-sync-065`
   - title: `observability docs sync`

12. `loop-queue-refresh-066`
    - title: `loop queue refresh`

### P3 Follow-up Micro-Wave

13. `p3-source-gaplist-refresh-067`
    - title: `source gaplist refresh`

14. `p3-source-retry-timeout-diagnostics-068`
    - title: `source retry/timeout diagnostics`

15. `p3-web-body-quality-diagnostics-069`
    - title: `web body-quality diagnostics`

16. `p3-external-resync-error-code-consistency-070`
    - title: `external resync error-code consistency`

17. `p3-source-followup-docs-sync-071`
    - title: `source follow-up docs sync`

18. `loop-queue-refresh-072`
    - title: `loop queue refresh`

## Wave Closeout Status (2026-03-29)

本轮已按既定顺序完成并收口：

- `p3-source-gaplist-refresh-055`
- `p3-source-diagnostics-consistency-056`
- `p3-source-resync-recovery-057`
- `p3-sitemap-boundary-guard-058`
- `p3-web-feed-partial-diagnostics-059`
- `p3-source-followup-docs-sync-060`
- `p5-runner-report-contract-sync-061`
- `p6-usage-scan-closeout-062`
- `p6-report-center-closeout-063`
- `p6-trace-detail-closeout-064`
- `p6-observability-docs-sync-065`
- `loop-queue-refresh-066`

closeout 边界保持不变：

- 本次只做 queue/progress/refinement 收口记录
- 不追加新 queue item
- 不重开人工判断型 `P5` 项
- 不触发 source-family / auth / observability dashboard 扩面

当前队列状态应保持为：本 12-item core wave 已清晰落账，后续追加的 P3 follow-up micro-wave 也已收口，队列已整理为等待下一批人工批准 wave。

## P3 Follow-up Micro-Wave Closeout Status (2026-03-29)

追加的 P3 follow-up micro-wave 已按既定边界完成并收口：

- `p3-source-gaplist-refresh-067`
- `p3-source-retry-timeout-diagnostics-068`
- `p3-web-body-quality-diagnostics-069`
- `p3-external-resync-error-code-consistency-070`
- `p3-source-followup-docs-sync-071`
- `loop-queue-refresh-072`

closeout 边界保持不变：

- 本次只做 queue/progress/refinement 收口记录
- 不追加新 queue item
- 不重开人工判断型 `P5` 项
- 不触发 source-family / auth / observability dashboard 扩面

## Items Kept Out Of Auto Queue

以下任务不进入自动 queue，因为它们依赖人工判断、主观验收或基线选择，不适合自动 build loop：

- `eval baseline question set`
- `baseline annotations`
- `baseline dataset version pin`
- `demo case shortlist`
- `demo replay baseline`
- `new source type review` add-paths / source family expansion
- auth/ACL 新波次扩面
- Usage / Report center / Trace Detail dashboard 平台化
- 大范围 UI 重做

## Queue Design Rules

本轮 queue refinement 遵循以下规则：

- 一个 item 只做一个小结果，不混多个子目标
- 每个 item 限定在较窄文件面或模块面
- 每个 item 都写明“不做什么”
- 每个 item 只要求一个 focused validation
- docs item 只做文档同步，不顺手修改运行时逻辑
- contract/ACL/source/eval/UI slice 彼此分开，不混成大而泛的主题项

## Documentation Alignment

本轮需要同步的文档边界：

### `docs/next_steps_rag_project_plan.md`

只记录：

- 当前推荐顺序仍以 `P3 -> P5 -> P6 -> P4` 为主，但当前自动执行队列细化为 12-item wave
- queue 可以使用短标题
- 真正执行边界在 `promptText` / `promptFile`
- 人工判断型 `P5` 任务不进自动 queue

不在该文档里写完整执行 prompt。

### `docs/current-progress.md`

只记录：

- 这批 12-item refined queue items 已追加
- 其后又追加了一个 P3 follow-up micro-wave
- 当前执行顺序是 `P3 main queue -> P5/P6 closeout -> loop queue refresh`
- 哪些人工项仍不入队
- 这是已批准 wave 的 execution-ready rebuild，不是新 wave 定义

## Expected Execution Flow

当进入 build mode 后，推荐执行顺序：

1. 更新 `docs/next_steps_rag_project_plan.md`
2. 更新 `.opencode/loop/queue-refinement-plan-2026-03-29.md`
3. 更新 `.opencode/loop/queue.json`
4. 更新 `docs/current-progress.md`
5. 做最小验证：
    - queue JSON 可解析
    - docs diff 无格式错误
6. 启动 loop
7. 让 loop 串行消费这批 item
8. 根据 handoff 和完成结果决定下一批 queue，而不是在同一轮继续扩面

## Validation Baseline

计划/queue 同步阶段的最小验证：

```bash
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('.opencode/loop/queue.json','utf8'));"
git diff --check -- .opencode/loop/queue.json docs/next_steps_rag_project_plan.md docs/current-progress.md
```

各 item 的 focused validation 由对应 `promptText` 单独声明。

## Expected Outcome

完成后应达到以下结果：

- wave-level planning 被收束成 execution-ready queue items（12-item core wave + P3 follow-up micro-wave）
- queue item 标题保持简短，但 prompt 足够精确
- 自动 loop 只消费适合工程自动执行的项
- 人工评审型 `P5` 任务继续留在 queue 外
- 后续 wave 推进可直接基于 queue + handoff + progress docs 做下一轮决策
