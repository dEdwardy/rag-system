# eval-regression-baseline-008

- 标题: Write eval regression baseline
- 状态: completed
- 代理: rag-build
- 会话: ses_2cc86b5adffePIDUwpUJ67sbr7
- 消息: msg_d337a57e9001W1G3xMDqaDz3M2
- 开始: 2026-03-28 16:04:40
- 收到: 2026-03-28 16:06:00
- 完成: 2026-03-28 16:06:00

## 结果
已按你的执行模式直接落地，先读了指定路径再做最小改动。

### 已先检查的文件（编辑前）
- `AGENTS.md`
- `docs/next_steps_rag_project_plan.md`
- `docs/current-progress.md`
- `docs/current-dev-setup.md`（用于确认现有 focused test 命令入口）

### 最小改动
1. **`docs/next_steps_rag_project_plan.md`**
   - 在 P0 closeout queue 的 **item 8（eval/regression baseline）** 下新增了可复用最小基线：
     - `pnpm test:api:file -- test/traces.service.test.js`
     - `pnpm test:api:file -- test/ask-success.test.js`
     - `node --test apps/web/test/trace-summary-contract.test.js`
   - 并补充了“回归确认口径”（三条全过即判定本轮 closeout 无回归；失败先修对应路径再重跑同组命令）。

2. **`docs/current-progress.md`**
   - 新增一条 `✅ P0 closeout queue eval/regression baseline` 收口记录，写明：
     - 变更文件
     - 可重复执行的 baseline 命令
     - 回归判定标准
     - 未引入新框架、未改运行时语义/检索语义/持久化

### 运行的 focused 验证（1条）
```bash
git diff --check -- "docs/next_steps_rag_project_plan.md" "docs/current-progress.md"
```
结果：通过（无 whitespace / patch 格式问题）。

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, and the existing focused test commands before editing.

Task: write down the smallest reusable eval / regression baseline for this closeout wave.

Focus files:
- `docs/next_steps_rag_project_plan.md`
- `docs/current-progress.md`
- optionally `docs/current-dev-setup.md` if a command list needs to be captured

Rules:
- keep it minimal and executable
- prefer existing test commands over new tooling
- describe how to confirm this wave did not regress

Deliverable:
- add a compact baseline note or checklist that can be rerun later
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

