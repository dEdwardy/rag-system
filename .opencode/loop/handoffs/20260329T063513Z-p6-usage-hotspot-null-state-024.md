# p6-usage-hotspot-null-state-024

- 标题: usage hotspot null-state slice
- 状态: completed
- 代理: rag-build
- 会话: ses_2c7b40408ffeLFbUYp6GCRbg6I
- 消息: msg_d384d90ac001jWiqsBDjOYbBvT
- 开始: 2026-03-29 14:33:17
- 恢复: 2026-03-29 14:33:17
- 收到: 2026-03-29 14:35:13
- 完成: 2026-03-29 14:35:13

## 结果
已按你的要求先检查并实施最小改动，完成一次指定验证，并已提交当前增量（未 push / 未开 PR）。

### 先检查的代码路径
- `apps/web/src/pages/usage/UsagePage.tsx`
- `apps/web/test/ui-review-regressions.test.js`

### 最小实现改动
当 `issueHotspotSlice` 存在但其内部字段为 `null` 时，`issue-window slice` 面板原先可能没有任何正文。  
我做了最小 UI closeout：

- 为以下三块分别补了明确空态文案（中英）：
  - left hotspot 为空
  - right hotspot 为空
  - dominant shift 为空
- 同时加了对应 `data-testid`，保证回归守卫稳定可读。

### 精准回归守卫
在 `ui-review-regressions.test.js` 的 snapshot-window-diff 测试中新增断言，锁定：
- 新增空态 testid 存在
- 空态文案分支存在（中英之一匹配）

---

### 实际改动文件
1. `apps/web/src/pages/usage/UsagePage.tsx`
2. `apps/web/test/ui-review-regressions.test.js`

---

### 验证命令（严格按你指定的一条）
```bash
node --test apps/web/test/ui-review-regressions.test.js
```

### 该命令的实际结果
- 总计：15 tests
- 通过：12
- 失败：3
- 失败项：
  1. `knowledge base page uses a compact metric grid instead of a long side rail`
  2. `assistant copy avoids exposing backend field names and trace raw payload is secondary`
  3. `documents and trace list emphasize readable workspace summaries over sparse or overly technical cards`

> 你这次要求的 snapshot issue-hotspot 相关测试是通过的（`usage page exposes a focused snapshot window diff...` 为 ✅）。

---

### 提交信息
已在当前分支提交（仅包含上述两个文件）：

- Commit: `025b0bb`
- Message: `fix(web): keep snapshot issue-hotspot panel readable on nulls`

（工作区里原本存在的 `docs/current-progress.md`、`docs/next_steps_rag_project_plan.md` 未被本次提交带入。）

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
Inspect `apps/web/src/pages/usage/UsagePage.tsx` and `apps/web/test/ui-review-regressions.test.js` first. Then make the smallest web-side closeout change so the existing snapshot issue-hotspot panel stays stable and readable when backend `issueHotspotSlice` returns null hotspots or null dominant shift. Prefer a focused UI regression guard and only add the smallest matching null-state wording/rendering if the current page is ambiguous; do not change backend contracts, query shape, or broaden the dashboard. Run exactly one focused validation command: `node --test apps/web/test/ui-review-regressions.test.js`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

