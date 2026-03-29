# queue-observability-002

- 标题: Add one queue status summary improvement
- 状态: completed
- 代理: rag-build
- 会话: ses_2ce6c81c4ffe6IvP6rk5xsA6Uz
- 消息: msg_d319465ee001k5BRx0B13XWkUn
- 开始: 2026-03-28 07:14:02
- 收到: 2026-03-28 07:15:13
- 完成: 2026-03-28 07:15:13

## 结果
Implemented one **small, focused queue status summary increment** (backend/tooling-side, no format redesign).

### What I inspected first
- `scripts/opencode-loop/runtime.mjs`
  - `buildQueueWorkVisibility(...)`
  - `logStatus(...)` ordered output keys
  - `logStatus("pick", ...)` call site

### Minimal change made
#### 1) Add completed count to pick-time queue visibility
- **File:** `scripts/opencode-loop/runtime.mjs`
- **Change:** `buildQueueWorkVisibility()` now also computes and returns:
  - `queueCompleted`
- **Change:** `logStatus()` ordered fields now include:
  - `queueCompleted` (next to pending/in-progress/total fields)

This keeps existing queue semantics unchanged and only improves observability.

#### 2) Progress doc update
- **File:** `docs/current-progress.md`
- Added one new 2026-03-28 progress bullet describing this queue log visibility increment + focused validation command.

---

### Focused validation run
- **Command:**
  - `node scripts/opencode-loop.mjs --self-test`
- **Result:** Passed (`Self-test passed.`)

From actual runtime logs after change:
- Example pick line now includes:
  - `queuePending=1 queueCompleted=1 queueInProgress=0 queueTotal=2`

---

### Exact new queue-state insight added
At each `pick` event, you can now see **pending + completed at a glance** in the same status line, so progress is immediately visible without opening `queue.json` or handoff files.

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md and the primary docs.

Implement one minimal queue status summary improvement for pending/completed counts.

Priority guidance:
- improve pending/completed visibility or cursor position at a glance
- prefer a small diagnostic command or status output
- do not redesign the queue format
- do not broaden into a dashboard or new UI

Choose one small focused increment, validate it minimally, and report the exact queue-state insight it adds.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

