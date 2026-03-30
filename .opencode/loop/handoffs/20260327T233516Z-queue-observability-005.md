# queue-observability-005

- 标题: Add one queue recovery guardrail
- 状态: completed
- 代理: rag-build
- 会话: ses_2ce5a5404ffez6u0dQ33st14K1
- 消息: msg_d31a6ca96001MwG8obm5oEbYUT
- 开始: 2026-03-28 07:33:54
- 收到: 2026-03-28 07:35:16
- 完成: 2026-03-28 07:35:16

## 结果
[]

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md and the primary docs.

Implement one minimal queue recovery guardrail for interrupted runs or stale locks.

Priority guidance:
- focus on one interrupted-run resume path or stale-lock cleanup path
- prefer safe fallback behavior or a clearer recovery message
- do not redesign the queue format
- do not broaden into new scheduling logic

Choose one small focused increment, validate it minimally, and report the exact recovery behavior it protects.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

