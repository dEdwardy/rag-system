# Docs Guide

> 文档角色：`current-doc-index`
> 当前使用方式：这是 `docs/` 目录导航入口，用来判断先读哪些文档、哪些只是背景或任务档案。

This folder contains both current-stage guidance and historical task records.

To reduce ambiguity, use the docs in the following order.

## Current Primary Docs

1. [Next Steps Plan](/D:/FeProjects/rag-system/docs/next_steps_rag_project_plan.md)
   - current-stage planning authority
   - defines current priority order
   - defines current superpowers usage style
   - defines current AI review policy
2. [Current Progress](/D:/FeProjects/rag-system/docs/current-progress.md)
   - implementation status snapshot
   - completed increments
   - remaining directions
   - latest validation snapshot
3. [Current Dev Setup](/D:/FeProjects/rag-system/docs/current-dev-setup.md)
   - local run steps
   - validation commands
   - current environment notes
4. [Local Dev Infra](/D:/FeProjects/rag-system/docs/local-dev-infra.md)
   - local PostgreSQL / Redis infrastructure notes

## Background Docs

- [Phase 1 RAG Blueprint](/D:/FeProjects/rag-system/docs/phase-1-rag-blueprint.md)
  - longer-lived architecture/background reference
- [Retrieval Trace](/D:/FeProjects/rag-system/docs/retrieval-trace.md)
  - trace structure and retrieval-trace-related notes
- [Web i18n](/D:/FeProjects/rag-system/docs/web-i18n.md)
  - frontend i18n notes
- [Auto Dev Workflow](/D:/FeProjects/rag-system/docs/auto-dev-workflow.md)
  - execution workflow for agent-driven repository work
- [OpenCode Workflow](/D:/FeProjects/rag-system/docs/opencode-workflow.md)
  - default OpenCode prompt, agent selection, and OMO usage boundaries

## Superpowers Docs

- [superpowers/README.md](/D:/FeProjects/rag-system/docs/superpowers/README.md)

The `docs/superpowers/` folder is a task-record archive, not the top-level daily entry point.

- `docs/superpowers/specs/`
  - task-specific design records
- `docs/superpowers/plans/`
  - task-specific implementation plans

These files are useful when a current task directly matches them, but they should not replace the primary docs above.

## Practical Rule

If you only read four docs before doing substantial work, read:

1. [Next Steps Plan](/D:/FeProjects/rag-system/docs/next_steps_rag_project_plan.md)
2. [Current Progress](/D:/FeProjects/rag-system/docs/current-progress.md)
3. [Current Dev Setup](/D:/FeProjects/rag-system/docs/current-dev-setup.md)
4. [README.md](/D:/FeProjects/rag-system/README.md)

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
