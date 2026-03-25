# Embedding Retrieval Config Normalization

## TL;DR
> **Summary**: Close the current embedding / retrieval configuration gap in one medium-large backend wave. Normalize provider / model / dimension resolution, make indexing and retrieval consume the same resolved config, and fail clearly on incompatible combinations instead of silently degrading.
> **Deliverables**:
> - unified embedding runtime contract
> - centralized resolution + validation path
> - indexing / retrieval config consistency
> - clearer diagnostics for active embedding behavior
> - focused regression coverage for compatibility and failure paths
> **Effort**: L
> **Parallel**: LIMITED - mostly serial, with one light analysis subtask allowed up front
> **Critical Path**: 1 -> 2 -> 3 -> 4 -> 5 -> 6

## Context
### Original Request
用户希望下一轮不要步子太小，但也不要直接跳到 worker split、vector store replacement 这类高风险架构改造；先把更值钱、边界更清晰的一整波 backend work 规划好，暂时只输出 plan markdown，后续再执行。

### Why This Theme Now
- Recent work already normalized runtime seams, retrieval / answering behavior, queue preparation, and vector-store upgrade seams.
- `docs/current-progress.md` still indicates embedding model selection / dimension management is not fully normalized.
- Repository priorities remain: backend correctness -> retrieval quality -> ingestion reliability -> diagnostics.
- This theme is larger than a tiny patch, but still bounded enough to avoid turning into a platform rewrite.

### Non-Goals
- Do not replace the current vector store in this stage.
- Do not perform a true worker / API process split in this stage.
- Do not expand retrieval strategy knobs or redesign ranking architecture.
- Do not widen into frontend feature work beyond contract-following changes if absolutely required.
- Do not introduce automatic embedding-index migration in this stage.

## Work Objectives
### Core Objective
Make embedding configuration an explicit, validated, diagnosable runtime contract shared by indexing and retrieval, so incompatible provider / model / dimension combinations fail clearly and current local-dev behavior remains understandable.

### Deliverables
- a single resolved embedding config contract
- one centralized resolution / validation path
- shared consumption by indexing and retrieval
- explicit diagnostics for active provider/model/dimension/fallback state
- focused tests for valid, invalid, and mismatch scenarios

### Definition of Done
- There is exactly one authoritative resolved embedding config path used by both indexing and retrieval.
- Invalid or incomplete provider / model / dimension combinations fail explicitly with actionable error messages.
- Indexing and retrieval no longer drift through separate implicit defaults.
- Focused embedding / retrieval validation passes.
- If cross-package or build-sensitive files are touched, `pnpm build` passes.

### Must Have
- backend-first
- single-theme increment
- focused validation first
- no silent config drift
- no silent dimension mismatch success

### Must NOT Have
- no storage-engine migration
- no broad retrieval redesign
- no speculative multi-provider abstraction layer beyond current need
- no broad UI or product-surface expansion

## Verification Strategy
> Prefer source-first tests. Keep heavy validation serial.

- Primary checks:
  - `pnpm --filter @rag-system/api test:file -- test/retrieval.test.js`
  - `pnpm --filter @rag-system/api test:file -- test/llm.test.js`
  - `pnpm test:api:focus:llm-retrieval`
- Add focused config/runtime tests if new embedding-runtime files are introduced.
- If the implementation touches shared contracts, startup wiring, or build-sensitive config paths, also run:
  - `pnpm build`

## Execution Strategy
### Recommended Working Order
1. map current embedding config entry points and actual runtime resolution
2. define the resolved contract before rewriting consumers
3. centralize parsing / defaults / validation
4. switch indexing and retrieval to the shared resolved config
5. add diagnostics and mismatch protection
6. add focused regression coverage and close with validation

### Risk Notes
- The biggest risk is accidental behavior drift from changing defaults too early.
- The second biggest risk is treating dimension mismatch as a soft warning when it should be an explicit failure.
- Keep the change bounded: normalize and validate current behavior, do not broaden capabilities.

## TODOs

- [x] 1. Audit current embedding config entry points and runtime behavior

  **What to do**: Inventory where embedding provider / model / dimension currently come from, how defaults are inferred, where fallback behavior appears, and how indexing versus retrieval resolve their active settings.
  **Must NOT do**: Do not change behavior yet; this step is for authoritative mapping only.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: config mapping affects high-risk backend paths
  - Skills: `[]`

  **Parallelization**: Can Parallel: LIMITED | Wave 1 | Blocks: 2, 3, 4, 5, 6 | Blocked By: none

  **References**:
  - `docs/current-progress.md`
  - `apps/api/src/infra/embedding/*`
  - `apps/api/src/modules/indexing/*`
  - `apps/api/src/modules/retrieval/*`
  - `apps/api/src/infra/llm/*` if embedding fallback or provider conventions are shared there
  - any env-loading / runtime-config helpers currently used by API startup

  **Acceptance Criteria**:
  - [ ] Current embedding resolution path is documented in-code or captured clearly enough for execution
  - [ ] Indexing and retrieval entry points are identified
  - [ ] Known fallback/default behaviors are identified before refactor begins

- [x] 2. Introduce a unified resolved embedding config contract

  **What to do**: Define one explicit runtime contract for active embedding settings, including at least provider, model, dimension, and source/fallback provenance where relevant.
  **Must NOT do**: Do not create a generalized future platform abstraction; keep it tied to current runtime needs.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: `[]`

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 3, 4, 5, 6 | Blocked By: 1

  **References**:
  - `apps/api/src/infra/embedding/*`
  - existing runtime-config patterns in `apps/api/src/infra/llm/*` and `apps/api/src/infra/queue/*`
  - `docs/current-dev-setup.md` for environment guidance style if docs need a brief update later

  **Acceptance Criteria**:
  - [ ] One resolved contract exists for active embedding settings
  - [ ] Contract shape is narrow, explicit, and suitable for diagnostics
  - [ ] No second competing contract remains in touched paths

- [x] 3. Centralize config parsing, defaults, and compatibility validation

  **What to do**: Create a single resolution / validation path that reads current config inputs, applies defaults, and rejects incompatible or incomplete provider/model/dimension combinations with explicit errors.
  **Must NOT do**: Do not silently coerce incompatible dimension values; do not hide invalid combinations behind generic fallback.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: `[]`

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 4, 5, 6 | Blocked By: 2

  **References**:
  - resolved contract from Task 2
  - existing runtime-config implementations in `apps/api/src/infra/llm/llm-runtime-config.ts` and `apps/api/src/infra/queue/queue-runtime-config.ts`
  - startup path in `apps/api/src/main.ts` or embedding consumers if validation is lazy instead of eager

  **Acceptance Criteria**:
  - [ ] Invalid config combinations fail explicitly
  - [ ] Valid current defaults still resolve deterministically
  - [ ] Error text is actionable enough to identify the bad field or incompatibility

- [x] 4. Align indexing and retrieval to the same resolved embedding settings

  **What to do**: Refactor indexing and retrieval to consume the shared resolved embedding config instead of drifting through local defaults or duplicated inference.
  **Must NOT do**: Do not broaden this into retrieval strategy redesign or vector-store replacement.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: `[]`

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 5, 6 | Blocked By: 3

  **References**:
  - `apps/api/src/modules/indexing/*`
  - `apps/api/src/modules/retrieval/*`
  - `apps/api/src/infra/vector-store/*`
  - `apps/api/src/infra/embedding/*`

  **Acceptance Criteria**:
  - [ ] Indexing and retrieval read the same resolved embedding config path
  - [ ] Touched code no longer carries duplicated embedding defaults
  - [ ] Current happy-path behavior remains intact for valid config

- [x] 5. Add mismatch protection and diagnostics for active embedding behavior

  **What to do**: Surface enough diagnostics to tell operators what embedding config is active and fail clearly when the current embedding dimension/config is incompatible with existing indexed data or retrieval expectations.
  **Must NOT do**: Do not build automatic migration or background repair in this stage.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: `[]`

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 6 | Blocked By: 4

  **References**:
  - `apps/api/src/modules/indexing/*`
  - `apps/api/src/modules/retrieval/*`
  - `apps/api/src/modules/traces/*` if existing trace/read-model diagnostics are the right place to expose additive metadata
  - `docs/current-progress.md`

  **Acceptance Criteria**:
  - [ ] Active embedding provider/model/dimension can be diagnosed from touched runtime surfaces
  - [ ] Incompatible config/index situations do not silently continue as if valid
  - [ ] Added diagnostics stay additive and bounded

- [x] 6. Add focused regression coverage and close with bounded validation

  **What to do**: Add the minimum focused tests needed to prove valid config resolution, invalid compatibility rejection, shared indexing/retrieval consumption, and mismatch failure behavior.
  **Must NOT do**: Do not expand into a full platform-level test rewrite; keep coverage focused on this theme.

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: `[]`

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: none | Blocked By: 5

  **References**:
  - `apps/api/test/retrieval.test.js`
  - `apps/api/test/llm.test.js`
  - `apps/api/test/document-chain-e2e.test.js` only if mismatch behavior must be proven through a chain path
  - any new focused embedding-runtime test file created in this wave

  **Acceptance Criteria**:
  - [ ] Focused embedding / retrieval tests cover valid and invalid config paths
  - [ ] `pnpm test:api:focus:llm-retrieval` passes
  - [ ] `pnpm build` passes if touched scope requires cross-package/build validation

## QA Scenarios

```bash
Scenario: Valid embedding config happy path
  Tool: Bash
  Steps: Run `pnpm test:api:focus:llm-retrieval`
  Expected: Retrieval / LLM focused tests pass with shared embedding config resolution intact

Scenario: Invalid compatibility edge path
  Tool: Bash
  Steps: Run the new focused embedding config tests (or `pnpm --filter @rag-system/api test:file -- <new-test-file>`)
  Expected: Invalid provider/model/dimension combinations fail with explicit diagnostics

Scenario: Cross-package/build edge path
  Tool: Bash
  Steps: Run `pnpm build`
  Expected: Build passes if shared runtime/config contracts were touched
```

## Commit Strategy
- Keep this as one theme commit if implemented as a single bounded wave.
- If the work naturally splits, prefer:
  1. config contract + validation
  2. indexing/retrieval alignment + diagnostics/tests
- Do not bundle unrelated runtime or frontend work into this theme.

## Success Criteria
- Embedding config stops being an implicit, drifting concern.
- Indexing and retrieval share one trustworthy configuration path.
- Operators get explicit failure or diagnostics instead of silent degradation.
- The repository moves forward in a medium-large backend-first increment without prematurely entering heavy architecture migration.
