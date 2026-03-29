Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, and the trace service tests before editing.

Task: add regression coverage for legacy fallback read-model backfill paths.

Focus files:
- `apps/api/test/traces.service.test.js`
- any small helper used to shape trace summary fallback wording

Rules:
- keep the change additive and behavior-preserving
- cover at least one legacy payload that only has top-level fallback clues
- cover at least one payload that is missing fields but should remain readable

Deliverable:
- add focused tests that lock the backfill behavior
- report exact scenarios covered and the validation command used
