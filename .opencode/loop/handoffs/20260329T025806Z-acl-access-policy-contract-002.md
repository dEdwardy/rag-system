# acl-access-policy-contract-002

- 标题: access policy contract
- 状态: completed
- 代理: rag-build
- 会话: ses_2c87c7481ffedyIBGshVQFMXRu
- 消息: msg_d3786af2a0016DPd45WD4X9IZ9
- 开始: 2026-03-29 10:54:21
- 恢复: 2026-03-29 10:54:21
- 收到: 2026-03-29 10:58:06
- 完成: 2026-03-29 10:58:06

## 结果
Implemented on branch **`dev`** as one minimal backend-first increment, with focused validation and commit done.

### Inspected code path first
- `apps/api/src/modules/auth/resource-access-policy.contract.ts`
- `apps/api/src/modules/auth/auth-identity.contract.ts`
- `apps/api/src/modules/auth/auth.schemas.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/test/resource-access-policy.contract.test.js`
- `packages/shared/src/index.ts` (+ existing shared contract pattern via `trace-contracts.ts`)

### Smallest concrete change made
Defined a **shared ACL access-policy contract** in `@rag-system/shared` and wired API auth contract/schema to reuse it.

#### Files changed
1. **`packages/shared/src/access-policy-contracts.ts`** (new)
   - Added standardized contract for service-layer ACL decisioning:
   - `ResourceAccessPolicyInput`
   - `ResourceAccessDecision` (discriminated allow/deny)
   - `ResourceAccessDenyReason`
   - shared value arrays for actions/resource kinds/policy version/default stance

2. **`packages/shared/src/index.ts`**
   - Exported new shared ACL contract module.

3. **`apps/api/src/modules/auth/resource-access-policy.contract.ts`**
   - Reused shared contract types/constants.
   - Kept identity alignment with existing auth shape via:
     - `Pick<AuthIdentity, "tenantId" | "userId">`
   - Kept existing owner-only v1 behavior and deny reasons (no role matrix expansion).

4. **`apps/api/src/modules/auth/auth.schemas.ts`**
   - Permission-check `action` and `resource.kind` enums now reuse shared constants to prevent schema/contract drift.

5. **`docs/current-progress.md`**
   - Added progress note for this increment with scope + validation command.

---

### Focused validation run
Command:
```bash
pnpm test:api:file -- test/resource-access-policy.contract.test.js
```

Result:
- **Passed** (`6/6`)

---

### Commit
Committed on current branch (`dev`) with hash:

- **`0558425`**
- Message: **`feat(acl): share owner-only access policy contract`**

No push/PR performed (kept for stable wave closeout as requested).

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
Define the smallest shared access-policy contract for ACL decisions. Standardize the inputs, outputs, and deny reasons for service-layer permission checks, and keep the contract aligned with the existing auth identity shape without adding a role matrix.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

