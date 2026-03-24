# OpenCode Workflow

> Doc role: `workflow`
> Usage: default OpenCode operating guide for `plan` / `build`, agent selection, and OMO boundaries.

## Purpose

Use this document as the default OpenCode operating guide for this repository.

It complements [AGENTS.md](/D:/FeProjects/rag-system/AGENTS.md) and [Auto Dev Workflow](/D:/FeProjects/rag-system/docs/auto-dev-workflow.md):

- `AGENTS.md` defines repository-level execution rules
- `docs/auto-dev-workflow.md` defines the broader agent-driven repository workflow
- this doc defines the default OpenCode prompt and agent-selection pattern for daily work

## Default Mode Selection

Use OpenCode in two stages:

1. `plan`
2. `build`

Default agent choice:

- `plan`: `Prometheus`
- `build`: `Hephaestus`

Recommended interpretation:

- `Prometheus` is the planning-first agent for identifying the next bounded increment
- `Hephaestus` is the main implementation agent for executing the approved increment

## OMO Policy

Do not treat OMO as the default main workflow.

Use OMO only as a build-stage accelerator when the main increment is already chosen and the auxiliary work is clearly isolated.

Allowed OMO side tasks:

- explain current code path
- identify focused validation
- draft docs update
- review diff for bugs or regressions
- add isolated focused tests
- perform frontend adaptation that does not alter backend contracts

Do not delegate these decisions to broad OMO orchestration:

- choosing the next main increment
- changing high-risk backend core logic through multiple parallel agents
- final verification conclusion
- final integration and closeout

## Fixed Prompt

Use the following prompt as the default OpenCode session prompt for this repository:

```text
First read AGENTS.md, docs/next_steps_rag_project_plan.md, docs/current-progress.md, docs/current-dev-setup.md, and README.md.

Based on the current documented plan, project progress, existing implementation, and repository rules, identify the next most appropriate minimal increment pointed to by the docs.

First decide which execution mode should be used for this task:
1. Single-agent plan -> build
2. Build main agent + limited OMO helper agents

Decision rules:
- If the task touches high-risk core logic such as retrieval, answering, ingestion, streaming, schema/persistence, or shared contracts, default to single-agent execution and do not enable broad OMO
- Only allow limited OMO when there are clearly isolated, low-coupling helper tasks that can be closed independently
- OMO helper agents may only be used for: explaining current code paths, identifying focused validation, drafting docs updates, reviewing diffs, adding isolated focused tests, and frontend adaptation that does not affect backend contracts
- Final verification, final integration, and final conclusions must be completed serially by the main agent

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
- only use limited OMO help during `build` when the side task is clearly bounded
- keep final validation and completion judgment with the main agent
