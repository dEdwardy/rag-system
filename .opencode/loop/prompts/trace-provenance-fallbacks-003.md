Read AGENTS.md and the relevant trace docs first.

Target:
- apps/api/test/traces.service.test.js
- the nearest ask/assistant test file if needed

Goal:
Add regression coverage for legacy fallback metadata paths that affect answerProvenanceSentence and missingInformationProvenanceSentence. Lock the read-model backfill behavior without changing runtime semantics.
