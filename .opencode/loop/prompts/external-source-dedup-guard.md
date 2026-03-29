Read AGENTS.md and the primary docs.

Implement one minimal external source dedup guard improvement.

Priority guidance:
- focus on one duplicate-ingest or duplicate-fetch edge case
- prefer a small dedup check or clearer skip reason
- do not add a new source family
- do not broaden into a connector platform rewrite

Choose one small focused increment, validate it minimally, and report the exact dedup behavior it protects.
