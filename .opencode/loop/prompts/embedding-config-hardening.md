Read AGENTS.md and the primary docs.

Implement one minimal backend-first hardening increment for embedding model selection or embedding-dimension configuration.

Scope rules:
- prefer explicit configuration clarity, guardrails, diagnostics, or compatibility checks
- keep the diff narrow and reversible
- avoid broad schema or architecture rewrites unless the smallest safe increment truly requires it
- run one focused validation that exercises the changed path

Report the exact limitation addressed and any remaining follow-up risk.
