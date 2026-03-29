# p6-comparison-null-docs-031

- 标题: document-run comparison null-contract docs sync
- 状态: completed
- 代理: rag-build
- 会话: ses_2c7a99c13ffenVinOEBa9yarH1
- 消息: msg_d3857b643001cTZYpGwLNUJ9Ak
- 开始: 2026-03-29 14:44:39
- 恢复: 2026-03-29 14:44:39
- 收到: 2026-03-29 14:46:15
- 完成: 2026-03-29 14:46:15

## 结果
Done — I followed the requested execution mode (inspect first → smallest docs-only change → one focused validation → commit).

### Inspected first
- `docs/current-dev-setup.md`
- `docs/current-progress.md`
- current document-run comparison closeout notes in:
  - `docs/next_steps_rag_project_plan.md` (queue refinement note mentioning snapshot hotspot null-state closeout)
  - existing `issueHotspotSlice` closeout entries in `docs/current-progress.md`

### Smallest docs-only increment implemented
Updated **only**:
1. `docs/current-dev-setup.md`
   - Added snapshot comparison contract note for additive `issueHotspotSlice` fields:
     - `leftHotspot`
     - `rightHotspot`
     - `dominantShift`
   - Added null/empty contract note:
     - low-signal comparisons keep keys stable with explicit `null` values (not omitted).

2. `docs/current-progress.md`
   - Added a new 2026-03-29 docs-only progress entry recording this contract alignment and its validation command.

### Focused validation (exactly one command, as requested)
Command run:
```bash
git diff --check -- docs/current-dev-setup.md docs/current-progress.md
```

Exact result:
- **no output** (passed; no diff-check issues)

### Commit
Committed on current branch (`dev`):
- **commit:** `0d239f2`
- **message:** `docs: align issueHotspotSlice null-state snapshot contract`
- files in commit:
  - `docs/current-dev-setup.md`
  - `docs/current-progress.md`

Note: `docs/next_steps_rag_project_plan.md` was already modified before this increment and was intentionally not included in this commit.

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
Inspect `docs/current-dev-setup.md`, `docs/current-progress.md`, and the current document-run comparison closeout notes first. Then make the smallest docs-only increment to record the now-validated snapshot comparison null/empty contract for `issueHotspotSlice`, including that low-signal comparisons keep additive keys stable with explicit null values. Keep scope to documentation alignment only; do not change backend/web runtime behavior. Run exactly one focused validation command: `git diff --check -- docs/current-dev-setup.md docs/current-progress.md`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

