Read AGENTS.md and the primary docs.

Implement one minimal external source cache or stale-response guard.

Priority guidance:
- focus on one stale-cache or duplicate-fetch edge case
- prefer safe invalidation, dedup, or refresh behavior
- do not add a new source family
- do not broaden into a connector platform rewrite

Choose one small focused increment, validate it minimally, and report the exact freshness behavior it protects.
