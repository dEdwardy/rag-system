# trace-wording-unify-004

- 标题: Normalize unknown fallback wording
- 状态: completed
- 代理: rag-build
- 会话: ses_2cc8b2158ffeMW7Aq4GDaJLWvN
- 消息: msg_d337661d3001Nuwy4pGyiQjkZg
- 开始: 2026-03-28 15:59:50
- 收到: 2026-03-28 16:01:40
- 完成: 2026-03-28 16:01:40

## 结果
已按你的要求直接实施了最小改动（先读文档与代码路径，再改，再做一次聚焦验证）。

### 已读取（按要求）
- `AGENTS.md`
- `docs/next_steps_rag_project_plan.md`
- `docs/current-progress.md`
- `apps/api/src/modules/traces/traces.service.ts`
- `apps/api/test/traces.service.test.js`
- （另外按仓库规范补读了）`docs/current-dev-setup.md`、`README.md`

---

### 本次实际改动

#### 1) `apps/api/src/modules/traces/traces.service.ts`
只改文案，不改语义/逻辑：

- `buildAnswerTextSourceReadabilityLabel(...)`
  - fallback 文案从  
    - `"answer text source unavailable"`  
    改为  
    - `"unknown answer text source"`

- `buildAnswerStatusSourceReadabilityLabel(...)`
  - fallback 文案从  
    - `"answer status source unavailable"`  
    改为  
    - `"unknown answer status source"`

- `buildFailedStageReadabilityLabel(...)`
  - fallback 文案从  
    - `"failed stage unavailable"`  
    改为  
    - `"unknown failed stage"`

✅ raw 值路径保持不变（仍是 `unknown ... (<raw>)`），满足“有 raw 时保留原始值”。

---

#### 2) `apps/api/test/traces.service.test.js`
同步更新了受影响断言（仅文案）：

- `"answer text source unavailable"` → `"unknown answer text source"`
- `"answer status source unavailable"` → `"unknown answer status source"`
- `"failed stage unavailable"` → `"unknown failed stage"`

---

### 聚焦验证（1条）
执行命令：
```bash
pnpm --filter @rag-system/api test:file -- test/traces.service.test.js
```

结果：
- `1` 个测试文件通过
- `26/26` 测试通过

---

### 变更文件（本次任务触达）
- `apps/api/src/modules/traces/traces.service.ts`
- `apps/api/test/traces.service.test.js`

（当前工作区还有其他历史未提交改动，但本次任务仅调整上述两处的目标文案与对应测试。）

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, and the trace summary readability code before editing.

Task: normalize unknown and fallback wording for trace readability labels.

Focus files:
- `apps/api/src/modules/traces/traces.service.ts`
- `apps/api/test/traces.service.test.js`

Rules:
- only adjust wording, not semantics
- preserve raw values when they exist
- keep the sentence style consistent with the rest of the trace read-model

Deliverable:
- unify the fallback wording for the targeted labels
- update focused tests for the wording change
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

