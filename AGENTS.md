# AGENTS.md

This repository is an active-development monorepo for a personal RAG system.
Prefer small, targeted, reversible changes that fit the existing structure and current project phase.

## Read First

Before making any non-trivial change, read these in order:

1. `docs/current-context.md`
2. `docs/next_steps_rag_project_plan.md`

Read additional docs only when they are directly relevant to the task:

- `docs/current-progress.md`
- `docs/current-dev-setup.md`
- `README.md`
- `.opencode/loop/README.md` when working on the local loop harness

## Environment Assumption

Default development environment:

- `WezTerm + WSL Ubuntu`
- repository path: `~/projects/rag-system`
- prefer Linux/WSL shell commands and path conventions in examples and instructions

If the current session runs in a different environment, still follow the repository workflow rules in this file.
If commands differ across environments, prefer repository-correct commands over environment-specific convenience.

## Project Phase Assumption

Treat this repository as an in-progress product moving from MVP into iterative hardening and feature completion.

Implications:

- prefer incremental progress over broad product reshaping
- prefer stability and observability over clever rewrites
- prefer extending existing flows over introducing parallel architectures

## Repository Layout

- `apps/api`: main backend application, ingestion, retrieval, answering, persistence
- `apps/web`: frontend application
- `packages/shared`: shared code and types
- `docs`: project documentation and implementation notes
- `storage`: local runtime data for development

## Monorepo Working Style

- Preserve existing patterns unless the task clearly requires a change.
- Prefer focused edits over broad refactors.
- Do not rewrite unrelated areas while implementing a local feature or fix.
- Keep each task to a single clear increment whenever possible.
- Avoid mixing feature work, refactors, and cleanup in the same change.
- Prefer the smallest change that closes the next meaningful gap.
- When requirements are unclear, narrow to the next concrete increment instead of expanding scope.

## Scope Control

By default:

- do not introduce new architecture layers unless the current structure clearly blocks progress
- do not replace stable existing implementations just for elegance
- do not broaden a local task into cross-app redesign
- do not bundle nice-to-have cleanup into a functional change
- do not add speculative abstractions for future features unless already required by the current task

## Agent Strategy

Default to a single main agent workflow.

Do not enable broad multi-agent, broad fan-out delegation, or OMO-style execution by default.
Only consider limited parallel agent usage when all of the following are true:

- the work can be split into clearly isolated file ownership
- the tasks do not touch the same high-risk subsystem
- final validation can still be performed serially
- coordination cost is lower than the expected speedup

When in doubt, stay single-agent.

中文说明：默认由主控代理直接完成实现；子代理优先只承担窄范围搜索、审计、资料检索、提交草稿等辅助工作，不默认展开广义多代理 fan-out，也不默认整包接管一个功能波次。

## Main-Control Execution Bias

Prefer a main-control execution bias for this repository:

- the primary agent should directly handle implementation, focused validation, and closeout for most tasks
- use subagents mainly for narrow supporting work such as codebase search, external reference lookup, audit mapping, or commit drafting
- do not delegate an entire feature wave by default when the primary agent can complete it directly with lower coordination cost
- reserve full implementation delegation for genuinely hard, unfamiliar, or cross-cutting tasks where the delegation benefit clearly outweighs verification overhead

中文说明：本仓库默认“主控直做、子代理窄辅助”。

## Review Escalation

Do not treat review as a default step.

- skip review by default for low-risk config, docs, style, copy, and isolated UI tweaks
- escalate to review for high-risk logic changes, contract changes, persistence or schema changes, or pre-merge critical checks

中文说明：review 不是默认步骤；config/docs/style/文案/局部 UI 小改默认不触发 review，只有高风险逻辑改动、契约变化、持久化或 schema 变化、或合并前关键检查时才升级到 review。

## Default Execution Mode

Unless the user explicitly asks to pause or review before the next step, continue automatically through:

- task identification
- required reading / spec alignment
- implementation
- focused validation
- documentation updates

中文说明：默认连续执行，不需要在常规步骤之间逐一停下来征求确认。

Do not stop for confirmation between normal development steps unless:

- the requirement is materially ambiguous
- there is a direct conflict with existing uncommitted work
- the next action is destructive or unusually high-risk
- the change would significantly alter architecture or existing behavior boundaries

中文说明：只有在需求存在实质歧义、与现有未提交改动冲突、下一步属于破坏性或高风险操作，或会明显改变现有架构或行为边界时，才中断并询问。

Treat autonomous end-to-end execution as the repository default working mode.

中文说明：本仓库默认工作模式是端到端自动推进，而不是每一步等待人工确认。

## Validation

Run the smallest relevant validation for the change.

Common commands:

```bash
pnpm build
pnpm lint
pnpm typecheck
```

Default validation policy:

- every non-trivial change should have at least one relevant validation step
- behavior changes should validate behavior, not only types
- cross-package changes should run the relevant package build or equivalent validation
- avoid expensive full-suite validation when a smaller relevant check is sufficient for the current increment

## Encoding

- Treat UTF-8 as the required repository encoding for active source, config, script, and documentation files.
- Save new or edited files as UTF-8. Do not introduce GBK, ANSI, or other local-only encodings for Chinese copy or comments.
- Prefer UTF-8 without BOM unless a specific tool explicitly requires BOM.
- Treat any newly introduced Chinese mojibake as a release-blocking regression, especially in `apps/web/src`, `apps/api/src`, `docs/`, and `AGENTS.md` files.
- Do not paste garbled terminal text back into source files. If terminal output looks broken, inspect the file bytes or reread the file with explicit UTF-8 before editing.
- When a file contains Chinese copy, prefer moving user-facing strings into existing i18n message files instead of adding more ad-hoc inline literals.
- After editing any file that contains Chinese text, run a targeted encoding validation step before closeout. Minimum options: `pnpm check:encoding` or an equivalent strict UTF-8 read of the touched files.
- If you discover an encoding-damaged file, fix the encoding first and only then continue with logical edits. Do not mix broad feature changes with encoding rescue in the same file unless required.
- If terminal output looks garbled, do not assume the file bytes are broken. Verify the file with a strict UTF-8 read before rewriting it.
- If a file is genuinely encoding-damaged, normalize it to valid UTF-8 before making further logical edits.
- When fixing or adding Chinese text, make sure the final file still round-trips as valid UTF-8.
- For suspicious encoding changes, run a targeted UTF-8 validation step before closeout.

## Docs

- If behavior, setup, workflow, or current status changes, update the relevant file in `docs/`.
- Keep documentation practical and current rather than exhaustive.
- Prefer updating an existing doc over creating a new one unless the topic is genuinely new.
- Update progress/status docs when a meaningful increment is completed.
- Keep docs aligned with actual repository behavior, not intended future state.

## Completion Standard

A task is usually complete only when all of the following are true:

- the requested increment is implemented
- the smallest relevant validation has been run
- relevant docs are updated if needed
- the change is scoped and does not include unnecessary unrelated edits
- remaining risks or follow-up items are explicitly noted when applicable

## App-Specific Guidance

- For cross-app work that needs coordinated changes in `apps/api` and `apps/web`, prefer starting OpenCode from the repository root so the default working context stays monorepo-wide.
- When frontend and backend work need to proceed in parallel, prefer separate Git worktrees so each OpenCode session has its own checkout and local config.
- For backend-specific workflow, validation, and risk guidance, also read `apps/api/AGENTS.md` when working in `apps/api`.
- For frontend-specific workflow, UI constraints, and plugin notes, also read `apps/web/AGENTS.md` when working in `apps/web`.
