# auth-local-backend-041

- 标题: auth local login backend
- 状态: completed
- 代理: rag-build
- 会话: ses_2c7186782ffeBRU1chJ0DvD0f0
- 消息: msg_d38eb7435001HE86EiOnmC3jyx
- 开始: 2026-03-29 17:23:15
- 恢复: 2026-03-29 17:23:15
- 收到: 2026-03-29 17:27:43
- 完成: 2026-03-29 17:27:43

## 结果
已按你的要求执行：先检查代码路径，再做最小后端改动，并跑了**唯一一条**指定验证命令，最后已提交到当前分支（未 push / 未开 PR）。

### 已先检查的路径
- `apps/api/src/modules/auth/auth.schemas.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.constants.ts`
- `.opencode/plan/auth-roadmap-local-oidc-github-google.md`（Phase 1 / local-login 段）
- 相关测试（重点）：
  - `apps/api/test/auth-provider-boundary.test.js`
  - `apps/api/test/auth-surface-route-policy.test.js`

### 实施的最小改动（Phase 1 后端增量）
1. `POST /auth/login` 入参从 `userId` 切换为 `email + password`
2. `AuthService.login` 改为：
   - 按 `email` 查询用户
   - 要求用户存在且 `status=active`
   - 使用 `bcryptjs.compare` 校验 `passwordHash`
   - 继续沿用现有 `AuthSession` 创建与 session cookie 模型
3. 保持未改：
   - `/auth/me`
   - `/auth/logout`
   - `/auth/permissions/check`
   - owner-only ACL 语义
4. 聚焦补测 login 成功/失败边界（wrong password / missing user / inactive user）

### 精确改动文件
- `apps/api/src/modules/auth/auth.schemas.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/test/auth-provider-boundary.test.js`
- `apps/api/package.json`（新增 `bcryptjs`）
- `pnpm-lock.yaml`

### 验证（严格按你指定，仅此一条）
命令：
```bash
pnpm test:api:file -- test/auth-provider-boundary.test.js
```

结果：
- 通过（`pass 18, fail 0`）
- 其中新增/更新的登录成功与失败边界测试均通过

### 提交信息
- 分支：`dev`
- Commit: `4ff7e39`
- Message: `auth: switch login to email-password credentials`

（工作区仍有一个你之前已有的未提交文件：`docs/current-progress.md`，我没有将其纳入本次提交。）

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
Inspect `apps/api/src/modules/auth/auth.schemas.ts`, `apps/api/src/modules/auth/auth.controller.ts`, `apps/api/src/modules/auth/auth.service.ts`, `apps/api/src/modules/auth/auth.constants.ts`, the local-login sections of `.opencode/plan/auth-roadmap-local-oidc-github-google.md`, and the relevant auth tests first. Then implement the smallest backend Phase 1 increment that changes `POST /auth/login` from `userId` login to `email + password` login while preserving the current session-cookie model, `/auth/me`, `/auth/logout`, `/auth/permissions/check`, and owner-only ACL semantics. Add or update focused backend tests for login success and failure edges. Keep scope narrow: do not add signup, password reset, provider login, or `AuthIdentityLink` in this item. Run exactly one focused validation command: `pnpm test:api:file -- test/auth-provider-boundary.test.js`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

