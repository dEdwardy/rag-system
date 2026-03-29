Read AGENTS.md and the primary docs.

Implement one minimal retrieval mode fallback provenance improvement for the trace summary.

Priority guidance:
- keep the change additive and behavior-preserving
- prefer `retrievalMode`, `strategySummary`, or fallback provenance clarity
- do not change retrieval execution semantics
- do not reopen UI refactor or broad source-platform work

Choose one small gap that makes retrieval-mode traces easier to read, validate it minimally, and report exact files plus commands.
