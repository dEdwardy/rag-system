# p5-eval-runner-hardening-011

- 标题: eval runner baseline hardening
- 状态: completed
- 代理: rag-build
- 会话: ses_2c80bcc17ffeyV52l2Pxay4oGu
- 消息: msg_d37f5dbf4001nApssx00SrKwll
- 开始: 2026-03-29 12:57:24
- 恢复: 2026-03-29 12:57:24
- 收到: 2026-03-29 12:59:25
- 完成: 2026-03-29 12:59:25

## 结果
Implemented now on current `dev` branch as one minimal backend-first increment.

### Inspected code path first
- `apps/api/scripts/run-p5-v1-eval-runner.mjs` (existing P5 runner)
- `apps/api/package.json` (script entrypoint)
- `docs/current-progress.md` (progress sync convention)

### Small concrete change made
Hardened the existing P5 runner without introducing any new eval framework:

1. **CLI ergonomics + fail-fast parsing**
   - Added support for `--option=value` style (`--base-url=...`, `--output=...`, `--quality-gate-mode=...`, `--user-id=...`)
   - Unknown flags now fail fast
   - Missing option values now fail fast
   - Invalid `--quality-gate-mode` now fails fast with explicit error

2. **Output path stability**
   - Default output dir now anchors to repo root via script location:
     - `<repo>/storage/evals/p5-v1`
   - Avoids cwd-dependent path drift

3. **Failure handling + contract edge guard**
   - Added run result contract check: `runResult.items` must be an array
   - Per-item trace fetch failure no longer aborts whole run:
     - captured as `traceFetchError` on that item
     - runner continues generating report

4. **Progress doc sync**
   - Added one minimal completion entry in `docs/current-progress.md`

### Exact touched files
- `apps/api/scripts/run-p5-v1-eval-runner.mjs`
- `docs/current-progress.md`

### Focused validation run
```bash
pnpm --filter @rag-system/api eval:runner:p5-v1 --help
```
Result: **passed** (help output includes new usage/notes).

### Commit
Committed this increment on current branch:
- `730358f`
- message: `fix(api): harden p5 eval runner cli and failure edges`

Not pushed, no PR opened (kept for stable wave closeout).

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
Harden the existing P5 eval runner around baseline execution ergonomics, failure handling, or report contract edges without expanding into human-scored baseline setup. Keep the work automation-first, do not introduce a new evaluation framework, and report the exact touched files and one focused validation command. Focus validation: pnpm --filter @rag-system/api eval:runner:p5-v1 --help
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

