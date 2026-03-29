# queue-observability-008

- 标题: Preview the next queue item in status output
- 状态: completed
- 代理: rag-build
- 会话: ses_2ce3e6764ffeScVm4XEo5NMd1D
- 消息: msg_d31c2aaf7001fCvotyMmklpc8c
- 开始: 2026-03-28 08:04:24
- 收到: 2026-03-28 08:05:47
- 完成: 2026-03-28 08:05:47

## 结果
Implemented — I made one **small queue-loop observability increment** focused on next-item preview.

### What I changed (minimal increment)

1. **`scripts/opencode-loop/runtime.mjs`**
   - Extended existing `buildQueueCursorVisibility()` output to include:
     - `nextPendingItemIndex`
     - `nextPendingItemTitle`
   - Kept existing `nextPendingItemId` unchanged (backward compatible).
   - Replaced id-only lookup helper with a small detail helper:
     - `findNextPendingItem(items, pickedIndex)` returns `{ index, id, title } | null`.
   - Added new fields to ordered log output in `logStatus()` so they show consistently in `pick` status lines.

2. **`docs/current-progress.md`**
   - Added one new progress entry documenting this queue `pick` next-item preview improvement and validation command/result.

---

### Exact next-item detail now added

In `pick` log status, next pending item preview now includes:

- `nextPendingItemId` (existing)
- `nextPendingItemIndex` (**new**)
- `nextPendingItemTitle` (**new**)

So you now see **id + index + title** for the next pending target at a glance.

---

### Focused validation run

Command executed:

```bash
node scripts/opencode-loop.mjs --self-test
```

Result: **passed** (`Self-test passed.`)

And the runtime output now shows the new fields, e.g.:

- `nextPendingItemId="build-002"`
- `nextPendingItemIndex=1`
- `nextPendingItemTitle="Run the next unattended step"`

---

### Exact files touched in this increment

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

Implement one minimal next-item preview improvement for the queue loop.

Priority guidance:
- improve the visibility of the next pending item or cursor target
- prefer a small status helper or log line
- do not redesign the queue format
- do not broaden into a dashboard or new UI

Choose one small focused increment, validate it minimally, and report the exact next-item detail it adds.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

