# p3-stabilization-auto-001

- 标题: p3-web-partial-run-summary-anchor-coverage
- 状态: completed
- 代理: rag-build
- 会话: ses_2c62cfa1affewzH2GVnGJXjpsR
- 消息: msg_d39d5f6580014k81p3z673JgD5
- 开始: 2026-03-29 21:40:24
- 恢复: 2026-03-29 21:40:24
- 收到: 2026-03-29 21:43:49
- 完成: 2026-03-29 21:43:49

## 结果
已按你给定范围完成最小增量（backend-only，聚焦 run-summary anchor 对 web 页面 body 诊断消息的锚点覆盖）。

### 本次改动
仅修改了 1 个文件：

- `apps/api/test/document-runs-summary.test.js`

新增了 2 个 focused 测试，锁定 summary anchor 行为：

1. `DocumentRunsService summary exposes web-page body-missing partial diagnostics in summary anchors`
2. `DocumentRunsService summary exposes web-page low body-quality partial diagnostics in summary anchors`

这两个测试都验证了：
- `latestFailure.message`
- `latestFailure.failureSummary.message`
- `latestPartialSourceFailure.message`
- `latestPartialSourceFailure.failureSummary.message`

均正确透传 web partial diagnostics message（分别是 body-missing / low body-quality 场景）。

---

### 执行的验证（严格 1 条）
按你指定命令执行：

```bash
pnpm test:api:file -- test/document-runs-summary.test.js
```

结果：通过（`1 file, 25 tests passed`）。

---

### Git 提交
已在当前分支提交（未 push）：

- Commit: `8bd7ac5`
- Message: `api: cover web partial diagnostics summary anchors`

如果你要，我下一步可以继续保持同样最小粒度，补一个“同文档后续成功/部分成功覆盖旧失败”的 web-body 场景回归（仍只动 `document-runs-summary.test.js`）。

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
Inspect the existing run-summary path before changing anything: read `apps/api/src/modules/document-runs/document-runs.service.ts` and `apps/api/test/document-runs-summary.test.js`, then confirm how `EXTERNAL_SOURCE_PARTIAL_SUCCESS` anchors are built today for `latestFailure` / `latestPartialSourceFailure`. Also spot-check the already-landed web body diagnostics shape in `apps/api/src/infra/web-page/web-page.service.ts` and the related body-quality tests in `apps/api/test/parsing.test.js` so the increment stays aligned with current P3 behavior. Then implement the smallest possible closeout increment: lock the web-page body-missing / low-body-quality partial-diagnostics behavior into document-run summary coverage, adding or adjusting code only if the summary anchor path is currently dropping useful failure context. Prefer a test-first/focused change in `apps/api/test/document-runs-summary.test.js`; touch `apps/api/src/modules/document-runs/document-runs.service.ts` only if needed to preserve the already-landed diagnostic message through the summary anchor output. Do not broaden into new source families, UI work, report-center work, or generic refactors. Run exactly one validation command: `pnpm test:api:file -- test/document-runs-summary.test.js`. In your final report, include the exact files changed and the exact validation command/result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

