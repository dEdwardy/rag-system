# Automation

This folder contains local automation helpers for repository workflow support.

Current scope:

- `codex_prompt.md`: fixed prompt text for Codex sessions
- `codex_prompt_builder.py`: build a runtime prompt with skip-queue exclusions
- `codex_plan_cycle.py`: run one full `plan -> gate` cycle
- `codex_plan_runner.py`: run `codex exec` for the next plan step using the runtime prompt
- `codex_plan_capture.py`: capture the latest `plan` output into the local working file
- `codex_task_gate.py`: classify a proposed next increment as `ALLOW` or `SKIP`
- `automation-skip-queue.md`: local queue of skipped core tasks for later manual handling
- `latest_plan_output.md`: local input file for the latest planned increment output
- `runtime_prompt.md`: local generated prompt file for the next Codex run

Notes:

- the queue file is intentionally ignored by git
- the latest plan output file is intentionally ignored by git
- the runtime prompt file is intentionally ignored by git
- scripts here should support local workflow automation, not replace repository rules in `AGENTS.md`

Current `codex_task_gate.py` behavior:

- zero-argument mode
- reads from `stdin` first
- otherwise reads from `automation/latest_plan_output.md`
- appends skipped core increments to `automation/automation-skip-queue.md`

Current `codex_plan_capture.py` behavior:

- zero-argument mode
- reads the copied `plan` output from `stdin`
- writes it to `automation/latest_plan_output.md`

Current `codex_prompt_builder.py` behavior:

- zero-argument mode
- reads `automation/codex_prompt.md`
- reads `automation/automation-skip-queue.md` when present
- writes `automation/runtime_prompt.md`
- appends a skip-exclusion block when skipped core increments exist

Current `codex_plan_runner.py` behavior:

- zero-argument mode
- reads `automation/runtime_prompt.md`
- runs `codex exec` with `read-only` sandbox
- writes the final output to `automation/latest_plan_output.md`

Current `codex_plan_cycle.py` behavior:

- zero-argument mode
- builds the runtime prompt
- runs one Codex `plan` step
- gates the resulting increment
- records skipped core increments to the local skip queue
