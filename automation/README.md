# Automation

This folder contains local automation helpers for repository workflow support.

Current scope:

- `codex_task_gate.py`: classify a proposed next increment as `ALLOW` or `SKIP`
- `automation-skip-queue.md`: local queue of skipped core tasks for later manual handling

Notes:

- the queue file is intentionally ignored by git
- scripts here should support local workflow automation, not replace repository rules in `AGENTS.md`
