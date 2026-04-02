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
