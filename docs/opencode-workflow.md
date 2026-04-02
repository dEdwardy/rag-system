# OpenCode Workflow

> Doc role: `workflow`
> Usage: default OpenCode operating guide for `plan` / `build`, agent selection, and OMO boundaries.

## Purpose

Use this document as the default OpenCode operating guide for this repository.

It complements [AGENTS.md](../AGENTS.md) and [Auto Dev Workflow](auto-dev-workflow.md):

- `AGENTS.md` defines repository-level execution rules
- `docs/auto-dev-workflow.md` defines the broader agent-driven repository workflow
- this doc defines the default OpenCode prompt and agent-selection pattern for daily work

## Default Mode Selection

Use OpenCode in two stages:

1. `plan`
2. `build`

Repository-adopted default agents:

- default primary agent: `rag-orchestrator`
- `plan`: `rag-plan`
- `build`: `rag-build`
- optional helper: `rag-explore`
- risk-only review: `rag-review`

Recommended interpretation:

- `rag-orchestrator` keeps the main-control execution bias and decides whether helper delegation is warranted
- `rag-plan` identifies the next bounded increment
- `rag-build` executes the approved increment with the smallest relevant validation
- `rag-explore` is a narrow helper for code-path and evidence lookup
- `rag-review` is reserved for risky changes rather than every small edit

## OMO Policy

Treat OMO here as a policy guardrail for broad multi-agent delegation, not as the default main workflow.

Use OMO only as a build-stage accelerator when the main increment is already chosen and the auxiliary work is clearly isolated.

Allowed OMO side tasks:

- explain current code path
- identify focused validation
- draft docs update
- review diff for bugs or regressions
- add isolated focused tests
- perform isolated frontend adaptation that does not alter backend contracts

Do not delegate these decisions to broad OMO orchestration:

- choosing the next main increment
- changing high-risk backend core logic through multiple parallel agents
- expanding ordinary frontend work into broad parallel fan-out by default
- final verification conclusion
- final integration and closeout

### Delegation Checks

When route or model confidence is low, start with one minimal probe before wider delegation:

- use a small startup sanity check, tiny request, or one-file smoke before long subagent work
- if the probe fails, triage the failure before expanding delegation
- report background progress when the task changes state, and do not leave long waits silent
- for waiting background work, expect a short status update after roughly 90 seconds, then roughly every 5 minutes during long validations
- classify failures quickly as route/config issues, environment blocks, or logic/test failures
- for review-style work, prefer already-validated agent/category routes instead of inventing a new delegation path

## Practical Routing Rules

Default execution bias:

- normal path: `plan -> build`
- low-risk work may go straight to `build -> fast verify`
- frontend work should still default to main-control execution; only isolated low-risk adaptation should use helper delegation
- only escalate to review for risky behavior or contract changes

TDD and validation guidance:

- TDD is not the default ceremony for every task
- use light TDD for behavior semantics such as retrieval, fallback, answering, citation, trace / metadata contracts, shared contracts, and source recovery semantics
- use targeted heavy verification only when the change touches integration boundaries such as streaming, persistence, multi-module wiring, or real API / `dist`-dependent paths
- keep heavy validation serial; do not overlap it with AI review

## Fixed Prompt

Use the following prompt as the default OpenCode session prompt for this repository:

```text
First read AGENTS.md, docs/next_steps_rag_project_plan.md, docs/current-progress.md, docs/current-dev-setup.md, and README.md.

Based on the current documented plan, project progress, existing implementation, and repository rules, identify the next most appropriate minimal increment pointed to by the docs.

First decide which execution mode should be used for this task:
1. Main-control plan -> build
2. Direct build -> fast verify for low-risk work
3. Main-control build + limited OMO helper agents

Decision rules:
- If the task touches high-risk core logic such as retrieval, answering, ingestion, streaming, schema/persistence, or shared contracts, default to main-control execution and do not enable broad OMO
- If the task is a small low-risk change such as metadata exposure, trace field addition, small API follow-up, or low-risk bugfix, allow direct `build -> fast verify`
- If the task is frontend-only, keep the same main-control default; only use helper delegation for isolated low-risk adaptation that does not affect backend contracts
- Only allow limited OMO when there are clearly isolated, low-coupling helper tasks that can be closed independently
- OMO helper agents may only be used for: explaining current code paths, identifying focused validation, drafting docs updates, reviewing diffs, adding isolated focused tests, and frontend adaptation that does not affect backend contracts
- Final verification, final integration, and final conclusions must be completed serially by the main agent
- If route confidence is low, run one minimal probe before broader delegation
- While work is backgrounded, provide useful progress updates instead of waiting for completion in silence
- Treat roughly 90 seconds as the first soft status-update point for a waiting background task, then roughly 5 minutes for longer-running validations
- If a probe or delegated task fails, triage it first as route/config, environment, or logic/test failure before changing the plan
- Do not treat heavy TDD as the default. Use light TDD only for behavior-semantic changes such as retrieval, fallback, answering, citation, trace / metadata contracts, shared contracts, and source sync / recovery semantics
- If related superpowers spec / plan is missing for non-trivial work, create it before implementation

Execution requirements:
- Only do one increment at a time
- Preserve the current structure and patterns
- Do not perform unrelated refactors
- First understand the current code path, then narrow to the smallest viable plan, then implement
- Keep the diff minimal
- Run only the most relevant focused validation
- Update docs when needed
- At the end, explain what changed, what was validated, and what risks remain
- Commit when complete
- If there is no material ambiguity, direct conflict, or high-risk action, do not stop to ask; continue automatically
- Whenever stopping, explicitly begin with exactly one status label: `DONE`, `NEEDS_CONTINUE`, `BLOCKED`, or `NEEDS_DECISION`
- If the status is `DONE`, state whether the increment is complete, whether it was committed, and provide a short ready-to-paste summary for the next new session
- If the status is `NEEDS_CONTINUE`, expect the next user reply to be `continue`
- If the status is `BLOCKED` or `NEEDS_DECISION`, explain the reason briefly before anything else

If the current stage is plan, output only:
1. Chosen execution mode
2. Relevant current code path
3. Recommended minimal increment
4. Expected files to change
5. Focused validation
6. Main risks

If the current stage is build, implement the already determined plan and close it out.
```

## Practical Rule

In normal day-to-day repository work:

- start with `plan`
- switch to `build` after the increment is identified
- for low-risk changes, direct `build -> fast verify` is acceptable
- frontend work still follows the same single-main-control-first default, with bounded helper use only for isolated low-risk adaptation
- only use limited OMO help during `build` when the side task is clearly bounded
- keep final validation and completion judgment with the main agent

## Commit / Push / PR Norms

- commit only files that belong to the current task
- check `git status --short` before staging so unrelated edits stay out
- use a concise commit message that matches the change type (`feat:`, `fix:`, `perf:`, `docs:`, `refactor:`)
- if a task produces multiple commits, push the branch as soon as a clearly bounded, independently verifiable sub-increment is validated; do not keep finished commits sitting locally unless you still expect immediate follow-up edits on the same small unit
- this applies to both frontend and backend tasks
- push only after the task's focused validation passes
- prefer updating the existing branch / PR instead of rewriting history unless a rebase is explicitly needed
- when the same branch is updated, assume the existing PR will sync automatically; do not restate "new PR" unless the branch changes or a new PR is explicitly requested
- default PR target follows the current task direction; for web frontend work in this repo, use `dev` unless the task says otherwise
- if a PR has conflicts, resolve them locally, rerun the smallest relevant validation, then update the same PR when possible
- keep frontend-only work frontend-only unless the task explicitly requires backend changes
- do not default to `review` or heavy TDD for small edits

## Unattended Execution

For unattended `opencode-loop` runs, use the repo-local Node harness first:

- `opencode-loop` is a repo-local development harness, not part of the product runtime
- keep this section as the operational exception, not the center of the workflow docs
- `pnpm loop:start|stop|status` runs the cross-platform Node harness under `.opencode/loop/harness/`
- use `pnpm loop:start|stop|status` for day-to-day management on Windows or WSL/Linux
- the runner reads the current materialized wave snapshot, selects the next runnable queue item in order, and invokes `opencode run --agent build` for the first item, then `opencode run --continue --agent build` on the same session for following items in the same compact wave when possible
- each spawned session title should expose queue progress clearly, including current task index and remaining task count
- prefer compact waves over per-task fresh sessions when the tasks are closely related; this keeps repeated context cost lower without turning the harness into a long-lived autonomous agent
- use the per-item timeout guard (`OPENCODE_LOOP_ITEM_TIMEOUT_MS`, default `20m`) so a stuck queue item is terminated and marked `needs_replan` instead of hanging the whole wave indefinitely
- treat structured JSON `error` events from `opencode run --format json` as queue failures even when the process exit code is `0`, so false-success runs do not silently advance the wave
- after each completed loop increment, commit the change before moving to the next item so work does not pile up in the checkout
- do not push or open a PR after every commit; wait for a coherent wave to close, then push from `dev` when validation is green and the branch is unlikely to conflict

## Parallel Worktrees

When frontend and backend work need to proceed at the same time, prefer separate Git worktrees so each OpenCode session has its own checkout:

- keep the main repository checkout for the backend or monorepo-wide session
- create a second worktree for `apps/web` work
- start each OpenCode session from the matching worktree so it loads the local `opencode.jsonc` and `AGENTS.md`
- use worktrees when two sessions may modify files in parallel; do not rely on directory-only separation for concurrent edits

Recommended doc wording:

- fixed local branches: `dev/web` and `dev/api`
- frontend worktree uses `dev/web`
- backend worktree uses `dev/api`
- rule: one session, one checkout, one local branch
- rule: keep those two local branches stable; do not spin up extra branches unless it is a clearly new task
- rule: check `git status` before every commit so unrelated edits stay out

Typical layout:

```bash
git worktree add ../rag-system-web -b dev/web
```
