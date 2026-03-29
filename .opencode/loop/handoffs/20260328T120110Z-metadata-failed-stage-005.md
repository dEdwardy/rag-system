# metadata-failed-stage-005

- 标题: normalize failed stage wording
- 状态: completed
- 代理: rag-build
- 会话: ses_2cbb0c230ffePQfICXYM6ljpm1
- 消息: msg_d34517980001TvNxFroWWBribq
- 开始: 2026-03-28 19:58:21
- 收到: 2026-03-28 20:01:10
- 完成: 2026-03-28 20:01:10

## 结果
已按你的执行模式完成 1 个最小增量（backend-first、additive、不改检索语义），并已提交到当前 `dev` 分支。

### 本次选择的最小 gap
为 `traceSummary` 增加一个可直接阅读失败信息的一行字段：`failureReadabilitySentence`，把已有 `failedStageReadabilityLabel + failureMessage` 合并成一句，减少排查时跨字段拼接成本。

---

### 先检查的相关代码路径
- `apps/api/src/modules/traces/traces.service.ts`
- `packages/shared/src/trace-contracts.ts`
- `apps/api/test/traces.service.test.js`
- `apps/web/test/trace-summary-contract.test.js`
- `docs/current-dev-setup.md`

---

### 实际改动文件
1. `apps/api/src/modules/traces/traces.service.ts`
   - 新增 `buildFailureReadabilitySentence(...)`
   - 在 `buildTraceSummary(...)` 中新增：
     - `failedStageReadabilityLabel` 局部变量
     - `failureMessage` 局部变量
     - 输出字段 `failureReadabilitySentence`

2. `packages/shared/src/trace-contracts.ts`
   - `TraceSummary` 新增字段：
     - `failureReadabilitySentence: string`

3. `apps/api/test/traces.service.test.js`
   - 新增/更新断言覆盖三类路径：
     - 已知失败阶段 + 有 message
     - 未知(raw)失败阶段 + 有 message
     - 无 message 回退（`message unavailable`）

4. `apps/web/test/trace-summary-contract.test.js`
   - 增加 shared contract guard：
     - `failureReadabilitySentence: string`

5. `docs/current-dev-setup.md`
   - trace-summary 字段清单新增 `failureReadabilitySentence`

6. `docs/current-progress.md`
   - 追加本次增量进展记录

---

### 执行的验证（最小相关）
```bash
pnpm --filter @rag-system/api test:file -- test/traces.service.test.js
```
结果：通过（`26/26`）

---

### Git 提交
已提交（未 push / 未开 PR）：

- 分支：`dev`
- 提交：`3d5ae9d`
- message：`fix: add trace failure readability sentence`

工作区当前干净（`git status --short` 无输出）。

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.
Commit each completed increment on the current branch, but keep push and PR decisions for a stable wave closeout point after validation is green.
Prefer `dev` for backend work unless the task explicitly requires a different branch transition.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md and the primary docs.

Implement one minimal failed-stage readability improvement for the trace summary.

Priority guidance:
- keep the change additive and behavior-preserving
- prefer `failedStage`, `failureMessage`, or related trace summary clarity
- do not change retrieval execution semantics
- do not reopen UI refactor or broad source-platform work

Choose one small gap that makes failure traces easier to read, validate it minimally, and report exact files plus commands.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

