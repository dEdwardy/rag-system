# metadata-answer-attribution-001

- 标题: align answer attribution labels
- 状态: completed
- 代理: rag-build
- 会话: ses_2cbbcc67cffeVNBM73R6r8i0K9
- 消息: msg_d344772e9001mGhg1ZSe8uyHoF
- 开始: 2026-03-28 19:45:14
- 收到: 2026-03-28 19:50:04
- 完成: 2026-03-28 19:50:04

## 结果
已按你要求完成这一个最小增量（直接实施、最小改动、1 次聚焦验证、已提交到当前分支 `dev`，未 push/未开 PR）。

### 本次改动（P0：answer-attribution readability 最小增量）
目标：新增一个更易读的顶层字段，减少前端/排查时必须深入 `answerAttributionSummary` 内层的成本，同时保持行为语义不变。

#### 代码文件
1. `apps/api/src/modules/assistants/ask-assistant.service.ts`
   - 在 one-shot 和 stream final 返回中新增：
     - `answerAttributionReadabilitySentence`
   - 复用已解析的 `answerAttributionSummary.readabilitySentence`（并保留 unknown 文案兜底）。

2. `apps/api/src/modules/traces/traces.service.ts`
   - 在 `traceSummary` 顶层新增：
     - `answerAttributionReadabilitySentence`
   - 同样映射自 `answerAttributionSummary.readabilitySentence`（含兜底文案）。

3. `packages/shared/src/trace-contracts.ts`
   - `TraceSummary` 新增共享契约字段：
     - `answerAttributionReadabilitySentence: string`

4. `apps/web/src/types/api.ts`
   - `AskResponse` 新增可选字段：
     - `answerAttributionReadabilitySentence?: TraceSummary["answerAttributionReadabilitySentence"]`

#### 测试与契约守卫更新
5. `apps/api/test/ask-success.test.js`
6. `apps/api/test/ask-stream-service.test.js`
7. `apps/api/test/traces.service.test.js`
8. `apps/web/test/trace-summary-contract.test.js`

#### 进度文档
9. `docs/current-progress.md`
   - 追加本次增量记录 + 验证命令与结果。

---

### 执行的验证命令（1 次聚焦）
```bash
pnpm test:api:file -- test/traces.service.test.js test/ask-success.test.js test/ask-stream-service.test.js
```

结果：**通过**（`74/74`）

---

### Git 提交
已提交到当前分支 `dev`：

- Commit: `3f6cdb9`
- Message: `fix: surface attribution readability sentence consistently`

当前状态：`dev` 相对 `origin/dev` **ahead 1**，工作区干净。

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

Continue the current P0 read-model / metadata convergence wave with one minimal answer-attribution readability increment.

Scope rules:
- improve final answer attribution readability through additive metadata/read-model clarity
- keep ask response, trace summary, and shared contracts aligned where relevant
- do not change retrieval behavior, source expansion scope, or schema/persistence semantics
- run one focused validation command

When this task is truly completed, update `docs/current-progress.md` with the increment and validation result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

