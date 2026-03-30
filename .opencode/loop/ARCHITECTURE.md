# OpenCode Loop Harness Architecture

## What this harness is

The loop harness is a repo-local development runner, not a product runtime.
It executes one queue item at a time, keeps the automation narrow, and records enough evidence for a human to resume, review, or replan work safely.

Core intent:

- one queue item at a time
- one OpenCode session per active item
- one execution handoff per run attempt
- verifier-based closeout instead of trusting assistant text alone
- explicit suspension when review or external unblock is needed

## Main modules

| Module | Responsibility |
|---|---|
| `cli.mjs` | Thin entrypoint for run, self-test, materialize, and manual resume commands |
| `harness/runtime.mjs` | Main orchestration loop: load queue, pick item, run session, verify, finalize |
| `harness/queue.mjs` | Queue schema helpers, cursor logic, normalization, and status mutations |
| `harness/state-machine.mjs` | Single source of truth for queue statuses, verifier verdicts, and allowed transitions |
| `harness/verification.mjs` | Verifier execution, failure taxonomy, routing table, and replan follow-up generation |
| `harness/review.mjs` | Review/blocker promotion, suspension guidance, and resume metadata |
| `harness/visibility.mjs` | Queue work, cursor, and family-count payload builders for logs and operator scanability |
| `harness/logger.mjs` | Ordered terminal status logging with stable labels and key ordering |
| `harness/opencode-api.mjs` | OpenCode session/message API wrapper with polling and retry behavior |
| `harness/handoff.mjs` | Markdown handoff rendering and artifact naming |
| `harness/planner.mjs` | Conservative auto-refill planner pass after queue drain |
| `harness/self-test.mjs` | Mock-server end-to-end regression suite |

## Execution flow

```text
runLoop
  -> read queue
  -> normalize V2 shape / recover cursor / recover interrupted items
  -> promote reviewRequired pending items into needs_review
  -> pick next runnable item
  -> load prompt
  -> create or resume OpenCode session
  -> send prompt and wait for assistant reply
  -> write execution handoff
  -> mark verifying
  -> run verifier
  -> route verifier result
       -> completed
       -> needs_replan (+ append follow-up if budget remains)
       -> needs_review
       -> blocked_external
       -> failed
  -> persist queue + verification artifact + final handoff
  -> continue until no runnable work remains
```

## State model

The queue state model is intentionally small and centralized in `harness/state-machine.mjs`.

Queue statuses:

- `pending`
- `in_progress`
- `verifying`
- `completed`
- `deferred`
- `needs_review`
- `blocked_external`
- `needs_replan`
- `failed`

Verifier verdicts:

- `succeeded`
- `needs_replan`
- `needs_review`
- `blocked_external`
- `failed`

Important design rule:

- queue mutation helpers do not freely assign status strings
- they validate against the transition table before mutating state
- this prevents silent drift between runtime, queue helpers, review logic, and verifier closeout

## Routing model

Verifier routing is table-driven inside `harness/verification.mjs`.

Each failure family declares:

- the retry-policy key to consult first
- an optional fallback policy key
- the default verdict when no override matches
- optional inferred matchers for obvious external-blocker or manual-review signals

Current routing shape:

| Failure family | Default | Policy override | Inferred matcher |
|---|---|---|---|
| `verification_command` | `failed` | `onCommandFailure` | infer external dependency / credentials |
| `verification_artifact` | `failed` | `onArtifactFailure` | infer manual-review artifact |
| `verification_acceptance` | `needs_replan` | `onAcceptanceFailure`, fallback `onVerificationFail` | none |
| `verification_constraint` | `needs_replan` | `onConstraintFailure`, fallback `onVerificationFail` | none |
| `acceptance_check_failed` | `needs_replan` | `onAcceptanceFailure`, fallback `onVerificationFail` | none |

Routing resolution order:

1. explicit retry policy
2. inferred matcher
3. default fallback

This keeps routing changes localized to one table instead of scattering more `if/else` branches across verifier code.

## Suspension model

The harness does not treat every failure as another autonomous retry.

Two suspension outcomes are first-class:

- `needs_review`: a human must review or approve the next step
- `blocked_external`: an external dependency, credential, or environment issue must be fixed first

Suspended items keep operator-facing guidance:

- `resumeWhen`
- `resumeHint`
- `lastSuspendedStatus`
- `resumeApprovedAt`
- `resumeNote`

This is what makes manual recovery explicit instead of ad hoc.

## Replan model

`needs_replan` means the task ran, but the verifier says the outcome missed the target.

If `attempt < retryPolicy.maxAttempts`, the harness appends one follow-up item that:

- keeps the same goal narrow
- carries `parentId` and `originVerdict`
- rewrites the prompt around the exact verifier miss

If the retry budget is exhausted, the item becomes `failed` instead of spawning infinite follow-ups.

## Evidence model

Every meaningful run writes evidence for later scan or takeover:

- execution handoff markdown
- verification artifact JSON
- failure taxonomy fields such as `failureCategory`, `failureCode`, `failureDetail`
- `routingReason` when routing came from policy or inference

Handoff and verification artifact filenames share the same timestamp-plus-item-id pattern so replay and scan order stay aligned.

## Planner boundary

The planner is intentionally conservative.

- it only runs when the queue has no runnable work left
- it does not refill while unresolved exception items exist
- it is meant for closeout continuation, not open-ended expansion

This keeps the harness biased toward controlled progress rather than throughput-maximizing automation.

## Why the current structure is healthy

The harness now has three explicit control layers:

- orchestration layer: `runtime.mjs`
- state/routing rules: `state-machine.mjs` and verifier routing table in `verification.mjs`
- side-effect helpers: queue mutations, OpenCode API, handoff rendering, review guidance, visibility payload builders, and terminal logging

That split is useful because future maintenance should mostly happen in the rules layer first, not by adding more ad hoc branches to the runtime.
