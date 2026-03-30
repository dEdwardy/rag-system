Read AGENTS.md and the primary docs.

Implement one minimal queue cursor guardrail.

Priority guidance:
- focus on one cursor edge case or recovery path
- prefer safe fallback behavior or a clearer status message
- do not redesign the queue format
- do not broaden into new scheduling logic

Choose one small focused increment, validate it minimally, and report the exact cursor behavior it protects.
