Read AGENTS.md and the primary docs.

Implement one minimal trace failure message readability improvement.

Priority guidance:
- keep the change additive and behavior-preserving
- prefer `failedStage`, `failureMessage`, or trace summary clarity
- do not change retrieval execution semantics
- do not reopen UI refactor or broad source-platform work

Choose one small gap that makes failure traces easier to read, validate it minimally, and report exact files plus commands.
