# queue-observability-011

- 标题: Show cursor distance to next pending item
- 状态: completed
- 代理: rag-build
- 会话: ses_2ce2a9f15ffeiJfXJAoVBKvGWD
- 消息: msg_d31d66c87001cajzz25zMxjkTH
- 开始: 2026-03-28 08:26:00
- 收到: 2026-03-28 08:27:21
- 完成: 2026-03-28 08:27:21

## 结果
Implemented one **minimal queue cursor-distance increment** (backend/script-side observability only), after reading AGENTS + primary docs and inspecting the queue runtime path.

### What I changed

#### 1) Add cursor-distance field in pick status visibility
**File:** `scripts/opencode-loop/runtime.mjs`

- Updated `buildQueueCursorVisibility(queue, pickedIndex)` to include:
  - `nextPendingCursorDistance`
- Added small helper:
  - `computeCursorDistanceToIndex({ cursor, targetIndex, itemCount })`
- Distance is **wrap-around aware** and returns `null` if inputs are not valid.
- Added `nextPendingCursorDistance` into `logStatus()` ordered key list so it appears in `pick` logs.

This is additive only:
- no queue schema changes
- no pick/complete scheduling behavior changes
- no dashboard/UI expansion

---

#### 2) Update progress doc for this increment
**File:** `docs/current-progress.md`

- Added one new 2026-03-28 progress bullet documenting:
  - new field name
  - behavior/scope
  - focused validation command
  - observed outcome

---

### Focused validation run

**Command executed:**
```bash
node scripts/opencode-loop.mjs --self-test
```

**Result:** passed (`Self-test passed.`)

The runtime log now includes the new insight, e.g.:
- `nextPendingCursorDistance=1` during `pick` when next pending is one step away from current cursor.

---

### Exact cursor-distance insight added

You can now directly read in `pick` status log:

- **`nextPendingCursorDistance`** = number of queue steps from current `queueCursor` to `nextPendingItemIndex` (with wrap-around).

This removes the need to manually compare `queueCursor` and `nextPendingItemIndex` to estimate how far the cursor is from the next pending task.

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md and the primary docs.

Implement one minimal queue cursor-distance improvement.

Priority guidance:
- improve how far the cursor is from the next pending item
- prefer a small log line or status helper
- do not redesign the queue format
- do not broaden into a dashboard or new UI

Choose one small focused increment, validate it minimally, and report the exact cursor-distance insight it adds.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

