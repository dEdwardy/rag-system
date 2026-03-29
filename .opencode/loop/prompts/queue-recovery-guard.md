Read AGENTS.md and the primary docs.

Implement one minimal queue recovery guardrail for interrupted runs or stale locks.

Priority guidance:
- focus on one interrupted-run resume path or stale-lock cleanup path
- prefer safe fallback behavior or a clearer recovery message
- do not redesign the queue format
- do not broaden into new scheduling logic

Choose one small focused increment, validate it minimally, and report the exact recovery behavior it protects.
