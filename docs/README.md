# Docs Guide

> 文档角色：`current-doc-index`
> 当前使用方式：这是 `docs/` 目录导航入口，用来判断先读哪些文档、哪些只是背景或任务档案。

This folder contains both current-stage guidance and historical task records.

To reduce ambiguity, use the docs in the following order.

## Current Primary Docs

1. [Project Status Overview](project-status-overview.md)
   - one-page project progress summary
   - best first read for overall status
2. [Next Steps Plan](next_steps_rag_project_plan.md)
   - current-stage planning authority
   - defines current priority order
   - defines current superpowers usage style
   - defines current AI review policy
3. [Current Progress](current-progress.md)
   - implementation status snapshot
   - completed increments
   - remaining directions
   - latest validation snapshot
4. [Current Dev Setup](current-dev-setup.md)
   - local run steps
   - validation commands
   - current environment notes
5. [Local Dev Infra](local-dev-infra.md)
   - local PostgreSQL / Redis infrastructure notes

## Background Docs

- [Phase 1 RAG Blueprint](phase-1-rag-blueprint.md)
  - longer-lived architecture/background reference
- [Retrieval Trace](retrieval-trace.md)
  - trace structure and retrieval-trace-related notes
- [Quality And Performance Optimization Plan](quality-performance-optimization-plan.md)
  - current implementation-oriented plan for improving answer quality without regressing latency too far
- [Web i18n](web-i18n.md)
  - frontend i18n notes
- [Auto Dev Workflow](auto-dev-workflow.md)
  - execution workflow for agent-driven repository work
- [OpenCode Workflow](opencode-workflow.md)
  - default OpenCode prompt, agent selection, and OMO usage boundaries

## Superpowers Docs

- [superpowers/README.md](superpowers/README.md)

The `docs/superpowers/` folder is a task-record archive, not the top-level daily entry point.

- `docs/superpowers/specs/`
  - task-specific design records
- `docs/superpowers/plans/`
  - task-specific implementation plans

These files are useful when a current task directly matches them, but they should not replace the primary docs above.

## Practical Rule

If you only read four docs before doing substantial work, read:

1. [Project Status Overview](project-status-overview.md)
2. [Next Steps Plan](next_steps_rag_project_plan.md)
3. [Current Progress](current-progress.md)
4. [Current Dev Setup](current-dev-setup.md)

## Role Labels

Top-level docs currently use these role labels:

- `current-primary`
  - current-stage primary authority
- `current-status`
  - current implementation/progress tracking
- `current-setup`
  - current local setup and validation usage
- `workflow`
  - execution/process guidance
- `background`
  - longer-lived reference/background material
- `archive-index`
  - task-record or archive navigation entry
