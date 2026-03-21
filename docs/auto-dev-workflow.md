# Auto Dev Workflow

## Goal

Use a repeatable low-context workflow to let Codex continuously advance the repository one task at a time, while keeping scope controlled, tests reliable, docs current, and commits clean.

## Core Rules

1. `docs/current-progress.md` is the only task entry.
2. In each session, complete only the first `[ ]` unchecked item in order.
3. Prefer backend / API unless the current task clearly requires frontend work.
4. Do not revert or overwrite existing uncommitted user changes.
5. Before non-trivial work, always read:
   - `README.md`
   - `docs/current-dev-setup.md`
   - `docs/current-progress.md`
   - `docs/phase-1-rag-blueprint.md`
6. If the task has no related spec / plan in `docs/superpowers/specs/` or `docs/superpowers/plans/`, create them first using the superpowers workflow.
7. Run the smallest sufficient validation first; run broader validation when the change touches shared or critical paths.
8. Update docs incrementally when behavior, workflow, setup, or progress changes.
9. Commit and push after validation passes.
10. At the end of every session, output a copy-paste-ready handoff summary for the next new chat.

## Session Start Checklist

1. Run `git status --short`.
2. Read the required repo docs.
3. Use `docs/current-progress.md` as the single source of truth.
4. Find the first `[ ]` unchecked item.
5. Treat that item as the only task for the session.
6. Check whether related spec / plan files already exist.
7. Inspect directly related backend/API code and tests.
8. If spec / plan is missing, create it before implementation.
9. Follow TDD for behavior changes.

## Scope Control

### Allowed

- Finish one task end-to-end:
  - analysis
  - spec / plan
  - implementation
  - validation
  - docs update
  - commit
  - push

### Not Allowed

- Picking a later task because it feels easier
- Combining multiple unchecked tasks in one session
- Refactoring unrelated areas
- Rewriting docs broadly when only incremental updates are needed
- Touching user-owned uncommitted changes

## Validation Policy

Start with focused validation:
- file-level or module-level tests
- focused integration tests
- relevant build/typecheck

Escalate to broader validation when needed:
- shared infra changed
- schemas changed
- prompt / retrieval / ask main path changed
- multiple modules were affected

Common commands:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/<focused>.test.js
node --test --test-concurrency=1 apps/api/test/<integration>.test.js
pnpm test:api
```

## Docs Policy

Always keep these current when relevant:
- `docs/current-progress.md`
- `docs/current-dev-setup.md`

When a task needs superpowers design/planning docs:
- add spec under `docs/superpowers/specs/`
- add plan under `docs/superpowers/plans/`

Update docs incrementally, not by rewriting unrelated sections.

## Commit Policy

Only commit files related to the current task.

Before commit:
1. check `git status --short`
2. confirm user-owned unrelated changes are excluded
3. stage only task-specific files

Commit message style:
- `feat: ...`
- `fix: ...`
- `refactor: ...`

## Parallel Work Policy

Parallelize only when it reduces risk and does not blur ownership.

Good parallel work:
- reading related code and tests
- checking docs while inspecting implementation
- bounded independent analysis subtasks

Avoid parallel implementation when:
- files overlap heavily
- one result depends tightly on another
- the task is small enough to finish cleanly inline

## Stop-And-Ask Conditions

Pause instead of continuing automatically when:
- the task is materially ambiguous
- the next action conflicts with user uncommitted changes
- the next action is destructive or high-risk
- multiple valid implementation directions have non-obvious consequences

## End Of Session Output

Every session should end with:

1. Identified task
2. What changed
3. Commands run and results
4. Docs updated
5. Commit hash
6. Push result
7. A ready-to-paste handoff block for the next new chat

## Standard Next-Chat Handoff Template

```text
先严格遵守仓库根目录 AGENTS.md，并使用 superpowers 流程。

仓库：d:\FeProjects\rag-system

执行要求：
1. 查看 `git status --short`
2. 阅读：
   - `README.md`
   - `docs/current-dev-setup.md`
   - `docs/current-progress.md`
   - `docs/phase-1-rag-blueprint.md`
3. 以 `docs/current-progress.md` 为唯一任务入口
4. 自动定位当前推荐下一步
5. 按顺序寻找第一个 `[ ]` 未完成项，作为本次会话唯一任务
6. 检查 `docs/superpowers/specs/` 和 `docs/superpowers/plans/` 是否已有该任务相关文档
7. 检查与当前任务直接相关的 backend / API 代码与测试
8. 如果没有相关 spec / plan，先按 superpowers 流程补齐再执行
9. 优先做 backend / API，除非当前任务明确需要前端
10. 不要回滚用户已有未提交改动
11. 本轮结束时，必须额外输出一段“下一个 new chat 可直接粘贴的续接摘要”

允许你在单个任务内使用 sub-agents 并行分析/实现，但仍然一次只完成一个 `docs/current-progress.md` 任务。

下面是续接摘要：
```
