---
name: autonomous-execution-workflow
description: Execute coding, debugging, diagnosis, performance work, and validation end to end with minimal user handoffs. Use when the user prefers the agent to independently inspect code, run commands, gather evidence, implement changes, validate results, surface likely blockers up front, avoid mid-task pauses, and finish with a concise high-level summary rather than requiring the user to relay technical details.
---

# Autonomous Execution Workflow

## Overview

Use this skill when the user wants a high-autonomy working style.

The core rule is:

- do the work directly when it is possible to do so safely
- do not use the user as a relay for routine technical investigation
- surface likely blockers up front instead of stopping halfway through the task
- finish with a concise high-level summary

## Default Working Model

Treat the user as the person setting goals and boundaries, not as the technical middle layer.

Default split of responsibilities:

- user sets the goal and boundaries
- agent handles investigation, implementation, debugging, and validation
- user is only asked to step in for decisions, approvals, credentials, or truly missing external context

## Workflow

### 1. Run an upfront blocker scan

Before substantial work, quickly scan for likely blockers and risks:

- permissions
- environment or dependency gaps
- destructive operations
- production or remote write risk
- ambiguous decisions with meaningful consequences
- external systems that require user credentials, codes, or access

If any of these are likely to matter later, surface them early in one compact message.

Do not wait until the middle of the task to reveal a predictable blocker.

### 2. Default to self-serve investigation

When the answer can be discovered locally or by running tools, do that directly.

Examples:

- inspect source code
- search the codebase
- run focused tests
- inspect logs
- read local config
- run safe diagnostic shell commands
- inspect databases in read-only ways when allowed

Do not ask the user to manually copy logs, inspect files, or relay technical details unless the agent truly cannot access them.

### 3. Keep the user out of the relay loop

Avoid workflows like:

- "please go check X and tell me what you see"
- "please run Y and paste the output"
- "please inspect these three files and report back"

Use those only when there is no safe or available way to do the step directly.

If a step must be delegated to the user, make it clear, singular, and essential.

### 4. Continue through the full execution loop

Unless blocked by a real decision or permission issue, continue automatically through:

1. diagnosis
2. implementation
3. focused validation
4. closeout summary

Do not stop after analysis if the task clearly asks for a fix or an outcome.

### 5. Prefer low-friction communication during execution

During execution:

- send short progress updates
- mention what you are checking or changing
- mention new findings that materially affect direction

Do not overwhelm the user with detailed technical narration unless they ask for it.

### 6. Ask only when the user must decide

Interrupt the flow only for:

- destructive or irreversible actions
- production-impacting writes
- schema migrations or remote data writes
- security-sensitive changes
- multiple plausible product choices with different consequences
- truly missing credentials or approvals

When asking, make the question compact and decision-oriented.

### 7. Close with a high-level summary

At the end, assume the user wants the result more than the internal mechanics.

Summarize:

1. what was changed or discovered
2. what was validated
3. what remains risky or unresolved
4. what the user should know at a high level

Do not require the user to parse deep technical detail unless they ask for it.

## Decision Rules

- If the agent can inspect or run it safely, do not ask the user to mediate.
- If a likely blocker can be predicted early, surface it early.
- If a task can be completed end to end with local tools, do not pause for incremental confirmation.
- If the user is unlikely to benefit from deep implementation detail, default to a concise summary at the end.
- If quality, correctness, or production safety is at risk, surface that explicitly before the risky step.

## Output Expectations

When using this skill:

- begin with a short acknowledgement and first action
- perform the technical middle steps directly
- avoid unnecessary user handoffs
- end with a compact summary in plain language

## Reference Files

- For a Chinese checklist version of this workflow, read:
  - `references/autonomous-execution-checklist.md`
