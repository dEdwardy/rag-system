Read AGENTS.md and the primary docs.

Implement one minimal diagnostic improvement for existing external source execution.

Priority guidance:
- focus on one backend visibility gap around source execution or failure attribution
- prefer better logging, status detail, or single-source error context
- do not add a new source family
- do not broaden into a connector platform rewrite

Choose one small focused increment, validate it minimally, and report the exact diagnostic signal it adds.
