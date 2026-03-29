# queue-observability-003

- 标题: Guard one queue cursor edge case
- 状态: completed
- 代理: rag-build
- 会话: ses_2ce6b6fe5ffeonV1o1WJv2J2du
- 消息: msg_d3196b2e6001tFJmyud3YdXZm0
- 开始: 2026-03-28 07:15:13
- 收到: 2026-03-28 07:17:48
- 完成: 2026-03-28 07:17:48

## 结果
已按你的要求直接实施了一个最小 queue cursor guardrail（backend/tooling-first，小步增量，无队列格式重构）。

### 本次实现的最小增量（聚焦一个游标边界场景）
**保护的游标行为：**  
当 `queue.cursor` 越界（例如 `cursor: 99`，但队列只有 2 项）时，loop 现在会先做安全恢复，再继续选任务。

具体行为：
1. 计算安全游标（优先首个 `pending` 的索引；若无 `pending` 则设为 `items.length`）。
2. 将恢复后的 cursor 回写到 `queue.json`（避免“每轮都带着坏 cursor”）。
3. 打一条明确状态日志：`游标恢复`，并带上 `cursorFrom / cursorTo / cursorReason`。

---

### 变更文件（精确）
1. `scripts/opencode-loop/queue.mjs`
   - 新增 `resolveQueueCursor(queue)`。
   - `pickNextItem()` 改为使用该安全游标解析结果。

2. `scripts/opencode-loop/runtime.mjs`
   - 读取队列后先执行 cursor guard。
   - 若检测到异常 cursor，立即回写恢复后的 cursor。
   - 增加 `logStatus("cursor:recover", ...)` 及字段排序支持（`cursorFrom/cursorTo/cursorReason`）。

3. `scripts/opencode-loop/self-test.mjs`
   - 增加 focused 覆盖：`cursor: 99` 的越界恢复断言（`reason === "out_of_range"` 且恢复到安全索引）。

4. `docs/current-progress.md`
   - 追加本次增量记录与验证命令。

---

### 执行的验证命令（精确）
```bash
node scripts/opencode-loop.mjs --self-test
```

结果：`Self-test passed.`

---

如果你要，我下一步可以再做一个同级别的“单点 guardrail”增量（例如只针对 `cursor` 非整数场景补一条同样清晰的恢复日志语义），仍保持最小 diff。

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md and the primary docs.

Implement one minimal queue cursor guardrail.

Priority guidance:
- focus on one cursor edge case or recovery path
- prefer safe fallback behavior or a clearer status message
- do not redesign the queue format
- do not broaden into new scheduling logic

Choose one small focused increment, validate it minimally, and report the exact cursor behavior it protects.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

