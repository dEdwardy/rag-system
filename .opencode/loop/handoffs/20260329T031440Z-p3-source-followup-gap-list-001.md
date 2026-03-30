# p3-source-followup-gap-list-001

- 标题: source follow-up gap list
- 状态: completed
- 代理: rag-build
- 会话: ses_2c86d9b19ffeYAlV4f7GuYDH2z
- 消息: msg_d3795e4640010QKG6GpMS9MTRF
- 开始: 2026-03-29 11:10:34
- 恢复: 2026-03-29 11:10:34
- 收到: 2026-03-29 11:14:40
- 完成: 2026-03-29 11:14:40

## 结果
已按你要求执行了一个**最小增量**（文档收口，不扩代码行为）。

### 本次改动
- **文件**：`docs/next_steps_rag_project_plan.md`
- **位置**：P3 task 1（external source family 盘点）段落
- **改动内容**：
  - 将现有 family 的后续项明确拆分为：
    - **稳定性补强（优先）**
    - **扩面候选（后置）**
  - 明确给出“**最小 follow-up gap list**”三项：
    1. `re-sync identity recovery for feed/sitemap missing full config`
    2. `sitemap nested-index + child-limit boundary policy`
    3. `web/feed partial diagnostics consistency`
  - 同时修正了该段表格的一处缩进格式一致性问题。

### 执行过的命令（精确记录）
1. `git status --short --branch`
2. `pnpm exec prettier --check "docs/next_steps_rag_project_plan.md"`（失败：仓库未安装 prettier 可执行）
3. `pnpm test:api:file -- test/external-source-sync.test.js`（执行成功但测试集有 2 个失败）
4. `pnpm test:api:file -- test/fetch-with-retry.test.js`（通过，13/13）
5. `git diff -- docs/next_steps_rag_project_plan.md`
6. `git add "docs/next_steps_rag_project_plan.md" && git commit -m "docs: split source follow-up into stabilization-first gaps" && git status --short --branch`

### 最小相关验证
- 采用了你这次任务相关的 focused backend 验证：
  - `test/external-source-sync.test.js`：**25 passed, 2 failed**
    - 失败点：`DocumentsService reindex recovers legacy feed/sitemap config when sourceConfigJson is missing`
    - 失败错误：`this.documentRunsService.markRunFailed is not a function`（测试 fake service 缺失该方法）
  - `test/fetch-with-retry.test.js`：**13/13 passed**

### 提交信息
- **commit**: `4c57511`
- **message**: `docs: split source follow-up into stabilization-first gaps`
- 当前分支状态：`dev...origin/dev [ahead 7]`

如果你要，我下一步可以按这个 gap list 直接做第 1 项的最小实现（`feed/sitemap` 在 `sourceConfigJson` 完整缺失时的 re-sync recovery），并用 `external-source-sync.test.js` 做单文件回归。

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
Review the current web page, feed, sitemap, and external re-sync source families. Separate stability gaps from expansion candidates, capture the smallest follow-up gap list, and keep the change additive and behavior-preserving.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

