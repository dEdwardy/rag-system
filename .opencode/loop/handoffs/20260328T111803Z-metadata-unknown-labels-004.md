# metadata-unknown-labels-004

- 标题: unknown/fallback wording unify
- 状态: completed
- 代理: rag-build
- 会话: ses_2cbd90969ffeIVcwMILXEcOeW5
- 消息: msg_d342a058f001HTnQQNlNQn6LWF
- 开始: 2026-03-28 19:14:21
- 收到: 2026-03-28 19:18:03
- 完成: 2026-03-28 19:18:03

## 结果
已完成这个最小增量并已提交（当前分支，未 push）。

### 本次实现（单一增量）
目标：为 ask 一次性响应和 stream final 响应新增顶层 `strategyReadabilityLabel`，并与 trace summary 的生成语义保持一致（加法改动，不改检索行为）。

#### 变更文件
1. `apps/api/src/modules/retrieval/strategy-readability.ts`  
   - 新增共享 helper：`buildStrategyReadabilityLabel(...)`  
   - 复用 trace 现有文案语义：  
     `"<mode> retrieval via <querySource>; fallback: <reason|none|unspecified>; fallback used: <yes|no|unknown>."`

2. `apps/api/src/modules/traces/traces.service.ts`  
   - 改为调用上述 helper 生成 `strategyReadabilityLabel`  
   - 删除原有私有重复实现（仅替换到同语义 helper，无行为变化）

3. `apps/api/src/modules/assistants/ask-assistant.service.ts`  
   - 在 `askAssistant` 和 `askAssistantStream` 中基于 `retrievalMetadata.strategySummary` 计算 `strategyReadabilityLabel`
   - 将该字段加入 one-shot 返回对象与 stream `final.data`

4. `apps/web/src/types/api.ts`  
   - `AskResponse` 新增可选字段：  
     `strategyReadabilityLabel?: TraceSummary["strategyReadabilityLabel"]`

5. `apps/api/test/ask-success.test.js`  
   - 增加 one-shot `strategyReadabilityLabel` 断言（2处）

6. `apps/api/test/ask-stream-service.test.js`  
   - 增加 stream final `strategyReadabilityLabel` 断言（`finalResult` 与 `events[5].data`）

---

### 最小相关验证
执行命令：
```bash
pnpm --filter @rag-system/api test:file -- test/ask-success.test.js test/ask-stream-service.test.js
```

结果：通过（2 files, 48 tests passed）

---

### 提交信息
- Commit: `9bc3407`
- Message: `fix: expose ask strategy readability label aligned with trace summary`

如果你要，我可以继续下一个同波次的最小增量（例如 fallback reason 可读性句式的进一步统一，但仍保持 additive + behavior-preserving）。

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.
Commit each completed increment on the current branch, but keep push and PR decisions for a stable wave closeout point after validation is green.
Prefer `dev` for backend work unless the task explicitly requires a different branch transition.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md and the primary docs.

Continue the current P0 read-model / metadata convergence wave with one minimal resolved-strategy clarity increment.

Scope rules:
- keep ask response, trace summary, and shared contracts aligned
- prefer additive exposure of resolved strategy, fallback reason, or provenance readability
- do not change retrieval behavior, defaults, ranking, or schema shape beyond the minimal additive contract change required
- keep validation focused

Implement only one narrow increment and clearly describe the resulting metadata/read-model surface.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

