# auth-github-web-login-047

- 标题: auth github web login
- 状态: completed
- 代理: rag-build
- 会话: ses_2c6ecc47effehRU3nfb5Jyn7cJ
- 消息: msg_d39152d99001fd4NZy7dwH5prI
- 开始: 2026-03-29 18:10:54
- 恢复: 2026-03-29 18:10:54
- 收到: 2026-03-29 18:13:17
- 完成: 2026-03-29 18:13:17

## 结果
Implemented the requested **smallest Phase 3 web increment** after inspecting the required code path and plan.

### Inspected first (as requested)
- `.opencode/plan/auth-roadmap-local-oidc-github-google.md`
- `apps/web/src/pages/auth/LoginPage.tsx`
- `apps/web/src/features/api/hooks.ts`
- `apps/web/src/types/api.ts`
- backend GitHub auth flow touched by web entrypoint:
  - `apps/api/src/modules/auth/auth.controller.ts`
  - `apps/api/src/modules/auth/auth.service.ts`
  - `apps/api/src/modules/auth/auth.schemas.ts`
- URL construction path on web:
  - `apps/web/src/lib/api.ts`

### Smallest concrete change made
Turned the GitHub login placeholder button into a real entry point that redirects to backend OAuth start flow, while preserving:
- email/password local login path
- session-cookie model
- `/auth/me` bootstrap model
- Google placeholder remains unchanged (still disabled/coming soon)

### Exact changed files
1. `apps/web/src/pages/auth/LoginPage.tsx`
   - Imported `resolveApiUrl`
   - Built GitHub start URL: `resolveApiUrl("/auth/oauth/github/start")`
   - Enabled GitHub button and wired:
     - `onClick={() => window.location.assign(githubOauthStartUrl)}`
   - Updated label from `Continue with GitHub (coming soon)` to `Continue with GitHub`

2. `apps/web/src/lib/api.ts`
   - Added exported helper:
     - `resolveApiUrl(path: string)`
   - Reused helper internally in:
     - `apiRequest`
     - `apiStreamRequest`
   - No behavior change to existing API path resolution logic

### Focused validation (exactly one command, as requested)
```bash
pnpm --filter @rag-system/web test:smoke
```

### Exact command result
- **Failed** (`Exit status 1`)
- Failure reason:
  - `API health did not become ready at http://127.0.0.1:3000/health within 30000ms.`
- Test output indicated the smoke test could not proceed because local API was not ready.

### Commit
Committed on current branch (`dev`):

- **Commit:** `8a8a404`
- **Message:** `auth(web): wire github login entry to oauth start route`

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
Inspect `apps/web/src/pages/auth/LoginPage.tsx`, the current auth hooks, any API types touched by the GitHub backend flow, and `.opencode/plan/auth-roadmap-local-oidc-github-google.md` first. Then implement the smallest Phase 3 web increment that turns the GitHub placeholder into a real entry point into the backend GitHub auth flow while preserving the existing email/password local login path, session-cookie model, and `/auth/me` bootstrap. Keep scope narrow: do not wire Google in this item, do not add frontend token handling, and do not redesign the page. Run exactly one focused validation command: `pnpm --filter @rag-system/web test:smoke`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

