# metadata-fallback-regressions-003

- 标题: legacy fallback regressions
- 状态: completed
- 代理: rag-build
- 会话: ses_2cbdb255cffek95xOQcY1h0G95
- 消息: msg_d3426bdba001xnof1RQI5H3yWZ
- 开始: 2026-03-28 19:12:03
- 收到: 2026-03-28 19:14:21
- 完成: 2026-03-28 19:14:21

## 结果
Implemented one **minimal fallback-clarity increment** on `dev` (backend-first, additive, behavior-preserving).

### What I changed

1. **Improved resolved strategy summary wording for legacy fallback traces**
   - File: `apps/api/src/modules/traces/traces.service.ts`
   - Change: in `buildStrategyReadabilityLabel(...)`, when:
     - `strategyUsedFallback === true`
     - and `fallbackReason === null`
   - it now renders:
     - `fallback: unspecified`
   - instead of:
     - `fallback: none`
   - This avoids an ambiguous trace sentence like “fallback used: yes” + “fallback: none”.

2. **Updated focused regression expectation**
   - File: `apps/api/test/traces.service.test.js`
   - Updated legacy top-level `usedFallback` case to expect:
     - `"unknown mode retrieval via original_disabled; fallback: unspecified; fallback used: yes."`

3. **Recorded increment in progress doc**
   - File: `docs/current-progress.md`
   - Added one concise progress entry with scope + validation command/result.

---

### Focused validation run

Command executed:
- `pnpm test:api:file -- test/traces.service.test.js`

Result:
- `test/traces.service.test.js (26 tests) passed`

---

### Commit

Committed on current branch `dev`:

- **Commit:** `0a23eb6`
- **Message:** `fix: clarify fallback wording when reason is missing`

No push / PR performed (kept for stable wave closeout as requested).

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

Implement one minimal fallback-clarity improvement for the resolved strategy summary.

Priority guidance:
- keep the change additive and behavior-preserving
- prefer `fallbackReason`, `usedFallback`, or similar provenance fields
- do not change retrieval execution semantics
- do not reopen UI refactor or broad source-platform work

Choose one small gap that makes fallback traces easier to read, validate it minimally, and report exact files plus commands.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

