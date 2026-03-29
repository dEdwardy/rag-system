# p3-source-resync-recovery-002

- 标题: source resync recovery guards
- 状态: completed
- 代理: rag-build
- 会话: ses_2c869d7d1ffe3tfKla0D4CBg38
- 消息: msg_d37985cc60015LUSAT8SKIvuS4
- 开始: 2026-03-29 11:14:40
- 恢复: 2026-03-29 11:14:40
- 收到: 2026-03-29 11:17:16
- 完成: 2026-03-29 11:17:16

## 结果
Implemented. I inspected the existing backend code path first, then made a minimal scoped hardening change for re-sync recovery.

### What I changed

**1) Hardened legacy config recovery in re-sync path**
- **File:** `apps/api/src/modules/documents/documents.service.ts`
- **Change:** `resolveLegacyExternalSourceConfigFromDocumentIdentity(...)` now recovers config for:
  - `web_page` (existing family, now normalized URL)
  - `feed` (with default `maxItems: 20`)
  - `sitemap` (with default `maxPages: 20`)
- Recovery now normalizes `sourceName` via existing URL normalization (hash stripped).
- If legacy `sourceName` is not a valid URL, it remains unrecoverable and keeps current failure semantics (`EXTERNAL_SOURCE_CONFIG_INVALID`).

**2) Added focused regression boundary coverage**
- **File:** `apps/api/test/external-source-sync.test.js`
- **Added test:** unrecoverable legacy sitemap identity (missing config + invalid sourceName) still fails fast and does not fetch.

**3) Synced progress doc**
- **File:** `docs/current-progress.md`
- Added one scoped progress entry for this increment and its focused validation command.

---

### Focused validation run

Executed:

```bash
pnpm test:api:file -- test/external-source-sync.test.js
```

Result: **pass** (`28/28`)

---

### Commit

Committed on current branch (`dev`):

- **Commit:** `a0bd1ad`
- **Message:** `fix(documents): harden external resync config-loss recovery`

No push, no PR created (kept for stable-wave closeout as requested).

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
Harden re-sync recovery for the existing source families, especially feed and sitemap config-loss cases. Preserve current behavior where possible, add focused regression coverage for recovery boundaries, and keep the work narrowly scoped.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

