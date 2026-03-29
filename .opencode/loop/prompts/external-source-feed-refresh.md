Read AGENTS.md and the primary docs.

Implement one minimal feed refresh improvement for existing external sources.

Priority guidance:
- focus on one stale `feed` update or polling gap
- prefer refresh timing, retry, or dedup clarity
- do not add a new source family
- do not broaden into a connector platform rewrite

Choose one small focused increment, validate it minimally, and report the exact freshness behavior it improves.
