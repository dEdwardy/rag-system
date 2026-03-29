# opencode-loop-prompt-template-007

- 标题: Add read-model loop prompt template
- 状态: completed
- 代理: rag-build
- 会话: ses_2cd0879caffe1Ar2n15AgrphI6
- 消息: msg_d32f97788001DCd80mZgQ5eU49
- 开始: 2026-03-28 13:42:55
- 收到: 2026-03-28 13:45:11
- 完成: 2026-03-28 13:45:11

## 结果
Implemented — I inspected the loop prompt path first, then made the smallest scoped increment.

### Changed files

1. **`scripts/opencode-loop.md`**  
   - Updated queue example to use a metadata-specific prompt:
     - `promptFile: "prompts/read-model-metadata.md"`
     - example title now matches metadata task intent.
   - Added a new **Prompt Family Guidance** section:
     - `prompts/build.md` for generic build increments
     - `prompts/build-small-increment.md` for loop harness/runtime maintenance
     - `prompts/read-model-metadata.md` for read-model / metadata convergence tasks
   - Explicitly states metadata queue items should prefer the metadata prompt over generic build prompt.

2. **`.opencode/loop/prompts/read-model-metadata.md`** (new template)
   - Added dedicated prompt template for read-model / metadata tasks:
     - one minimal convergence increment
     - no retrieval behavior/schema/source-family expansion
     - one focused validation + exact change reporting

---

### Focused validation run

```bash
git diff --check -- ".opencode/loop/prompts/read-model-metadata.md" "scripts/opencode-loop.md"
```

Result: **no diff-check issues**.

---

### Exact inspection / verification commands executed

```bash
git status --short
git check-ignore -v ".opencode/loop/prompts/read-model-metadata.md"
```

Note: `.opencode/...` is ignored by repo `.gitignore` (`.opencode/`), so the new prompt template is a local harness file (expected for this path).

## 提示词
```text
Execution mode: implement the requested repository increment now.
Do not stop at search-only or analysis-only output.
First inspect the relevant code path, then make the smallest concrete change, run one focused validation, and report exact files and commands.

Repository build policy:
基于已确认的最小计划执行实现。优先 backend-first、小步增量、快验证；不做无关重构。TDD 不是默认流程，仅在行为语义、共享契约、source recovery 等改动时启用 light TDD。

Task:
Read AGENTS.md and scripts/opencode-loop.md first.

Target:
- .opencode/loop/prompts/
- scripts/opencode-loop.md

Goal:
Add a dedicated prompt template or task-family guidance for read-model / metadata tasks so queue items stop reusing the generic build prompt. Keep the harness narrow.
```

## 备注
- The loop creates a fresh OpenCode session for new work items.
- Some OpenCode server builds may return 200 with an empty /session/:id/message body; this loop falls back to GET /session/:id/message and uses the latest assistant message.

