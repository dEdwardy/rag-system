Read AGENTS.md and the primary docs.

Implement one minimal external source content-type handling improvement.

Priority guidance:
- focus on one `web page` / `feed` / `sitemap` HTTP response edge case
- prefer clearer content-type checks, fallback parsing, or error reporting
- do not add a new source family
- do not broaden into a connector platform rewrite

Choose one small focused increment, validate it minimally, and report the exact response-edge behavior it improves.
