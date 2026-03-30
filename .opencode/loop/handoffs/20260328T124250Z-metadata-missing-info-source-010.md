# metadata-missing-info-source-010

- 标题: stabilize missing-info source labels
- 状态: completed
- 代理: rag-build
- 会话: ses_2cb8acee8ffeeC0TNr9lfcQ17v
- 消息: msg_d3477ad00001dq9d16HjlZfHQd
- 开始: 2026-03-28 20:39:48
- 收到: 2026-03-28 20:42:50
- 完成: 2026-03-28 20:42:50

## 结果
已按你要求直接实施一个最小增量，并完成一次聚焦验证与提交（当前分支 `dev`）。

### 我先检查的相关代码路径
- `apps/api/src/modules/traces/traces.service.ts`
- `packages/shared/src/trace-contracts.ts`
- `apps/api/test/traces.service.test.js`
- `apps/web/test/trace-summary-contract.test.js`
- 文档对齐：`docs/current-dev-setup.md`、`docs/current-progress.md`

### 选择并实现的最小可读性改进
**改进点：** 为 final answer trace 的 missing-information 来源新增可读标签字段。  
**新增字段：** `traceSummary.missingInformationSourceReadabilityLabel: string`

这是一项 **additive + behavior-preserving** 改动：
- 不改 retrieval 执行语义
- 不改 source 执行逻辑
- 不改持久化/schema
- 仅增强 trace readability

### 具体改动文件
1. `packages/shared/src/trace-contracts.ts`
   - `TraceSummary` 新增字段：
     - `missingInformationSourceReadabilityLabel: string`

2. `apps/api/src/modules/traces/traces.service.ts`
   - 生成并填充 `missingInformationSourceReadabilityLabel`
   - 新增 helper：`buildMissingInformationSourceReadabilityLabel(...)`
   - 映射可读文案：
     - `none` -> `no missing-information items`
     - `model` -> `model-reported missing-information items`
     - `deterministic_default` -> `backend deterministic missing-information defaults`
     - `suppressed_by_policy` -> `suppressed by includeMissingInformation policy`
     - 未知原始值 -> `unknown missing-information source (<raw>)`
     - 缺失 -> `unknown missing-information source`

3. `apps/api/test/traces.service.test.js`
   - 更新两处基线 `traceSummary` 预期对象（新增字段）
   - 增加 legacy fallback 断言，确保 source 缺失时文案为 `unknown missing-information source`

4. `apps/web/test/trace-summary-contract.test.js`
   - 增加 shared contract 守卫断言：
     - `missingInformationSourceReadabilityLabel: string`

5. `docs/current-dev-setup.md`
   - trace-summary 字段清单补入 `missingInformationSourceReadabilityLabel`

6. `docs/current-progress.md`
   - 追加本次增量记录（改动范围 + 验证命令）

### 执行的聚焦验证（exact command）
```bash
pnpm --filter @rag-system/api test:file -- test/traces.service.test.js
```
结果：**通过**（`26 passed`）。

### 提交信息
- 分支：`dev`
- Commit: `aedf0f8`
- Message: `fix: add trace missing-information source readability label`

### Push / PR
按你的要求，本次仅完成本地提交；**未 push，未发 PR**。

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

Implement one minimal missing-information source readability improvement for the final answer trace.

Priority guidance:
- keep the change additive and behavior-preserving
- prefer `missingInformationSource`, `insufficientContextReason`, or related shared-contract clarity
- do not change retrieval execution semantics
- do not reopen UI refactor or broad source-platform work

Choose one small gap that makes the final answer trace easier to read, validate it minimally, and report exact files plus commands.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

