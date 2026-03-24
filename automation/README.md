# Automation

This folder contains local automation helpers for repository workflow support.

Current scope:

- `codex_prompt.md`: fixed prompt text for Codex sessions
- `codex_task_gate.py`: classify a proposed next increment as `ALLOW` or `SKIP`
- `automation-skip-queue.md`: local queue of skipped core tasks for later manual handling
- `latest_plan_output.md`: local input file for the latest planned increment output

Notes:

- the queue file is intentionally ignored by git
- the latest plan output file is intentionally ignored by git
- scripts here should support local workflow automation, not replace repository rules in `AGENTS.md`

Current `codex_task_gate.py` behavior:

- zero-argument mode
- reads from `stdin` first
- otherwise reads from `automation/latest_plan_output.md`
- appends skipped core increments to `automation/automation-skip-queue.md`
