# AGENTS.md

This repository is an active-development monorepo for a personal RAG system.
Prefer small, targeted, reversible changes that fit the existing structure and current project phase.

## Read First

Before making any non-trivial change, read these in order:

1. `docs/next_steps_rag_project_plan.md`
2. `docs/current-progress.md`
3. `docs/current-dev-setup.md`
4. `README.md`

Use additional docs in `docs/` only when they are directly relevant to the task.

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

- prefer incremental backend progress over broad product reshaping
- prefer stability and observability over clever rewrites
- prefer extending existing flows over introducing parallel architectures

## Repository Layout

- `apps/api`: main backend application, ingestion, retrieval, answering, persistence
- `apps/web`: frontend application
- `packages/shared`: shared code and types
- `docs`: project documentation and implementation notes
- `storage`: local runtime data for development

## Primary Development Priorities

Unless the task explicitly says otherwise, prioritize work in this order:

1. backend correctness
2. retrieval / answering quality
3. ingestion reliability
4. diagnostics / traceability / metadata clarity
5. frontend enablement
6. polish / refactor

Frontend work should usually support an already-defined backend capability, not lead it.

## Working Style

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
- do not broaden a backend task into frontend redesign
- do not bundle nice-to-have cleanup into a functional change
- do not add speculative abstractions for future features unless already required by the current task

## Agent Strategy

Default to a single main agent workflow.

Do not enable broad multi-agent or OMO execution by default.
Only consider limited parallel agent usage when all of the following are true:

- the work can be split into clearly isolated file ownership
- the tasks do not touch the same high-risk subsystem
- final validation can still be performed serially
- coordination cost is lower than the expected speedup

When in doubt, stay single-agent.

中文说明：默认由主控代理直接完成实现；子代理优先只承担窄范围搜索、审计、资料检索、提交草稿等辅助工作，不默认整包接管一个功能波次。

## Main-Control Execution Bias

Prefer a main-control execution bias for this repository:

- the primary agent should directly handle implementation, focused validation, and closeout for most backend tasks
- for complex but familiar backend work, prefer direct main-control execution rather than delegating by default
- use subagents mainly for narrow supporting work such as codebase search, external reference lookup, audit mapping, or commit drafting
- do not delegate an entire feature wave by default when the primary agent can complete it directly with lower coordination cost
- reserve full implementation delegation for genuinely hard, unfamiliar, or cross-cutting tasks where the delegation benefit clearly outweighs verification overhead

中文说明：本仓库默认“主控直做、子代理窄辅助”，目标是在保持验证质量的前提下减少委派成本、重复确认和回合损耗。

## Default Execution Mode

Unless the user explicitly asks to pause or review before the next step, continue automatically through:

- task identification
- required reading / spec alignment
- implementation
- focused validation
- documentation updates
- commit
- push

中文说明：默认连续执行，不需要在上述常规步骤之间逐一停下来征求确认。

Do not stop for confirmation between normal development steps unless:

- the requirement is materially ambiguous
- there is a direct conflict with existing uncommitted work
- the next action is destructive or unusually high-risk
- the change would significantly alter architecture or existing behavior boundaries

中文说明：只有在需求存在实质歧义、与现有未提交改动冲突、下一步属于破坏性或高风险操作，或会明显改变现有架构或行为边界时，才中断并询问。

Treat autonomous end-to-end execution as the repository default working mode.

中文说明：本仓库默认工作模式是端到端自动推进，而不是每一步等待人工确认。

## Turbo Mode Guardrails

Apply Turbo execution defaults with explicit safety limits:

- if a subagent task or long-running validation exceeds 90 seconds without a result, post a brief progress update
- if a subagent wait exceeds 12 minutes, stop waiting, split the scope into smaller units, and redelegate
- run minimal targeted validation per task, then run one full-wave closeout validation at the end of the broader delivery wave
- for retrieval, embedding, persistence, or schema changes, include at least one real runtime or API verification path
- allow at most one retry per task; after that, narrow scope before continuing

中文说明：Turbo 模式以快速推进为默认，但必须遵守 90 秒无结果主动汇报、超时拆分、每任务最小验证、高风险真实运行验证、单次重试后收敛范围这五项护栏。

## High-Risk Areas

Use extra caution and keep changes especially small in these areas:

- ingestion pipelines
- retrieval logic
- answer generation / orchestration
- streaming behavior
- persistence / schema-related logic
- cross-package shared contracts

For these areas:

- prefer minimal diffs
- validate behavior with focused tests
- avoid opportunistic refactors
- review for regressions before closeout

## Validation

Run the smallest relevant validation for the change.

Common commands:

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test:api:fast
pnpm test:api
```

Default validation policy:

- for day-to-day backend work, run the smallest focused test command that matches the changed area
- use full `pnpm test:api` mainly for closeout, broader cross-module verification, or behavior changes that cross boundaries
- cross-package changes should run `pnpm build` or the relevant package build
- frontend-only changes should run at least the relevant build or typecheck if available
- avoid expensive full-suite validation when a smaller relevant check is sufficient for the current increment

Minimum expectation:

- every non-trivial change should have at least one relevant validation step
- behavior changes should validate behavior, not only types
- do not claim completion without stating what was validated

## Test Boundary Rule

Prefer source-first tests for the local fast feedback loop.

Rules:

- fast-lane, unit, and focused module tests should run against source code and should not require `dist/`
- integration and E2E tests may continue using the current build-aware or `dist/` startup path when they validate real API or application wiring
- do not add new `dist/` dependencies to tests that should belong to the fast lane
- when a test can reasonably be implemented as a fast focused test, prefer that over adding another heavy build-dependent test path
- any `dist/`-dependent validation should be treated as heavy validation by default

Heavy validation must remain serial.
Do not run multiple builds, full API suites, integration flows, or E2E flows in parallel.

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
