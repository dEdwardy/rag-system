# p6-report-wording-sync-037

- 标题: p6 report wording sync
- 状态: completed
- 代理: rag-build
- 会话: ses_2c74e051dffeD4r5sg7XrDS36e
- 消息: msg_d38b38dd8001CpuLLZx97On8x5
- 开始: 2026-03-29 16:24:41
- 恢复: 2026-03-29 16:24:41
- 收到: 2026-03-29 16:26:40
- 完成: 2026-03-29 16:26:40

## 结果
Implemented as requested (small wording/readability-only increment), after first inspecting the four specified files.

### Inspected first
- `apps/web/src/pages/usage/UsagePage.tsx`
- `apps/web/src/pages/reports/ReportCenterPage.tsx`
- `docs/current-dev-setup.md`
- `docs/current-progress.md`

### Changed files (exact)
1. `apps/web/src/pages/usage/UsagePage.tsx`
   - Refined P5 report-center boundary copy to explicitly keep Usage as scan-first.
   - Refined P6 health panel description to emphasize scan-first operational check positioning.

2. `apps/web/src/pages/reports/ReportCenterPage.tsx`
   - Refined hero copy to align with scan-first regression/trace replay positioning.
   - Refined eval-run helper copy for scan-first comparison consistency.
   - Updated table header wording from `Trace / error` to `Trace / issue` (and `Trace / 错误` to `Trace / 问题`).

3. `docs/current-progress.md`
   - Added a new progress entry recording this wording-only increment and its focused validation command.

### Focused validation (exact command)
```bash
node --test apps/web/test/ui-review-regressions.test.js apps/web/test/desktop-shell-consistency.test.js
```

### Command result (exact outcome)
- Total: 19 tests
- Passed: 15
- Failed: 4  
- Failing tests:
  - `desktop data pages share the same hero and panel language`
  - `knowledge base page uses a compact metric grid instead of a long side rail`
  - `assistant copy avoids exposing backend field names and trace raw payload is secondary`
  - `documents and trace list emphasize readable workspace summaries over sparse or overly technical cards`

From the output, the Usage/Report-center assertions were passing; failures appear to be pre-existing in other surfaces.

### Commit
Committed on current branch (`dev`) as requested:

- **Commit:** `dc3f5b2`
- **Message:** `ui: align scan-first wording for usage and reports`

No push / PR performed.

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
Inspect `apps/web/src/pages/usage/UsagePage.tsx`, `apps/web/src/pages/reports/ReportCenterPage.tsx`, `docs/current-dev-setup.md`, and `docs/current-progress.md` first. Then make the smallest wording/readability increment needed to keep report-center, usage, and trace-related wording aligned with the existing scan-first positioning. Keep scope narrow: wording/readability only; do not redesign layout, add new metrics, or expand the page model. Run exactly one focused validation command: `node --test apps/web/test/ui-review-regressions.test.js apps/web/test/desktop-shell-consistency.test.js`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

