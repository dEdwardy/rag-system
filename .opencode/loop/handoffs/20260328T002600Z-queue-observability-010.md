# queue-observability-010

- 标题: Preview resumed queue items in status
- 状态: completed
- 代理: rag-build
- 会话: ses_2ce2c588dffeWh3Bw74pYFw8yt
- 消息: msg_d31d505f5001DDRP0IfUeal1LN
- 开始: 2026-03-28 08:24:07
- 收到: 2026-03-28 08:26:00
- 完成: 2026-03-28 08:26:00

## 结果
已按你的执行模式完成一个**最小 queue resume preview 增量**（backend-first / observability-only，无队列格式改动）。

### 先检查的代码路径
- `scripts/opencode-loop/runtime.mjs`
- `scripts/opencode-loop/queue.mjs`
- `scripts/opencode-loop/self-test.mjs`
- `scripts/opencode-loop.md`

### 实现的最小改动
我在 `scripts/opencode-loop/runtime.mjs` 里新增了一个小 helper：

- `buildActiveCursorResumeVisibility(cursorItem)`

并把它挂到现有 `buildQueueCursorVisibility()` 返回值中，用于给 `pick` 状态日志补充“当前游标项是否可恢复”的预览字段。

### 新增的 resume 预览细节（核心）
对 `in_progress` 的游标项，`pick` 日志现在会额外输出：

- `queueCursorResumePreview`
  - 例如：`"resume-awaiting-new-assistant-message"`  
  - 或：`"resume-with-tracked-assistant-message"`
- `queueCursorResumeSessionId`
- `queueCursorResumeMessageId`（有则显示）
- `queueCursorResumeStartedAt`
- 同时补了 `queueCursorItemTitle`（便于识别中断项）

> 这是纯可观测性增强：**不改 queue schema、不改 pick/complete 语义、不扩展 UI**。

### 变更文件（本次实际编辑）
- `scripts/opencode-loop/runtime.mjs`
- `docs/current-progress.md`（追加进展记录）

### 执行的验证（单一 focused）
```bash
node scripts/opencode-loop.mjs --self-test
```

结果：通过（`Self-test passed.`）

并在输出中可见新增 resume 细节，例如恢复场景下出现：
- `queueCursorResumePreview="resume-awaiting-new-assistant-message"`
- `queueCursorResumeSessionId="ses_resume_1"`
- `queueCursorResumeStartedAt="2026-03-28 08:25:32"`

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md and the primary docs.

Implement one minimal queue resume preview improvement.

Priority guidance:
- improve the output for resumed or interrupted items
- prefer a small status helper around the active cursor item
- do not redesign the queue format
- do not broaden into a dashboard or new UI

Choose one small focused increment, validate it minimally, and report the exact resume detail it adds.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

