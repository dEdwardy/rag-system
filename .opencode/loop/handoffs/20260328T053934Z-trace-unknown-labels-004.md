# trace-unknown-labels-004

- 标题: Normalize unknown trace label wording
- 状态: completed
- 代理: rag-build
- 会话: ses_2cd0d284cffeoY9D7A7RvcP3b2
- 消息: msg_d32f44a6a001W4kCg5Y94IhB0E
- 开始: 2026-03-28 13:37:48
- 收到: 2026-03-28 13:39:34
- 完成: 2026-03-28 13:39:34

## 结果
Implemented the increment with a minimal backend-only diff after reading AGENTS + trace code path first.

### Changed files

1. **`apps/api/src/modules/traces/traces.service.ts`**
   - Tightened fallback wording for unknown/invalid metadata in:
     - `buildAnswerTextSourceReadabilityLabel(...)`
     - `buildAnswerStatusSourceReadabilityLabel(...)`
   - Behavior now:
     - Known enum values keep existing labels.
     - Missing metadata keeps existing generic labels:
       - `unknown answer text source`
       - `unknown answer status source`
     - Invalid/raw non-contract values now include diagnostic suffix (aligned with failed-stage style):
       - `unknown answer text source (<raw>)`
       - `unknown answer status source (<raw>)`
   - This is additive/readability-only; no retrieval/answering execution semantics changed.

2. **`apps/api/test/traces.service.test.js`**
   - Extended the existing invalid failed-stage test to also cover invalid answer source metadata and assert new fallback wording:
     - `unknown answer text source (provider_fallback)`
     - `unknown answer status source (legacy_inference)`
   - Also verifies the same behavior in both detail and list summary paths.

---

### Focused validation run

```bash
pnpm --filter @rag-system/api test:file -- test/traces.service.test.js
```

Result: **pass** (`23/23` tests).

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md and the relevant trace code first.

Target:
- apps/api/src/modules/traces/traces.service.ts
- apps/api/test/traces.service.test.js

Goal:
Tighten the fallback wording for unknown / partial metadata so failed-stage, answer-status-source, and answer-text-source labels read consistently. Keep the wording additive and diagnostic-only.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

