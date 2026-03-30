# metadata-retrieval-mode-fallback-009

- 标题: clarify retrieval fallback mode
- 状态: completed
- 代理: rag-build
- 会话: ses_2cb8e5252ffeNakdSUOrK5AFFH
- 消息: msg_d3474d92e001aEaN4TjAPVRLaS
- 开始: 2026-03-28 20:35:58
- 收到: 2026-03-28 20:39:48
- 完成: 2026-03-28 20:39:48

## 结果
Implemented one **minimal, additive, behavior-preserving** retrieval trace readability increment on `dev`.

### What I inspected first
- `apps/api/src/modules/traces/traces.service.ts`
- `apps/api/src/modules/retrieval/strategy-readability.ts`
- `apps/api/test/traces.service.test.js`
- `packages/shared/src/trace-contracts.ts`
- `apps/web/test/trace-summary-contract.test.js`

### Chosen small gap
Trace summary already had `strategyReadabilityLabel`, but fallback provenance around resolved retrieval mode was still packed into that one label.  
I added a dedicated additive field to make this easier to scan:

- `traceSummary.retrievalModeProvenanceSentence`

This improves retrieval-mode + fallback provenance readability without changing retrieval execution semantics.

### Exact files changed
1. `packages/shared/src/trace-contracts.ts`
   - Added `retrievalModeProvenanceSentence: string` to `TraceSummary`.

2. `apps/api/src/modules/traces/traces.service.ts`
   - Added `buildRetrievalModeProvenanceSentence(...)`.
   - Added `retrievalModeProvenanceSentence` generation from existing:
     - `retrievalMode`
     - `strategyUsedFallback`
     - `fallbackReason`
   - Included the new field in returned `traceSummary`.

3. `apps/api/test/traces.service.test.js`
   - Updated baseline deep-equality snapshots with new field.
   - Added legacy assertion for `usedFallback=true` + missing `fallbackReason` wording:
     - `"Resolved retrieval mode is unknown; fallback was used (reason unspecified)."`

4. `apps/web/test/trace-summary-contract.test.js`
   - Added contract guard assertion for `retrievalModeProvenanceSentence`.

5. `docs/current-dev-setup.md`
   - Synced trace-summary field list and example wording.

6. `docs/current-progress.md`
   - Added increment log entry for this change.

### Focused validation run (one command)
```bash
pnpm --filter @rag-system/api test:file -- test/traces.service.test.js
```
Result: **passed** (`26/26`).

### Commit
- Branch: `dev` (ahead of origin, no push performed)
- Commit: `4e32a87`
- Message: `fix: add retrieval-mode fallback provenance sentence`

No push/PR done (kept for stable wave closeout as requested).

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

Implement one minimal retrieval mode fallback provenance improvement for the trace summary.

Priority guidance:
- keep the change additive and behavior-preserving
- prefer `retrievalMode`, `strategySummary`, or fallback provenance clarity
- do not change retrieval execution semantics
- do not reopen UI refactor or broad source-platform work

Choose one small gap that makes retrieval-mode traces easier to read, validate it minimally, and report exact files plus commands.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

