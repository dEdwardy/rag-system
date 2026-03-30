# source-diagnostics-004

- 标题: Tighten external source diagnostics
- 状态: completed
- 代理: rag-build
- 会话: ses_2cc20f9ecffetK11XTLHbPFh3t
- 消息: msg_d33e14551001NVVsWHlqr4MHf0
- 开始: 2026-03-28 17:55:47
- 收到: 2026-03-28 17:58:27
- 完成: 2026-03-28 17:58:27

## 结果
Implemented one **minimal backend diagnostic increment** on branch `dev` and committed it.

### Chosen gap (focused)
External source execution failures at `source_fetch` had code/message/retryable, but lacked explicit structured source identity in diagnostics.  
This made failure attribution rely on parsing free-form message text.

### Concrete change
Added additive diagnostic fields on `EXTERNAL_SOURCE_FETCH_FAILED`:

- `sourceType` (e.g. `web_page`)
- `sourceName` (normalized source URL)

These are included when document context has them, so run-level and document-level failure diagnostics can directly attribute the failed source without message parsing.

### Exact files changed
1. `apps/api/src/modules/documents/documents.service.ts`
   - In `fetchExternalSourceOrRecordFailure(...)`, diagnostics now append optional `sourceType` / `sourceName`.

2. `apps/api/test/external-source-sync.test.js`
   - Updated existing web-page fetch-failure assertions to cover new fields in both:
     - persisted document failure diagnostics
     - failed run diagnostics

3. `docs/current-progress.md`
   - Added one progress entry describing this increment and validation.

### Focused validation run
```bash
pnpm test:api:file -- test/external-source-sync.test.js
```
Result: **pass** (`23/23`).

### Commit
- `7435a0d`
- Message: `fix: include source identity in external fetch failure diagnostics`

### New diagnostic signal added (exact)
For `EXTERNAL_SOURCE_FETCH_FAILED`, diagnostics now include:
- `sourceType`
- `sourceName`

Example attribution now possible directly from diagnostics:
- `sourceType: "web_page"`
- `sourceName: "https://example.com/down"`

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
Read AGENTS.md and the primary docs.

Implement one minimal diagnostic improvement for existing external source execution.

Priority guidance:
- focus on one backend visibility gap around source execution or failure attribution
- prefer better logging, status detail, or single-source error context
- do not add a new source family
- do not broaden into a connector platform rewrite

Choose one small focused increment, validate it minimally, and report the exact diagnostic signal it adds.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

