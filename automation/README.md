# Automation

This folder contains local automation helpers for repository workflow support.

Current scope:

- `codex_auto.py`: single entry point for the current Codex automation flow
- `codex_prompt.md`: fixed prompt text for Codex sessions
- `codex_prompt_builder.py`: build a runtime prompt with skip-queue exclusions
- `codex_plan_cycle.py`: run one full `plan -> gate` cycle
- `codex_plan_runner.py`: run `codex exec` for the next plan step using the runtime prompt
- `codex_plan_capture.py`: capture the latest `plan` output into the local working file
- `codex_task_gate.py`: classify a proposed next increment as `ALLOW` or `SKIP`
- `automation-run-log.md`: local append-only summary log for completed automation runs
- `automation-skip-queue.md`: local queue of skipped core tasks for later manual handling
- `latest_plan_output.md`: local input file for the latest planned increment output
- `runtime_prompt.md`: local generated prompt file for the next Codex run

Notes:

- the queue file is intentionally ignored by git
- the run log file is intentionally ignored by git
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
- when the first non-core result is `NEEDS_CONTINUE`, automatically reruns one more `plan` attempt
- gates the resulting increment
- records skipped core increments to the local skip queue
- prints a compact cycle summary with cycle status, agent status, increment, suggested next action, and skip details when applicable
- never auto-continues more than once in a single cycle

Current `codex_auto.py` behavior:

- zero-argument mode
- runs the current single-cycle automation flow
- prints the final compact summary
- appends the summary to `automation/automation-run-log.md`
- supports `--no-log` to skip local log append
- supports `--log-file <path>` to override the local log destination
- supports `--timeout <seconds>` to bound each `codex exec` attempt
- returns a nonzero exit code on runtime failure
