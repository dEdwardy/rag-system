# auth-request-context-004

- 标题: Inject request auth context
- 状态: completed
- 代理: rag-build
- 会话: ses_2ca67692cffeZ9NboCiHpUpFap
- 消息: msg_d359ced2f001yMSiUshr1OpiJl
- 开始: 2026-03-29 01:58:05
- 恢复: 2026-03-29 01:58:05
- 收到: 2026-03-29 02:03:08
- 完成: 2026-03-29 02:03:08

## 结果
Implemented on `dev` with a minimal backend-only increment, validated, and committed.

### What changed

Injected a **stable request-level current identity** while keeping raw auth identity nullable for future ACL boundaries.

#### Files changed
1. `apps/api/src/modules/auth/auth-identity.contract.ts`
   - `RequestAuthContext` now includes:
     - `identity: AuthIdentity | null` (raw provider result)
     - `currentIdentity: AuthIdentity` (stable resolved identity)
   - Added `resolveCurrentAuthIdentity(...)` helper.
   - `resolveRequestAuthContext(...)` now resolves from request context directly (no assistant-tenant fallback).

2. `apps/api/src/modules/auth/auth-context.middleware.ts`
   - Middleware now sets both:
     - `request.authContext.identity`
     - `request.authContext.currentIdentity` (always stable via resolver)

3. `apps/api/src/modules/assistants/ask-assistant.service.ts`
   - Removed resource-coupled fallback tenant resolution (`fallbackTenantId: assistant.tenantId`).
   - Ask path now consumes request auth context as stable request identity source.

4. `apps/api/test/auth-provider-boundary.test.js`
   - Added assertions for `currentIdentity` injection in middleware.
   - Added regression test for unauthenticated default identity resolution.

5. `apps/api/test/ask-success.test.js`
   - Updated expectation to match stable default request identity tenant (`default-tenant`).

---

### Focused validation run

Commands executed:

1. `pnpm test:api:file -- test/auth-provider-boundary.test.js test/ask-success.test.js`  
   - Failed due mixed runner mode (`node:test` + vitest in one invocation), not logic failure.

2. `pnpm test:api:file -- test/auth-provider-boundary.test.js` ✅ pass

3. `pnpm test:api:file -- test/ask-success.test.js` ✅ pass

---

### Commit

- **Commit**: `35b630e`
- **Message**: `feat(api): inject stable request current identity context`
- **Branch**: `dev`
- Not pushed; PR deferred for stable wave closeout as requested.

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
Inject request-level auth context so API handlers receive a stable current identity object. Keep the scope minimal and preserve the future ACL boundary.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

