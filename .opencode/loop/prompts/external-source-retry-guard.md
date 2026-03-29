Read AGENTS.md and the primary docs.

Implement one minimal backend-first retry or guardrail improvement for existing external sources.

Priority guidance:
- focus on one failure mode in `web page` / `feed` / `sitemap` / `sitemap index`
- prefer retry limits, clearer errors, or duplicate suppression
- do not add a new source family
- do not broaden into a connector platform rewrite

Choose one small focused increment, validate it minimally, and report the exact failure mode it improves.
