# p6-web-hotspot-contract-025

- 标题: web hotspot contract null guard
- 状态: completed
- 代理: rag-build
- 会话: ses_2c7b23b6dffe9s2tpblHn2ISHU
- 消息: msg_d384e77dd001EAKf5k5bLPBtW9
- 开始: 2026-03-29 14:35:13
- 恢复: 2026-03-29 14:35:13
- 收到: 2026-03-29 14:36:09
- 完成: 2026-03-29 14:36:09

## 结果
Implemented the increment as requested (inspect → minimal change → one focused validation → commit).

### Inspected first
- `apps/web/src/types/api.ts`
- `apps/web/test/document-run-contract.test.js`

### Smallest concrete change made
I **only extended the web contract test** to explicitly lock the internal nullable shape of `issueHotspotSlice`:
- `leftHotspot: KnowledgeBaseDocumentRunIssueHotspot | null`
- `rightHotspot: KnowledgeBaseDocumentRunIssueHotspot | null`
- `dominantShift: KnowledgeBaseDocumentRunIssueHotspotShift | null`

No runtime/UI behavior changes.  
No changes to `apps/web/src/types/api.ts` were needed (type already matched).

### Exact changed files
- `apps/web/test/document-run-contract.test.js`

### Focused validation (exactly one command)
```bash
node --test apps/web/test/document-run-contract.test.js
```

### Exact command result
```text
✔ web document run types include backend failureSummary fields for list and summary responses (2.923707ms)
✔ web snapshot comparison type keeps additive sourceFamilyDeltas and issueHotspotSlice fields (0.821852ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 34.883298
```

### Commit
Committed on current branch (`dev`):
- **`8403d72`** — `test(web): lock issueHotspotSlice nullable shape`

(There are unrelated pre-existing unstaged changes in docs files that were not included in this increment.)

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
Inspect `apps/web/src/types/api.ts` and `apps/web/test/document-run-contract.test.js` first. Then make the smallest web contract guard increment so snapshot comparison coverage explicitly locks the internal nullability shape of `issueHotspotSlice`, especially `leftHotspot`, `rightHotspot`, and `dominantShift` remaining presentable as nullable additive fields without drift. Prefer extending the contract test and only touch web types if the test exposes a real mismatch; do not change runtime UI behavior. Run exactly one focused validation command: `node --test apps/web/test/document-run-contract.test.js`. Report the exact changed files and the exact command result.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

