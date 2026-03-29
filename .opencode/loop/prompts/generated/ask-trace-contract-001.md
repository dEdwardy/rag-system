Read `AGENTS.md`, `docs/next_steps_rag_project_plan.md`, `docs/current-progress.md`, and the relevant API contract files before editing.

Task: align the wording used by ask response and trace summary for shared contract fields.

Focus files:
- `apps/api/src/modules/traces/traces.service.ts`
- `apps/api/src/modules/assistants/ask-assistant.service.ts`
- `packages/shared/src/trace-contracts.ts`

Rules:
- keep the change additive and behavior-preserving
- do not change retrieval semantics, persistence, or schema shape
- if a helper is needed, make it the smallest possible shared helper

Deliverable:
- make the wording consistent across ask and trace paths
- add or update focused regression tests
- report exact files changed and the focused validation command you ran
