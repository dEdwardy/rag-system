# queue-observability-007

- 标题: Improve idle queue summary output
- 状态: completed
- 代理: rag-build
- 会话: ses_2ce3f71b7ffeSPqm9dJtQggav7
- 消息: msg_d31c16b63001Jb5YqnIM4b1gMt
- 开始: 2026-03-28 08:03:16
- 收到: 2026-03-28 08:04:24
- 完成: 2026-03-28 08:04:24

## 结果
Implemented one **small, focused increment** for loop idle observability (backend/tooling side, no queue schema redesign).

### What I inspected first (relevant code path)
- `scripts/opencode-loop/runtime.mjs` (idle/pick status logging path)
- `scripts/opencode-loop/queue.mjs` (queue cursor/pending semantics)
- `scripts/opencode-loop/self-test.mjs` (existing focused validation path)
- `scripts/opencode-loop.mjs` (entrypoint)

### Minimal change implemented
#### 1) Idle status now reports remaining work explicitly
**File:** `scripts/opencode-loop/runtime.mjs`

- Added `buildIdleQueueWorkVisibility(queue)` helper.
- Extended existing `logStatus("idle", ...)` payload to include:
  - `remainingQueueWork`
  - `queuePending`
  - `queueInProgress`
  - `queueCompleted`
  - `queueTotal`
- Kept scope narrow: no queue format change, no scheduling/pick/complete behavior change.
- Small internal reuse: extracted queue counting into `countQueueWork(queue)` and reused from pick/idle helpers.

#### 2) Progress doc updated
**File:** `docs/current-progress.md`

- Added a new 2026-03-28 bullet describing this idle-log improvement and validation command/result.

---

### Focused validation run
**Exact command:**
```bash
node scripts/opencode-loop.mjs --self-test
```

**Result:** Passed (`Self-test passed.`)

From the actual run output, idle log now includes the new detail, e.g.:
- `空闲 remainingQueueWork=0 queuePending=0 queueCompleted=2 queueInProgress=0 queueTotal=2 ...`

---

### Exact files changed
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

Implement one minimal queue idle summary improvement.

Priority guidance:
- improve the idle status output for the loop command
- prefer a small log line or helper around remaining pending work
- do not redesign the queue format
- do not broaden into a dashboard or new UI

Choose one small focused increment, validate it minimally, and report the exact idle-state detail it adds.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

