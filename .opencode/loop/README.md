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
- queue items should run one small focused validation command only; do not chain broad suites in a single item
- do not create new queue items that validate with raw `node --test`
- if an old test file still only runs through the legacy path, treat migrating or replacing that validation path as part of the task before queueing it

### Recovery Rule

- when an item fails because validation is broad or legacy, recover by rewriting the item to one focused command and a Vitest-based test command
- keep recovery follow-ups small and bounded: one fix wave, one focused validation command, then requeue

### Harness Notes

- harness/known-issues.md: observed reliability gaps and follow-up optimizations from unattended loop runs.
