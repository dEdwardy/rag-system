# p6-usage-snapshot-slice-016

- 标题: usage snapshot diff slice
- 状态: completed
- 代理: rag-build
- 会话: ses_2c7ff7d20ffeux8mcWqitouXYk
- 消息: msg_d38026656001PISRTSufff9JKO
- 开始: 2026-03-29 13:10:50
- 恢复: 2026-03-29 13:10:50
- 收到: 2026-03-29 13:13:10
- 完成: 2026-03-29 13:13:10

## 结果
Implemented ✅ (small, reuse-only slice on existing snapshot comparison path).

### Inspected code path first
- `apps/web/src/pages/usage/UsagePage.tsx`
  - existing `P6 v1 snapshot window diff` panel
  - existing `useKnowledgeBaseDocumentRunComparison(... leftSinceHours: 6, rightSinceHours: 24, issueOnly: true)`
  - existing `sourceFamilyDeltas` drilldown logic
- `apps/web/test/ui-review-regressions.test.js`
  - existing `"snapshot window diff"` regression guard
- `apps/web/src/types/api.ts`
  - verified existing snapshot response shape already sufficient (no contract change needed)

### Small concrete change made
Added one extra **scan-first issue slice** in the existing snapshot diff panel (no endpoint/hook/dashboard redesign):
- New computed slice in `UsagePage.tsx`: `snapshotWindowIssueSlice`
  - compares `6h -> 24h` deltas for:
    - failed
    - boundary hits
    - retryable failures
    - non-retryable failures
  - also highlights dominant shift metric
- New UI block in same panel:
  - label: `issue-window slice` / `issue-window 切片`
  - `data-testid="snapshot-window-issue-slice"`
- Regression test updated to assert the new slice exists.

### Exact touched files
- `apps/web/src/pages/usage/UsagePage.tsx`
- `apps/web/test/ui-review-regressions.test.js`
- `docs/current-progress.md`

### Focused validation run
Command:
```bash
node --test --test-name-pattern "snapshot window diff" apps/web/test/ui-review-regressions.test.js
```

Result:
- `pass 1`
- `fail 0`

### Commit
Committed on current branch (`dev`):
- `8389740`
- message: `feat(web): add snapshot issue-window diff slice`

Note: existing unrelated local change `opencode.jsonc` was left untouched and not included in the commit.

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
Add one small usage snapshot diff slice that makes existing issue-window comparison easier to scan. Reuse the current snapshot comparison path, avoid broad dashboard redesign, and report the exact touched files and one focused validation command. Focus validation: node --test --test-name-pattern "snapshot window diff" apps/web/test/ui-review-regressions.test.js
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

