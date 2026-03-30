Read AGENTS.md and the primary docs.

Implement one minimal external source re-sync improvement.

Priority guidance:
- focus on one stale-state or missed-update scenario
- prefer re-sync, re-fetch, or dedup recovery logic
- do not add a new source family
- do not broaden into a connector platform rewrite

Choose one small focused increment, validate it minimally, and report the exact freshness improvement.
