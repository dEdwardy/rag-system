# queue-observability-001

- 标题: Improve queue remaining-work observability
- 状态: completed
- 代理: rag-build
- 会话: ses_2ce724f52ffevRcVhl1TS5rfKu
- 消息: msg_d318f3304001YUi6yOTpcphkrI
- 开始: 2026-03-28 07:07:42
- 收到: 2026-03-28 07:09:36
- 完成: 2026-03-28 07:09:36

## 结果
已按你的执行模式完成一个最小增量（backend/tooling-first，未扩 scope）。

### 我先检查的代码路径
- `scripts/opencode-loop/runtime.mjs`（`runLoop` 的 `pick` / `idle` 日志路径、`logStatus` 输出）
- `scripts/opencode-loop/queue.mjs`（队列状态语义：`pending` / `in_progress` / `completed`）

---

### 实现的最小改动（单点：`pick` 状态可见性）
我选择在 **`pick` 运行时状态转换** 上增强剩余工作可见性：

#### 1) `scripts/opencode-loop/runtime.mjs`
- 在 `logStatus("pick", ...)` 中新增队列可见性字段：
  - `remainingAfterPick`
  - `queuePending`
  - `queueInProgress`
  - `queueTotal`
- 新增一个小 helper：`buildQueueWorkVisibility(queue, pickedIndex)`
  - 统计当前队列 `pending/in_progress/total`
  - 计算“当前任务被取走后”的剩余工作量 `remainingAfterPick`
- 在 `logStatus` 的 `orderedKeys` 里加入上述字段，保证日志输出顺序稳定可扫读。

#### 2) `docs/current-progress.md`
- 追加一条 2026-03-28 进展记录，说明这次 queue observability 增量与验证命令。

---

### 这次新增的 queue-state insight（精确）
现在每次 `pick` 日志会直接给出：

- **取当前任务后还剩多少工作**：`remainingAfterPick`
- 同时给出当前基线：
  - `queuePending`
  - `queueInProgress`
  - `queueTotal`

示例（实测输出）：
- `... 取任务 ... remainingAfterPick=1 queuePending=2 queueInProgress=0 queueTotal=2`
- `... 取任务 ... remainingAfterPick=0 queuePending=1 queueInProgress=0 queueTotal=2`

---

### 最小相关验证（1条）
执行命令：
```bash
node scripts/opencode-loop.mjs --self-test
```

结果：
- `Self-test passed.`
- 日志中已出现新增字段，证明该 observability 改动生效。

---

### 本次实际改动文件
- `scripts/opencode-loop/runtime.mjs`
- `docs/current-progress.md`

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md and the primary docs.

Implement one minimal queue observability improvement for the loop start/idle logs.

Priority guidance:
- improve remaining-work visibility for a single runtime state transition
- prefer a small log line or status helper around `start`, `pick`, or `idle`
- do not redesign the queue format
- do not broaden into a dashboard or new UI

Choose one small focused increment, validate it minimally, and report the exact queue-state insight it adds.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

