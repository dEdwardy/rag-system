Read AGENTS.md plus the plan/progress docs first.

Target:
- apps/api/src/modules/traces/traces.service.ts
- apps/api/src/modules/assistants/ask-assistant.service.ts

Goal:
If label mapping is duplicated, extract the smallest safe shared helper so ask final payload and trace summary stay aligned on the same readability wording. Do not widen scope into retrieval behavior or schema changes.
