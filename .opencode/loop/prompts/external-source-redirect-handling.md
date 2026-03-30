Read AGENTS.md and the primary docs.

Implement one minimal external source redirect handling improvement.

Priority guidance:
- focus on one redirect edge case in `web page`, `feed`, or `sitemap` fetches
- prefer clearer follow-redirect behavior or error reporting
- do not add a new source family
- do not broaden into a connector platform rewrite

Choose one small focused increment, validate it minimally, and report the exact response-edge behavior it improves.
