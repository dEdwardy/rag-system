## Loop Workspace

- `materialized/`: active wave snapshots only.
- `handoffs/`: active handoff drop zone only.
- `prompts/generated/`: active recovery prompts only.
- `archive/`: historical loop records.
- `loop-run.log`: runtime log, not default context.

### Default Read

- `materialized/` only when a wave is still actionable
- the newest file in `handoffs/` only when a run is in progress
- a short human summary of current mode, boundaries, and next step

### Default Skip

- `archive/`
- old generated prompts
- old handoffs
- old wave snapshots
- `loop-run.log`

Only load archived items when tracing a specific regression, decision, or interrupted run.

### Validation Rule

- queue items must use the repository's Vitest-based validation path for tests
- do not create new queue items that validate with raw `node --test`
- if an old test file still only runs through the legacy path, treat migrating or replacing that validation path as part of the task before queueing it
