Read AGENTS.md and the primary docs.

Implement one minimal queue progress summary improvement for a loop progress command or log line.

Priority guidance:
- improve remaining-work visibility from a single command or log output
- prefer a focused progress summary around the current cursor and pending total
- do not redesign the queue format
- do not broaden into a dashboard or new UI

Choose one small focused increment, validate it minimally, and report the exact progress signal it adds.
