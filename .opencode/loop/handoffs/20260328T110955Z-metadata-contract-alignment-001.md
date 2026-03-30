# metadata-contract-alignment-001

- 标题: ask/trace contract align
- 状态: completed
- 代理: rag-build
- 会话: ses_2cbe0d4b6ffepQfnFZvuXsAQkZ
- 消息: msg_d34229c93001L2yin7xxWr3DUO
- 开始: 2026-03-28 19:05:51
- 收到: 2026-03-28 19:09:55
- 完成: 2026-03-28 19:09:55

## 结果
已按你的执行模式完成一个 **最小 contract-alignment increment**，并已提交到当前 `dev` 分支。

### 本次改动（additive / behavior-preserving）

1. **ask / ask-stream final payload 对齐 trace-summary 证据来源字段**
   - 在 `AskAssistantService` 的 one-shot 与 stream final 返回中新增：
     - `answerEvidenceSource`
     - `answerEvidenceSourceReadabilityLabel`
   - `answerEvidenceSource` 与现有 `answerAttributionSource` 保持同源（同一语义来源）
   - `answerEvidenceSourceReadabilityLabel` 复用现有 evidence-source 术语（含 unknown fallback）

2. **web 侧类型同步**
   - `apps/web/src/types/api.ts` 的 `AskResponse` 新增可选字段：
     - `answerEvidenceSource?: TraceCitationSelectionSource | null`
     - `answerEvidenceSourceReadabilityLabel?: string`

3. **focused 回归断言补齐**
   - one-shot: `apps/api/test/ask-success.test.js`
   - stream final: `apps/api/test/ask-stream-service.test.js`

4. **进度文档更新**
   - `docs/current-progress.md` 已追加本增量与验证结果

---

### 变更文件（exact）

- `apps/api/src/modules/assistants/ask-assistant.service.ts`
- `apps/api/test/ask-success.test.js`
- `apps/api/test/ask-stream-service.test.js`
- `apps/web/src/types/api.ts`
- `docs/current-progress.md`

---

### 执行的命令（exact）

- 验证：
  - `pnpm test:api:file -- test/ask-success.test.js test/ask-stream-service.test.js`
  - 结果：`48/48` 通过
- 提交：
  - `git add apps/api/src/modules/assistants/ask-assistant.service.ts apps/api/test/ask-success.test.js apps/api/test/ask-stream-service.test.js apps/web/src/types/api.ts docs/current-progress.md && git commit -m "fix: align ask evidence-source fields with trace summary" && git status -sb`

---

### 提交信息

- Commit: `b3773f1`
- Message: `fix: align ask evidence-source fields with trace summary`
- Branch status: `dev`（`ahead 2`，未 push，未开 PR）

---

未改动内容（按你的 scope 约束）：
- 未改 retrieval 执行语义
- 未改 ranking/defaults
- 未改 source-family 范围
- 无无关重构

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

Continue the current P0 read-model / metadata convergence wave with one minimal contract-alignment increment.

Scope rules:
- keep ask response, trace summary, and shared contract fields aligned
- keep the diff additive and behavior-preserving
- do not change retrieval execution semantics, ranking, defaults, or source-family scope
- run one focused validation command

When this task is truly completed, update `docs/current-progress.md` with the increment and validation result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

