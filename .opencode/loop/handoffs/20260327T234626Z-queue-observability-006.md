# queue-observability-006

- 标题: Improve current queue item summary output
- 状态: completed
- 代理: rag-build
- 会话: ses_2ce505185ffewykgFvElmMuu0f
- 消息: msg_d31b0ea010017pG4BrtVdq7RSV
- 开始: 2026-03-28 07:44:50
- 收到: 2026-03-28 07:46:26
- 完成: 2026-03-28 07:46:26

## 结果
已按你的要求直接实现一个**最小队列状态可读性增量**（backend/loop 侧、小步、无格式重构）。

### 先检查的相关代码路径
- `scripts/opencode-loop/runtime.mjs`（`pick` 状态日志、主循环）
- `scripts/opencode-loop/queue.mjs`（游标与 pending 选择语义，确认不改语义）
- `scripts/opencode-loop/self-test.mjs`（最小验证入口）
- `docs/current-progress.md`（进度记录）

---

### 已实施的最小改动

#### 1) 在 `pick` 状态日志补充“当前游标项 + 下一个 pending 项”
**文件：**
- `scripts/opencode-loop/runtime.mjs`

**改动点：**
- 在 `logStatus("pick", ...)` 中新增 `buildQueueCursorVisibility(queue, next.index)` 输出
- 新增 helper：
  - `buildQueueCursorVisibility(queue, pickedIndex)`
  - `findNextPendingItemId(items, pickedIndex)`
- 在 `logStatus` 的字段排序中加入新字段，确保日志前部可见

**新增的 queue-state 细节（精确字段名）：**
- `queueCursor`：当前队列游标值
- `queueCursorItemId`：游标当前指向的 item id
- `queueCursorItemStatus`：游标当前指向项的状态
- `nextPendingItemId`：按现有顺序（含环回）计算的下一个 pending 项 id（若无则空）

> 这是纯 observability 增量：**未改 queue schema、未改 pick/complete 语义、未扩展 UI/dashboard**。

#### 2) 更新进度文档
**文件：**
- `docs/current-progress.md`

新增一条对应记录，说明上述字段与验证命令。

---

### 最小相关验证（已执行）

**命令：**
```bash
node scripts/opencode-loop.mjs --self-test
```

**结果：通过（Self-test passed）**

并在运行日志中可见新增字段，例如：
- `queueCursor=0`
- `queueCursorItemId="build-001"`
- `queueCursorItemStatus="pending"`
- `nextPendingItemId="build-002"`

---

### 本次任务实际改动文件
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

Implement one minimal queue current-item summary improvement.

Priority guidance:
- improve the status output for the current item, cursor, or next pending task
- prefer a small log line or status helper in the loop command
- do not redesign the queue format
- do not broaden into a dashboard or new UI

Choose one small focused increment, validate it minimally, and report the exact queue-state detail it adds.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

