# auth-web-bootstrap-010

- 标题: Web auth bootstrap
- 状态: completed
- 代理: rag-build
- 会话: ses_2ca4dfc3fffeI4sgsByP3jrgu8
- 消息: msg_d35b5e78f001UWm5psLfHjq7jw
- 开始: 2026-03-29 02:25:52
- 恢复: 2026-03-29 02:25:52
- 收到: 2026-03-29 02:30:22
- 完成: 2026-03-29 02:30:22

## 结果
Implemented ✅ — minimal web auth bootstrap + route protection is now wired to the new API contract.

### What I changed (smallest concrete increment)

**Code path inspected first**
- `apps/web/src/app/router.tsx`
- `apps/web/src/app/AppShell.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/features/api/hooks.ts`
- `apps/web/src/types/api.ts`
- Backend auth contract:
  - `apps/api/src/modules/auth/auth.controller.ts`
  - `apps/api/src/modules/auth/auth.service.ts`
  - `apps/api/src/modules/auth/auth-identity.contract.ts`

**Implemented files**
1. `apps/web/src/lib/api.ts`
   - Added `credentials: "include"` for both `apiRequest` and `apiStreamRequest` so session cookie is sent.
   - Added `ApiRequestError` with `status` to distinguish auth failures (401) in UI plumbing.

2. `apps/web/src/types/api.ts`
   - Added minimal auth contract types:
     - `AuthIdentity`
     - `AuthMeResponse`

3. `apps/web/src/features/api/hooks.ts`
   - Added minimal auth hooks:
     - `useAuthMe` (`GET /auth/me`, `retry: false`)
     - `useLogin` (`POST /auth/login`)
     - `useLogout` (`POST /auth/logout`)
   - Added scoped query key: `["auth", "me"]`

4. `apps/web/src/app/AuthenticatedAppShell.tsx` (new)
   - Bootstraps auth state from `/auth/me`
   - Redirects unauthenticated users to `/login`
   - Renders existing `AppShell` only when authenticated

5. `apps/web/src/pages/auth/LoginPage.tsx` (new)
   - Minimal login form
   - Calls `POST /auth/login`
   - Redirects to `/` on success
   - Supports empty userId for seeded default-user flow

6. `apps/web/src/app/router.tsx`
   - Added `/login` route
   - Wrapped main app route with `AuthenticatedAppShell` (route protection)

7. `docs/current-dev-setup.md`
   - Added auth bootstrap notes for web `/auth/me` + credentialed requests.

---

### Focused validation run

Command:
- `pnpm --filter @rag-system/web build`

Result:
- ✅ Passed (`tsc --noEmit && vite build` successful)

---

### Commit

Committed on current branch `dev`:

- **`16ad2f2`**
- **Message:** `feat(web): bootstrap auth session and protect app routes`

---

### Note on repo state

I committed only this increment’s files. There are unrelated pre-existing uncommitted changes in other files (docs/scripts) left untouched and uncommitted.

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
Bootstrap the web auth state from the new API contract. Keep it minimal and only add the plumbing needed for login state and route protection.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

