# auth-local-web-login-042

- 标题: auth local web login
- 状态: completed
- 代理: rag-build
- 会话: ses_2c7144e79ffemQAa0BJM0UYpbZ
- 消息: msg_d38edf9ae001jKsMTkVzMy5SOQ
- 开始: 2026-03-29 17:27:43
- 恢复: 2026-03-29 17:27:43
- 收到: 2026-03-29 17:30:29
- 完成: 2026-03-29 17:30:29

## 结果
已按你要求执行：先检查相关代码路径，再做最小改动，并跑了**仅一条**指定验证命令。

### 已检查的代码路径
- `.opencode/plan/auth-roadmap-local-oidc-github-google.md`
- `apps/web/src/pages/auth/LoginPage.tsx`
- `apps/web/src/features/api/hooks.ts`
- 当前 auth bootstrap / 路由守卫：
  - `apps/web/src/app/App.tsx`（`AuthStateBootstrap -> useAuthMe()`）
  - `apps/web/src/app/AuthenticatedAppShell.tsx`（401/未登录跳转 `/login`）
  - `apps/web/src/app/router.tsx`

结论：前端登录页和 `useLogin` 仍是 `userId` 口径；但 backend `/auth/login` 已是 `email + password`。`/auth/me + session cookie` 的 bootstrap 流已存在且可保持不变。

---

### 最小实现改动（Phase 1 web increment）
1. `apps/web/src/pages/auth/LoginPage.tsx`
   - 将 `userId` 输入改为 `email` + `password`
   - 提交 payload 改为：
     - `email: email.trim()`
     - `password`
   - 保留 `/auth/me` 登录态判断与成功后跳转逻辑不变
   - 增加轻量占位按钮（禁用态，不接入流程）：
     - `Continue with GitHub (coming soon)`
     - `Continue with Google (coming soon)`

2. `apps/web/src/features/api/hooks.ts`
   - `useLogin` 请求体从 `{ userId?: string }` 改为 `{ email: string; password: string }`
   - `POST /auth/login` body 直接发送该 payload
   - `onSuccess` 后继续仅做 `AUTH_ME_QUERY_KEY` 失效，保持 auth 状态中心仍是 `/auth/me`

> 未接入 GitHub/Google 实际登录流程，仅保留禁用占位按钮，符合本项范围。

---

### 精确验证命令（按你指定，仅一条）
```bash
pnpm --filter @rag-system/web test:smoke
```

### 精确结果
- **失败**（Exit status 1）
- 关键报错：
  - `Error: API health did not become ready at http://127.0.0.1:3000/health within 30000ms.`
- 说明：失败原因是 smoke 运行时本地 API 未在超时内就绪，不是本次改动触发的前端编译/类型错误。

---

### Git 提交
已在当前分支提交本增量（未包含无关文件）：

- **commit**: `80959e7`
- **message**: `auth: align web login with email-password contract`
- **committed files**:
  - `apps/web/src/pages/auth/LoginPage.tsx`
  - `apps/web/src/features/api/hooks.ts`

当前仍有未提交变更（非本次改动）：
- `docs/current-progress.md`（已保留未纳入本次提交）

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
Inspect `apps/web/src/pages/auth/LoginPage.tsx`, `apps/web/src/features/api/hooks.ts`, the current auth bootstrap flow, and `.opencode/plan/auth-roadmap-local-oidc-github-google.md` first. Then implement the smallest Phase 1 web increment that switches the login page from `userId` input to `email + password`, aligns the `useLogin` request payload with the backend contract, and keeps frontend auth state centered on `/auth/me` plus the existing session cookie. You may leave lightweight placeholder provider buttons only if they stay clearly inactive; do not wire GitHub/Google flows in this item. Run exactly one focused validation command: `pnpm --filter @rag-system/web test:smoke`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

