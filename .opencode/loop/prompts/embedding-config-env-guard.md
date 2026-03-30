Read AGENTS.md and the primary docs.

Implement one minimal embedding configuration guardrail.

Priority guidance:
- focus on env/default handling, validation, or clearer error output
- prefer a narrow backend safeguard over a configuration rewrite
- do not broaden into provider abstraction changes
- do not touch unrelated retrieval flow semantics

Choose one small focused increment, validate it minimally, and report the exact configuration risk it reduces.
