# p5-regression-contract-012

- 标题: retrieval regression report contract
- 状态: completed
- 代理: rag-build
- 会话: ses_2c809f322ffetLcWhCuSj3bs4Q
- 消息: msg_d37f97f42001A4SYjdjphQHffr
- 开始: 2026-03-29 12:59:25
- 恢复: 2026-03-29 12:59:25
- 收到: 2026-03-29 13:03:28
- 完成: 2026-03-29 13:03:28

## 结果
已按要求直接实施最小增量，并完成一次 focused validation。

### 先检查的相关代码路径
- `apps/api/src/modules/eval-question-sets/eval-question-sets.service.ts`
- `apps/api/test/eval-question-sets.service.test.js`

### 最小改动（仅收紧 report contract，不扩指标）
1. **稳定导出时间字段**
   - 文件：`apps/api/src/modules/eval-question-sets/eval-question-sets.service.ts`
   - 改动：`reportPayload.exportedAt` 从 `new Date().toISOString()` 改为 `runResult.finishedAt.toISOString()`
   - 目的：减少报告导出时额外时钟漂移，提升 rerun 对比可读性（结构/语义不变）。

2. **补齐回归合同守卫（focused regression tests）**
   - 文件：`apps/api/test/eval-question-sets.service.test.js`
   - 改动：
     - 新增 JSON report 顶层 key 顺序与 item key 顺序断言；
     - 断言 `exportedAt === finishedAt.toISOString()`；
     - 锁定 markdown 表头结构；
     - 锁定现有 trace-derived 信号在 report export 中的输出（`topRegressionReasons`、`failureDrilldown`）。
   - 范围：仅结构与现有信号守卫，不新增 metric family，不引入人工判读层。

3. **进度文档同步**
   - 文件：`docs/current-progress.md`
   - 记录本次最小增量与验证命令。

---

### Focused validation（按你指定）
执行命令：
```bash
pnpm test:api:file -- test/eval-question-sets.service.test.js
```
结果：**通过（15 passed, 0 failed）**

---

### 提交信息
已在当前分支 `dev` 提交：

- **commit**: `4991e82`
- **message**: `fix(api): stabilize p5 report export contract`

---

### 本次实际触达文件（exact）
- `apps/api/src/modules/eval-question-sets/eval-question-sets.service.ts`
- `apps/api/test/eval-question-sets.service.test.js`
- `docs/current-progress.md`

（工作区中已有的 `opencode.jsonc` 变更未纳入本次提交。）

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.
Commit each completed increment on the current branch, but keep push and PR decisions for a stable wave closeout point after validation is green.
Prefer `dev` for backend work unless the task explicitly requires a different branch transition.

Repository build policy:
基于已确认的最小计划执行实现。先检查相关代码路径和现有模式，再做最小具体改动。优先 backend-first、小步增量、快验证；运行一个最相关验证，并明确报告改动文件和验证命令；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。若需求不清晰或存在冲突，不要猜；直接 fail fast 并报告不确定点。

Task:
Tighten the retrieval regression report contract so the current report outputs stay stable and reviewable across reruns. Keep the scope on report structure and existing trace-derived signals, do not expand into new metrics families or human judgment layers, and report the exact touched files and one focused validation command. Focus validation: pnpm test:api:file -- test/eval-question-sets.service.test.js
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

