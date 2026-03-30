# planner-auto-refill

- 会话: ses_2c6a3ef6cfferskevUm6ioNWDL
- 消息: msg_d395cb0b9001i3SABZi5V4BUCR
- 完成: 2026-03-29 19:31:26
- 生成任务数: 2

## 生成任务
- contract-auto-032: oidc controller parity guard
- contract-auto-033: oidc login entry parity

## 规划结果
[
  {
    "title": "oidc controller parity guard",
    "family": "contract",
    "agent": "rag-build",
    "prompt": "Continue the just-finished real OIDC wave with one backend-first closeout guard only. First inspect `apps/api/test/auth-provider-boundary.test.js`, `apps/api/src/modules/auth/auth.controller.ts`, and the recent OIDC start/callback paths in `apps/api/src/modules/auth/auth.service.ts`. Then make the smallest concrete change to lock controller-level OIDC parity with the already-landed GitHub/Google flows: add focused regression coverage for `GET /auth/oauth/oidc/start` redirect + state-cookie behavior and `GET /auth/oauth/oidc/callback` cookie/session write behavior, reusing existing test patterns instead of refactoring auth code. Only touch runtime code if a tiny fix is required to satisfy the new guard. Do not expand auth UX, ACL, or provider abstractions. Run exactly one focused validation command: `pnpm test:api:file -- test/auth-provider-boundary.test.js`. Report exact changed files and the command result.",
    "model": "openai/gpt-5.4"
  },
  {
    "title": "oidc login entry parity",
    "family": "contract",
    "agent": "rag-build",
    "prompt": "Continue the same real OIDC wave with one narrow web parity increment only. First inspect `apps/web/src/pages/auth/LoginPage.tsx`, `apps/web/test/ui-review-regressions.test.js`, and `apps/web/src/types/api.ts` to confirm the current GitHub/Google login-entry pattern and existing OIDC contract mentions. Then make the smallest concrete change to surface the already-landed backend OIDC start flow on the login page, keeping the existing visual pattern and wording style; add or extend the narrowest regression guard that proves the OIDC entry is present. Also update `docs/current-progress.md` with the exact closeout note because this changes user-visible login workflow alignment. Do not redesign the page, do not add provider configuration UI, and do not touch backend auth behavior. Run exactly one focused validation command: `pnpm --filter @rag-system/web build`. Report exact changed files and the command result.",
    "model": "openai/gpt-5.4"
  }
]

## 规划提示词
```text
Planner mode: propose the next narrow queue refill only.

Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, `docs/current-dev-setup.md`, and `README.md` before proposing follow-up queue work.

Current planning bias:
- stay on one narrow mainline increment at a time
- prefer backend/API-first closeout work over new expansion
- prefer additive, behavior-preserving readability/diagnostics/contract alignment work
- do not open a new architecture track, new source family, retrieval semantic rewrite, schema/persistence redesign, or broad UI pass

When choosing the next items:
- use the latest completed queue items and handoff results as the immediate context
- continue the same wave if there is still a small concrete gap to close
- prefer tasks that name exact files or codepaths and can be finished with one focused validation command
- prefer tasks that also keep `docs/current-progress.md` aligned when behavior or workflow changes
- avoid repeating already-completed work or proposing cleanup-only chores

Return JSON array only.
Each item must be an object with:
- `title`: short concrete task title
- `family`: stable family prefix such as `trace`, `loop`, `docs`, `contract`, `embedding`, `source`
- `prompt`: execution-ready build prompt for `rag-build`
- `agent`: usually `rag-build`
- `model`: omit unless a non-default model is clearly needed

Prompt requirements:
- tell the builder to inspect the relevant code path first, then make the smallest concrete change
- name the target files, tests, or docs when they are inferable
- require exactly one focused validation command
- require reporting exact changed files and command results
- keep scope to one meaningful increment; no bundled refactors

Hard limits:
- return at most the requested number of items
- if no good next task exists, return `[]`
- do not emit markdown fences, prose, or explanations outside the JSON array

Return at most 2 items.

Current queue summary:

{
  "total": 228,
  "pending": 0,
  "completed": 228,
  "deferred": 0,
  "inProgress": 0,
  "cursor": 228
}

Recent completed queue items:

- auth-oidc-docs-sync-054: auth oidc docs sync
  result: Implemented as a **docs-only sync** after inspecting the requested paths and landed OIDC backend files. ### Inspected first (as requested) - `docs/current-dev-setup.md` - `docs/current-progress.md` - `.opencode/plan/auth-wave-real-oidc.md` - Landed OIDC/auth files: - `apps/api/src/modules/auth/oidc-oauth.provider.ts` - `apps/api/src/modules/auth/auth.service.ts` - `apps/api/src/modules/auth/auth.c
- auth-oidc-callback-flow-053: auth oidc callback flow
  result: 已完成并已提交，按你要求保持最小后端增量。 ### 本次改动文件 1. `apps/api/src/modules/auth/oidc-oauth.provider.ts` 2. `apps/api/src/modules/auth/auth.service.ts` 3. `apps/api/test/auth-provider-boundary.test.js` ### 实现结果 - 去掉了 OIDC callback 的 `NotImplemented` 路径。 - 补上 OIDC 实际 code exchange + userinfo identity 解析。 - 在 callback 中走与 GitHub/Google 一致的本地桥接流程： - `AuthIdentityLink(provider="oidc", subject=...)` - `AuthSession` 创建 #
- auth-oidc-start-flow-052: auth oidc start flow
  result: 已按你的要求执行（先检查相关代码路径，再做最小后端改动，跑 1 条 focused 验证，并完成提交）。 ### 已检查的代码路径 - `apps/api/src/modules/auth/auth.service.ts` - `apps/api/src/modules/auth/auth.controller.ts` - `apps/api/test/auth-provider-boundary.test.js` - 以及 OIDC 配置边界实现： - `apps/api/src/modules/auth/oidc-oauth.provider.ts` - `apps/api/src/modules/auth/auth.module.ts` ### 最小实现改动（仅 start flow） 将 `startOauthProvider({ provider: "oidc" })` 从显式 
```

