# metadata-answer-provenance-006

- 标题: tighten answer provenance wording
- 状态: completed
- 代理: rag-build
- 会话: ses_2cbae2ddffferlEEA3JesLeDr2
- 消息: msg_d3453f878001ddbome7w4MhBHJ
- 开始: 2026-03-28 20:01:10
- 收到: 2026-03-28 20:03:52
- 完成: 2026-03-28 20:03:52

## 结果
已按你的执行模式完成 **1 个最小增量**，并已提交到当前 `dev` 分支（未 push、未开 PR）。

### 本次选择的最小缺口（answer provenance 可读性）
在 `traceSummary` 中新增一个 **additive** 字段：

- `answerProvenanceReadabilitySentence: string`

它把现有的可读标签拼成一行，便于快速读 final answer provenance（不改检索语义）：
- answer text source（readability label）
- answer status source（readability label）
- answer attribution readability sentence

---

### 先检查的相关代码路径
- `packages/shared/src/trace-contracts.ts`
- `apps/api/src/modules/traces/traces.service.ts`
- `apps/api/test/traces.service.test.js`
- `apps/web/test/trace-summary-contract.test.js`
- `docs/current-dev-setup.md`

---

### 实际改动文件
1. `apps/api/src/modules/traces/traces.service.ts`  
   - 新增 `buildAnswerProvenanceReadabilitySentence(...)`
   - 在 `buildTraceSummary(...)` 里产出 `answerProvenanceReadabilitySentence`
2. `packages/shared/src/trace-contracts.ts`  
   - `TraceSummary` 新增 `answerProvenanceReadabilitySentence: string`
3. `apps/api/test/traces.service.test.js`  
   - 更新基线断言与 legacy fallback 断言，覆盖新字段
4. `apps/web/test/trace-summary-contract.test.js`  
   - 增加 shared contract 字段守卫
5. `docs/current-dev-setup.md`  
   - traceSummary 字段清单补齐新字段
6. `docs/current-progress.md`  
   - 记录本次增量与验证命令

---

### 运行的验证命令（focused）
```bash
pnpm --filter @rag-system/api test:file -- test/traces.service.test.js
```
结果：通过（`26/26`）。

---

### 提交信息
- Commit: `c81827d`
- Message: `fix: add trace answer provenance readability sentence`

当前状态：`dev` 分支，ahead 远端，已完成本增量提交。

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

Implement one minimal answer provenance readability improvement for the final answer trace.

Priority guidance:
- keep the change additive and behavior-preserving
- prefer answer provenance, `traceSummary`, or shared-contract read-model clarity
- do not change retrieval execution semantics
- do not reopen UI refactor or broad source-platform work

Choose one small gap that makes the final answer provenance easier to read, validate it minimally, and report exact files plus commands.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

