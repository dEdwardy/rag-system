# queue-observability-009

- 标题: Show queue counts by family
- 状态: completed
- 代理: rag-build
- 会话: ses_2ce2e5e67ffet0odGUmB49TxCZ
- 消息: msg_d31d36ab3001ONbigJj3Kn4Nui
- 开始: 2026-03-28 08:21:55
- 收到: 2026-03-28 08:24:07
- 完成: 2026-03-28 08:24:07

## 结果
Implemented one **minimal queue status increment** focused on family/prefix visibility (no queue format redesign).

### Code path inspected first
- `scripts/opencode-loop/runtime.mjs`
- `scripts/opencode-loop/queue.mjs`
- `scripts/opencode-loop/self-test.mjs`
- `scripts/opencode-loop.md`

### Small concrete change made
**File changed**
1. `scripts/opencode-loop/runtime.mjs`
   - Added helper: `buildQueueFamilyCountVisibility(queue)`
   - Added helper: `resolveQueueItemFamily(item)` (derives family from `item.id` prefix, split by `- _ : / .`)
   - Added helper: `mapToSortedObject(map)`
   - Extended existing status payloads (no schema change):
     - `logStatus("pick", ...)` now includes:
       - `queuePendingByFamily`
       - `queueCompletedByFamily`
     - `logStatus("idle", ...)` now includes:
       - `queuePendingByFamily`
       - `queueCompletedByFamily`
   - Added log key ordering for those two fields in `logStatus`.

2. `docs/current-progress.md`
   - Added one progress entry documenting this queue observability increment and its focused validation.

---

### Exact queue-state detail added
New additive status fields in loop logs:
- `queuePendingByFamily`
- `queueCompletedByFamily`

Example from run output:
- `queuePendingByFamily={"build":2}`
- `queueCompletedByFamily={"build":1}`
- idle example: `queueCompletedByFamily={"build":2}`

This directly improves pending/completed visibility by task family/prefix, as requested.

---

### Focused validation run
```bash
node scripts/opencode-loop.mjs --self-test
```

Result:
- `Self-test passed.`
- Output confirmed new fields appear in `pick` / `idle` status logs with family-level counts.

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md and the primary docs.

Implement one minimal queue family-counts status improvement.

Priority guidance:
- improve pending/completed visibility by task family or prefix
- prefer a small status helper or log line
- do not redesign the queue format
- do not broaden into a dashboard or new UI

Choose one small focused increment, validate it minimally, and report the exact queue-state detail it adds.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

