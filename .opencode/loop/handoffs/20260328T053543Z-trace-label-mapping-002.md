# trace-label-mapping-002

- 标题: Unify ask/trace label mapping
- 状态: completed
- 代理: rag-build
- 会话: ses_2cd11dfe5ffeFjRavM2BF1Tbn2
- 消息: msg_d32f0a8aa001A5bz7z1NjNg0hI
- 开始: 2026-03-28 13:32:39
- 收到: 2026-03-28 13:35:43
- 完成: 2026-03-28 13:35:43

## 结果
已按你的要求执行：先读了 `AGENTS.md` + 计划/进度/开发文档，再在目标代码路径做了最小实现，并跑了 1 个聚焦验证。

### 已阅读文档（按要求顺序）
1. `docs/next_steps_rag_project_plan.md`
2. `docs/current-progress.md`
3. `docs/current-dev-setup.md`
4. `README.md`
（并在读取 `apps/api/src/modules/traces/traces.service.ts` 时自动触发了 `apps/api/AGENTS.md`）

---

### 代码改动（最小增量，backend-first）

#### 1) 新增共享 helper（抽取重复 label mapping）
- **新增文件**
  - `apps/api/src/modules/answering/answer-attribution-summary.ts`
- **内容**
  - 新增 `buildAnswerAttributionSummary(...)`，统一生成：
    - `attributionLabel`
    - `sourceLabel`
    - `readability`
    - `readabilityLabel`
    - `readabilityHint`
    - `readabilityResolvedLabel`
    - `readabilitySentence`

#### 2) traces 使用共享 helper
- **修改文件**
  - `apps/api/src/modules/traces/traces.service.ts`
- **改动点**
  - 引入并调用 `buildAnswerAttributionSummary(...)`
  - 用 helper 结果填充 `traceSummary.answerAttributionSummary`
  - 删除本文件内重复的 attribution/source 可读文案拼装私有方法

#### 3) ask final payload 使用同一个 helper
- **修改文件**
  - `apps/api/src/modules/assistants/ask-assistant.service.ts`
- **改动点**
  - 引入并调用 `buildAnswerAttributionSummary(...)`
  - `resolveAnswerAttributionSummary(...)` 改为直接复用共享 helper
  - 删除 ask 内部重复的 attribution/source 文案拼装方法

#### 4) 进度文档同步
- **修改文件**
  - `docs/current-progress.md`
- **改动点**
  - 增加本次收口记录（文件、范围、验证命令、结果）

---

### 聚焦验证（1 条）
执行命令：
```bash
pnpm --filter @rag-system/api test:file -- test/traces.service.test.js test/ask-success.test.js
```

结果：
- `test/ask-success.test.js` 通过
- `test/traces.service.test.js` 通过
- 总计 `46/46` 通过

---

### 范围声明
本次仅做 readability label mapping 的共享抽取与对齐，未扩展到：
- retrieval 行为语义
- schema / persistence 变更
- 无关重构

补充：当前工作区存在一个未由本次任务产生的已修改文件 `apps/web/test/trace-summary-contract.test.js`（我未改动该文件）。

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md plus the plan/progress docs first.

Target:
- apps/api/src/modules/traces/traces.service.ts
- apps/api/src/modules/assistants/ask-assistant.service.ts

Goal:
If label mapping is duplicated, extract the smallest safe shared helper so ask final payload and trace summary stay aligned on the same readability wording. Do not widen scope into retrieval behavior or schema changes.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

