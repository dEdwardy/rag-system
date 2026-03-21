# AGENTS.md

This repository is an active-development monorepo. Prefer small, targeted changes that fit the existing structure.

## Read First

Before making non-trivial changes, read:

1. [README.md](/D:/FeProjects/rag-system/README.md)
2. [docs/current-dev-setup.md](/D:/FeProjects/rag-system/docs/current-dev-setup.md)
3. [docs/current-progress.md](/D:/FeProjects/rag-system/docs/current-progress.md)

Use additional docs in `docs/` only as needed for the task at hand.

## Repository Layout

- `apps/api`: main backend application, ingestion, retrieval, answering, persistence
- `apps/web`: frontend application
- `packages/shared`: shared code and types
- `docs`: project documentation and implementation notes
- `storage`: local runtime data for development

## Working Style

- Preserve existing patterns unless the task clearly requires a change.
- Prefer focused edits over broad refactors.
- Do not rewrite unrelated areas while implementing a local feature or fix.
- Treat this repository as an in-progress product, not a greenfield scaffold.
- When requirements are unclear, clarify the next increment instead of expanding scope.

## Default Execution Mode

- Unless the user explicitly asks to pause or review before the next step, continue automatically through:
  - task identification
  - required spec/plan steps
  - implementation
  - validation
  - documentation updates
  - commit
  - push

  中文说明：默认连续执行，不需要在上述常规步骤之间逐一停下来征求确认。

- Do not stop for confirmation between normal development steps unless:
  - the requirement is materially ambiguous
  - there is a direct conflict with existing uncommitted work
  - the next action is destructive or unusually high-risk

  中文说明：只有在需求存在实质歧义、与现有未提交改动冲突，或下一步属于破坏性/高风险操作时，才中断并询问。

- Treat autonomous end-to-end execution as the repository default working mode.

  中文说明：本仓库默认工作模式是端到端自动推进，而不是每一步等待人工确认。

## Validation

Run the smallest relevant validation for the change you make. Common commands:

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test:api
```

At minimum:

- backend behavior changes should run `pnpm test:api` when practical
- cross-package changes should run `pnpm build` or the relevant package build
- frontend-only changes should run at least the relevant build or typecheck if available

## Docs

- If behavior, setup, or workflow changes, update the relevant file in `docs/`.
- Keep documentation practical and current rather than exhaustive.
- Prefer updating an existing doc over creating a new one unless the topic is genuinely new.
