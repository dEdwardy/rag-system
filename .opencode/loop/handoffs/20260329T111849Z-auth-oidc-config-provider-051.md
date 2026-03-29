# auth-oidc-config-provider-051

- 标题: auth oidc config provider
- 状态: completed
- 代理: rag-build
- 会话: ses_2c6b1bb37ffep84XQqlwpgsn7i
- 消息: msg_d39511d29001eBRL67P6K5Rb7D
- 开始: 2026-03-29 19:15:23
- 恢复: 2026-03-29 19:15:23
- 收到: 2026-03-29 19:18:49
- 完成: 2026-03-29 19:18:49

## 结果
已按你要求执行：先检查相关代码路径，再做最小后端增量，跑了**唯一一条**指定验证，并已提交当前增量（未 push / 未开 PR）。

### 本次最小增量（provider/config boundary only）
目标：为保留态 `oidc` 增加可复用 provider/config 边界，给后续真实 start/callback 流程预留最小 env/config 面；**不改**当前 `oidc` start/callback 的 `NotImplemented` 运行时语义。

#### 变更文件（精确）
1. `apps/api/src/modules/auth/oidc-oauth.provider.ts`（新增）
   - 新增 `OidcOauthProvider` 接口与 `HttpOidcOauthProvider` 实现
   - 提供：
     - `resolveStartConfig()`
     - `resolveCallbackConfig()`
   - 最小 OIDC 配置边界：
     - `AUTH_OIDC_ISSUER`
     - `AUTH_OIDC_CLIENT_ID`
     - `AUTH_OIDC_CLIENT_SECRET`
     - `AUTH_OIDC_REDIRECT_URI`
     - 可选 `AUTH_OIDC_SCOPE`（默认 `openid email profile`）
   - 生成 `discoveryUrl`：`<issuer>/.well-known/openid-configuration`
   - 缺失配置时报错文案与现有 provider 边界风格一致（start/callback 可读错误）

2. `apps/api/src/modules/auth/auth.constants.ts`
   - 新增：
     - `DEFAULT_OIDC_OAUTH_SCOPE`
     - `DEFAULT_OIDC_WELL_KNOWN_PATH`

3. `apps/api/src/modules/auth/auth.module.ts`
   - 注册 OIDC provider DI 边界：
     - `HttpOidcOauthProvider`
     - `OIDC_OAUTH_PROVIDER -> useExisting: HttpOidcOauthProvider`

4. `apps/api/test/auth-provider-boundary.test.js`
   - 新增 OIDC boundary focused tests：
     - OIDC start/callback config 解析成功路径
     - 缺失 env 的清晰失败路径（issuer 缺失 + start/callback 必填缺失）

---

### 保持不变（按你的 scope）
- `oidc` 在 `AuthService` 的 start/callback 仍是 `NotImplemented`
- 未改前端
- 未改 ACL 语义
- 未做无关重构

---

### 验证（仅一条，按要求）
**命令：**
```bash
pnpm test:api:file -- test/auth-provider-boundary.test.js
```

**结果：**
- 通过（`pass 38`, `fail 0`）

---

### 提交信息
已在当前分支 `dev` 提交：

- **commit**: `767b814b94097a946ebdcdeb45c6de0832afc26f`
- **message**: `auth: add reserved oidc config provider boundary`
- **commit 内文件**：
  - `apps/api/src/modules/auth/auth.constants.ts`
  - `apps/api/src/modules/auth/auth.module.ts`
  - `apps/api/src/modules/auth/oidc-oauth.provider.ts`
  - `apps/api/test/auth-provider-boundary.test.js`

（工作区仍有未提交的 `docs/current-progress.md` 既有改动，未纳入本次提交。）

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
Inspect `apps/api/src/modules/auth/auth.service.ts`, `apps/api/src/modules/auth/auth.constants.ts`, `apps/api/src/modules/auth/auth.module.ts`, the existing GitHub/Google provider implementations, `.opencode/plan/auth-wave-real-oidc.md`, and `apps/api/test/auth-provider-boundary.test.js` first. Then make the smallest backend-first increment that adds a reusable OIDC provider/config boundary for the existing reserved `oidc` slot, including the minimum env/config surface needed for a future real OIDC start/callback flow. Keep scope narrow: provider/config boundary only; do not yet replace the current `NotImplemented` runtime behavior for `oidc` start/callback, do not add frontend buttons, and do not reopen ACL semantics. Run exactly one focused validation command: `pnpm test:api:file -- test/auth-provider-boundary.test.js`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

