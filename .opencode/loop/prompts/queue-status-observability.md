Read AGENTS.md and the primary docs.

Implement one minimal queue observability improvement for the loop start/idle logs.

Priority guidance:
- improve remaining-work visibility for a single runtime state transition
- prefer a small log line or status helper around `start`, `pick`, or `idle`
- do not redesign the queue format
- do not broaden into a dashboard or new UI

Choose one small focused increment, validate it minimally, and report the exact queue-state insight it adds.
