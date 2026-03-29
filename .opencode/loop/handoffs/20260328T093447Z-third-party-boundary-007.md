# third-party-boundary-007

- 标题: Document third-party boundaries
- 状态: completed
- 代理: rag-build
- 会话: ses_2cc35c461ffeXTCdE3bTqj2Rw3
- 消息: msg_d33cb9dbf001eUI2oSgX4jE9lU
- 开始: 2026-03-28 17:33:04
- 收到: 2026-03-28 17:34:47
- 完成: 2026-03-28 17:34:47

## 结果
已按要求完成最小增量实现（已先阅读指定文档，再编辑，再做快验证，并已提交 commit）。

### 变更文件
1. `README.md`
   - 新增 `## Product core vs replaceable integrations`
   - 明确：
     - 核心（不可随意漂移）：orchestration、trace/read-model、fallback、regression contracts/tests
     - 可替换层：模型/embedding、向量后端、chunking/parsing、external source connectors、eval/diagnostics
     - 实操规则：替换集成层时优先保持 ask/trace 契约与 fallback 语义稳定

2. `docs/current-dev-setup.md`
   - 在 `## Current implementation scope` 下新增边界提示
   - 给贡献者一个可立即使用的判定标准（core vs replaceable layers）

3. `docs/next_steps_rag_project_plan.md`
   - 新增 `### 边界说明：产品核心 vs 第三方集成`
   - 强调“不把换 provider 扩展成架构改造任务”，保持 behavior-preserving

### 执行命令（精确）
```bash
git status --short --branch
git diff --check -- "README.md" "docs/current-dev-setup.md" "docs/next_steps_rag_project_plan.md"
git status --short --branch
git diff -- README.md docs/current-dev-setup.md docs/next_steps_rag_project_plan.md
git log -5 --oneline
git add README.md docs/current-dev-setup.md docs/next_steps_rag_project_plan.md && git commit -m "docs: clarify core vs integration boundary" && git status --short --branch
```

### 聚焦验证
- `git diff --check -- "README.md" "docs/current-dev-setup.md" "docs/next_steps_rag_project_plan.md"`  
  - 结果：通过（无格式问题）

### 提交结果
- Commit: `5ac2071`
- Message: `docs: clarify core vs integration boundary`
- Branch 状态：`dev`，`ahead 1`（未 push，符合你的 closeout 策略）

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
Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, `README.md`, and `docs/current-dev-setup.md` before editing.

Task: document the boundary between product core and third-party integrations.

Focus files:
- `README.md`
- `docs/current-dev-setup.md`
- `docs/next_steps_rag_project_plan.md`

Rules:
- make the boundary explicit and practical
- describe which layers are replaceable and which are core
- do not widen into a new architecture proposal

Deliverable:
- add or refine a short boundary note that future contributors can use immediately
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

