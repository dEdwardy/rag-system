# Current Stage Closeout And Next Step Prep

## Goal

Close the current stage cleanly before opening the next implementation theme.

This plan is split into two waves:

1. close out the current stage
2. prepare the next stage without starting implementation yet

## Scope Rules

### Do

- keep work backend-first
- keep validation focused and serial for heavy checks
- prefer main-control execution with only narrow subagent support when helpful
- keep the current roadmap and completed embedding/retrieval normalization wave intact

### Do Not

- do not reopen completed feature waves unless final verification finds a real issue
- do not start the next implementation theme in the same wave as final closeout
- do not expand into auth, multi-tenant, ACL, mobile, or broad UI redesign
- do not bundle unrelated cleanup into the closeout wave

## Wave A - Close Out Current Stage

### 1. Commit AGENTS workflow guardrails

**What to do**
- review the `AGENTS.md` diff
- confirm the change only contains the newly agreed execution rules
- create a small isolated commit for the repository execution-mode update

**Acceptance Criteria**
- `AGENTS.md` is the only file in the commit
- the file includes both `Main-Control Execution Bias` and `Turbo Mode Guardrails`
- the guardrails include the 90-second progress-update rule, 12-minute split rule, high-risk runtime verification rule, and one-retry limit

### 2. F1 - Plan Compliance Audit

**What to do**
- audit `current-stage-development-roadmap.md` tasks 1-8 against actual repository state
- confirm the implemented waves match the intended roadmap scope
- identify any meaningful gap between roadmap promises and landed code/tests/docs

**Acceptance Criteria**
- roadmap tasks 1-8 are explainable from actual repository state
- any remaining deviation is explicitly documented as acceptable or blocking
- a clear pass/fail conclusion is produced

### 3. F2 - Code Quality Review

**What to do**
- review high-risk backend paths changed during the current stage
- look for logic bugs, scope creep, TODO/HACK leftovers, weak error handling, or fake test coverage
- focus especially on retrieval, answering, traces, ingestion, embedding, vector-store, and shared contracts

**Acceptance Criteria**
- no blocking code-quality issue remains in the current stage deliverables
- any non-blocking risk is listed explicitly
- a clear pass/fail conclusion is produced

### 4. F3 - Real Manual QA

**What to do**
- run one real runtime/API verification sweep for the current stage core flows
- cover at least:
  - `GET /health`
  - `POST /assistants/default-assistant/ask` success path
  - one malformed or missing-input ask path
  - one missing-assistant ask path
  - `GET /traces/:id`
  - one document/run/source read path relevant to the current stage

**Acceptance Criteria**
- the current stage core API paths work on a real running service
- response shapes and trace/read-model outputs are consistent with the intended backend behavior
- a clear pass/fail conclusion is produced

### 5. F4 - Scope Fidelity Check

**What to do**
- confirm current-stage work stayed inside intended scope
- confirm no accidental expansion into deferred areas
- confirm prep work stayed prep work, not silent architecture replacement

**Acceptance Criteria**
- no major scope violation is found
- any minor deviation is explicitly documented
- a clear pass/fail conclusion is produced

### 6. Closeout Decision

**What to do**
- if F1-F4 all pass, conclude the current stage is closed
- if any item fails, fix only the blocking issue and rerun the affected final-verification item(s)

**Acceptance Criteria**
- the current stage is either formally closed or clearly blocked with the next corrective action identified

## Wave B - Prepare The Next Stage

### 7. Select the next backend-first theme

**What to do**
- choose one next theme based on `docs/current-progress.md` and `docs/next_steps_rag_project_plan.md`
- keep the choice small, backend-first, and single-theme

**Acceptance Criteria**
- exactly one next theme is chosen
- the theme excludes UI broadening, auth, multi-tenant, ACL, and unrelated platform rewrites

### 8. Draft the next execution plan boundary

**What to do**
- define what to do, what not to do, file scope, validation scope, and main risks
- stop at plan preparation only

**Acceptance Criteria**
- a new executable plan is ready for the next session
- no implementation for the next theme starts in this wave

## Validation Strategy

- use focused validation during the closeout checks
- keep heavy validation serial
- preserve at least one real runtime/API verification path for high-risk backend flows

## Completion Standard

This plan is complete only when:

- `AGENTS.md` has been committed separately if still pending
- F1-F4 have passed or blocking issues are explicitly identified and corrected
- the current stage has a clear closeout decision
- the next stage has a prepared plan boundary but has not started implementation yet
