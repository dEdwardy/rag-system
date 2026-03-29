Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, and `docs/current-dev-setup.md` before editing.

Task: sync the trace-summary field list in the developer setup docs with the actual contract.

Focus files:
- `docs/current-dev-setup.md`
- `packages/shared/src/trace-contracts.ts`
- `apps/api/src/modules/traces/traces.service.ts`

Rules:
- do not invent new fields
- keep the doc aligned with the current implementation only
- prefer short, practical descriptions over long prose

Deliverable:
- update the field list and any nearby notes
- report the doc section you changed and the validation command used
