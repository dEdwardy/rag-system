# Auto Dev Workflow

> 文档角色：`workflow`
> 当前使用方式：这是执行流程文档；当前阶段的任务优先级和 review 策略仍以 `docs/next_steps_rag_project_plan.md` 为主。

## Goal

Use a repeatable low-context workflow to let Codex continuously advance the repository one task at a time, while keeping scope controlled, tests reliable, docs current, and commits clean.

## Current Authority

At the current stage, `docs/next_steps_rag_project_plan.md` is the primary planning and execution guidance document.

Use the docs in this order:

1. `docs/next_steps_rag_project_plan.md`
2. `docs/current-progress.md`
3. `docs/current-dev-setup.md`
4. `README.md`
5. `docs/phase-1-rag-blueprint.md`

Interpretation:

- `docs/next_steps_rag_project_plan.md` defines the current priority order, superpowers usage style, and AI review policy
- `docs/current-progress.md` records implementation status and completed/incomplete items
- if the two differ, follow `docs/next_steps_rag_project_plan.md` for the current-stage execution decision, then update the progress doc accordingly

## Core Rules

1. `docs/next_steps_rag_project_plan.md` is the primary task-direction entry for the current stage.
2. Use `docs/current-progress.md` as the status-tracking companion document, not the sole authority on current-stage priority.
3. In each session, complete only one clearly bounded task aligned with `docs/next_steps_rag_project_plan.md`.
4. Prefer backend / API unless the current task clearly requires frontend work.
5. Do not revert or overwrite existing uncommitted user changes.
6. Before non-trivial work, always read:
   - `docs/next_steps_rag_project_plan.md`
   - `README.md`
   - `docs/current-dev-setup.md`
   - `docs/current-progress.md`
   - `docs/phase-1-rag-blueprint.md`
7. If the task has no related spec / plan in `docs/superpowers/specs/` or `docs/superpowers/plans/`, create them first using the superpowers workflow.
8. Run the smallest sufficient validation first; run broader validation when the change touches shared or critical paths.
9. Update docs incrementally when behavior, workflow, setup, or progress changes.
10. Commit and push after validation passes.
11. At the end of every session, output a copy-paste-ready handoff summary for the next new chat.

## Session Start Checklist

1. Run `git status --short`.
2. Read the required repo docs.
3. Use `docs/next_steps_rag_project_plan.md` as the current-stage primary source of truth.
4. Use `docs/current-progress.md` to confirm status, already-completed increments, and open follow-up items.
5. Select one bounded task that matches the current direction defined in `docs/next_steps_rag_project_plan.md`.
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
- Combining multiple unrelated tasks in one session
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
- `docs/next_steps_rag_project_plan.md`
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

## Push / PR Policy

- push after the relevant validation passes
- if the task yields multiple commits, push the branch promptly after each clearly bounded, independently verifiable sub-increment; avoid leaving already-finished commits unpushed for long
- this applies to both frontend and backend tasks
- prefer a normal push to the current branch instead of force-pushing
- open or update the PR against the branch required by the task flow; for current web-only work, that is usually `dev`
- when subsequent changes stay on the same branch, treat the existing PR as the sync target; avoid repeating "new PR" wording unless the branch changes or the user asks for a new PR
- if a PR is already open, keep using the same PR when the same branch is updated
- resolve conflicts locally before pushing, then rerun the smallest relevant validation
- keep the PR scope limited to the current task; do not mix unrelated cleanup or backend changes into a frontend PR

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
先严格遵守仓库根目录 AGENTS.md，并以 `docs/next_steps_rag_project_plan.md` 作为现阶段主文档。

仓库：d:\FeProjects\rag-system

执行要求：
1. 查看 `git status --short`
2. 阅读：
   - `docs/next_steps_rag_project_plan.md`
   - `README.md`
   - `docs/current-dev-setup.md`
   - `docs/current-progress.md`
   - `docs/phase-1-rag-blueprint.md`
3. 以 `docs/next_steps_rag_project_plan.md` 作为当前阶段优先级、superpowers 使用方式、AI review 策略的主依据
4. 用 `docs/current-progress.md` 核对完成状态和未完成方向，不把它当成唯一优先级来源
5. 自动定位当前推荐下一步，并选择一个边界清晰的单一任务
6. 检查 `docs/superpowers/specs/` 和 `docs/superpowers/plans/` 是否已有该任务相关文档
7. 检查与当前任务直接相关的 backend / API 代码与测试
8. 如果没有相关 spec / plan，先按 superpowers 流程补齐再执行
9. 优先做 backend / API，除非当前任务明确需要前端
10. 不要回滚用户已有未提交改动
11. 遵守 `docs/next_steps_rag_project_plan.md` 中的轻量 superpowers 和 AI review 策略
12. 本轮结束时，必须额外输出一段“下一个 new chat 可直接粘贴的续接摘要”

允许你在单个任务内使用 sub-agents 并行分析/实现，但仍然一次只完成一个边界清晰的当前阶段任务。

下面是续接摘要：
```
