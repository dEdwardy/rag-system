# auth-oidc-docs-sync-054

- 标题: auth oidc docs sync
- 状态: completed
- 代理: rag-build
- 会话: ses_2c6a64584ffe2OOO0qe7iuoeXf
- 消息: msg_d395bd664001XpPvtU4X64u2sk
- 开始: 2026-03-29 19:27:54
- 恢复: 2026-03-29 19:27:54
- 收到: 2026-03-29 19:30:28
- 完成: 2026-03-29 19:30:28

## 结果
Implemented as a **docs-only sync** after inspecting the requested paths and landed OIDC backend files.

### Inspected first (as requested)
- `docs/current-dev-setup.md`
- `docs/current-progress.md`
- `.opencode/plan/auth-wave-real-oidc.md`
- Landed OIDC/auth files:
  - `apps/api/src/modules/auth/oidc-oauth.provider.ts`
  - `apps/api/src/modules/auth/auth.service.ts`
  - `apps/api/src/modules/auth/auth.controller.ts`
  - `apps/api/src/modules/auth/auth.module.ts`
  - `apps/api/src/modules/auth/auth.constants.ts`
  - `apps/api/test/auth-provider-boundary.test.js`

### Changed files
- `docs/current-dev-setup.md`
- `docs/current-progress.md`

### What was synced (narrow scope)
- Recorded that real OIDC is now landed in backend runtime:
  - `/auth/oauth/oidc/start` uses discovery `authorization_endpoint`
  - `/auth/oauth/oidc/callback` uses discovery `token_endpoint` + `userinfo_endpoint`, then `AuthIdentityLink(provider, subject)` + local `AuthSession` bridge
- Synced runtime OIDC config requirements actually used by code:
  - `AUTH_OIDC_ISSUER`
  - `AUTH_OIDC_CLIENT_ID`
  - `AUTH_OIDC_CLIENT_SECRET`
  - `AUTH_OIDC_REDIRECT_URI`
  - optional `AUTH_OIDC_SCOPE` (default `openid email profile`)
- Preserved-boundary notes explicitly kept:
  - `/auth/me` remains `{ identity, currentIdentity, loginProvenance }`
  - local session model remains (`AuthSession` + `rag_session`)
  - owner-only ACL remains unchanged (`owner_only_v1 + deny_by_default`)
- Did **not** claim frontend OIDC UX, did not reopen roadmap sequencing, did not edit runtime code.

### Focused validation (exactly one command)
Command run:
```bash
git diff --check -- docs/current-dev-setup.md docs/current-progress.md
```
Result:
- **No output** (clean; no diff-check issues)

### Commit
- Branch: `dev`
- Commit: `8af1f33`
- Message: `docs: sync landed real OIDC auth facts`

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
Inspect `docs/current-dev-setup.md`, `docs/current-progress.md`, `.opencode/plan/auth-wave-real-oidc.md`, and the landed OIDC implementation files first. Then make the smallest docs-only sync that records exactly what real OIDC facts landed in this wave, including runtime config requirements and the preserved behavior boundaries around `/auth/me`, local sessions, and owner-only ACL. Keep scope narrow: sync landed facts only; do not claim frontend OIDC UX that does not exist, do not reopen roadmap sequencing, and do not edit runtime code. Run exactly one focused validation command: `git diff --check -- docs/current-dev-setup.md docs/current-progress.md`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

