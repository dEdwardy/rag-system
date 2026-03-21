# Assistant Answer Policy Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand backend assistant answer policy support so more policy fields are validated, rendered into prompts, and partly enforced in the final answer result.

**Architecture:** Keep the change backend-only and backward-compatible. Extend the flat `answerPolicyJson` schema, normalize it in `AnsweringService`, update `PromptManagerService` to render the richer policy contract, and add deterministic enforcement only for the fields that can be safely applied after generation.

**Tech Stack:** NestJS, Zod, node:test, existing prompt manager and answering pipeline

---

### Task 1: Lock The Expanded Policy Contract With Failing Tests

**Files:**
- Modify: `apps/api/test/assistants-api.test.js`
- Modify: `apps/api/test/answering.test.js`
- Modify: `apps/api/test/ask-success.test.js`
- Modify: `apps/api/test/prompt-manager.test.js`

- [ ] **Step 1: Extend the assistant API regression test**

Update `apps/api/test/assistants-api.test.js` so a valid payload includes:

- `responseStyle: "balanced"`
- `tone`
- `outputFormat`
- `language`
- `includeMissingInformation`

Also add an invalid new-field assertion such as `outputFormat: "table"`.

- [ ] **Step 2: Add a failing deterministic-answering test**

Update `apps/api/test/answering.test.js` to assert:

- `citationMode: "optional"` does not fabricate fallback citations when the model returns none
- `includeMissingInformation: false` clears final `missingInformation`

- [ ] **Step 3: Extend ask orchestration assertions**

Update `apps/api/test/ask-success.test.js` so `assistant.answerPolicyJson` contains the expanded fields and the forwarded object matches exactly.

- [ ] **Step 4: Extend prompt manager assertions**

Update `apps/api/test/prompt-manager.test.js` to assert the managed answer prompt includes the new policy lines and the prompt id version bump.

- [ ] **Step 5: Run focused tests and confirm the intended failures**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js apps/api/test/prompt-manager.test.js
```

Expected: FAIL because the new policy fields and deterministic handling are not implemented yet.

### Task 2: Implement The Expanded Policy Surface

**Files:**
- Modify: `apps/api/src/modules/assistants/assistant.schemas.ts`
- Modify: `apps/api/src/modules/assistants/ask-assistant.service.ts`
- Modify: `apps/api/src/modules/answering/answering.service.ts`
- Modify: `apps/api/src/infra/llm/llm.types.ts`
- Modify: `apps/api/src/infra/llm/prompt-manager.service.ts`

- [ ] **Step 1: Expand the answer policy schema**

Add the new optional fields and widen `responseStyle` while keeping backward compatibility.

- [ ] **Step 2: Expand the typed answer policy contract**

Update `apps/api/src/infra/llm/llm.types.ts` so the richer policy object is available to prompt generation and answer normalization.

- [ ] **Step 3: Normalize defaults in `AnsweringService`**

Add defaults for the new policy fields and keep existing assistants working unchanged.

- [ ] **Step 4: Add deterministic post-processing**

Implement:

- `citationMode=optional` => no heuristic fallback citations when the model returned none
- `includeMissingInformation=false` => final `missingInformation` becomes `[]`

- [ ] **Step 5: Render the richer policy in `PromptManagerService`**

Advance the answer prompt version and include explicit prompt instructions for the new fields.

- [ ] **Step 6: Re-run focused tests**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js apps/api/test/prompt-manager.test.js
```

Expected: PASS

### Task 3: Sync Docs And Progress

**Files:**
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update setup docs**

Document the expanded `answerPolicyJson` fields and current defaults.

- [ ] **Step 2: Update progress**

Mark `更完整的 assistant / answer policy 配置能力` complete and add this task to the latest completed increments list.

### Task 4: Final Verification, Commit, And Push

**Files:**
- Modify: working tree as produced above

- [ ] **Step 1: Run minimal sufficient verification**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js apps/api/test/prompt-manager.test.js
```

- [ ] **Step 2: Review task-only diff and status**

Run:

```bash
git status --short
git diff -- docs/current-dev-setup.md docs/current-progress.md docs/superpowers/specs/2026-03-21-assistant-answer-policy-expansion-design.md docs/superpowers/plans/2026-03-21-assistant-answer-policy-expansion-plan.md apps/api/src/modules/assistants/assistant.schemas.ts apps/api/src/modules/assistants/ask-assistant.service.ts apps/api/src/modules/answering/answering.service.ts apps/api/src/infra/llm/llm.types.ts apps/api/src/infra/llm/prompt-manager.service.ts apps/api/test/assistants-api.test.js apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/prompt-manager.test.js
```

- [ ] **Step 3: Commit and push**

Run:

```bash
git add docs/current-dev-setup.md docs/current-progress.md docs/superpowers/specs/2026-03-21-assistant-answer-policy-expansion-design.md docs/superpowers/plans/2026-03-21-assistant-answer-policy-expansion-plan.md apps/api/src/modules/assistants/assistant.schemas.ts apps/api/src/modules/assistants/ask-assistant.service.ts apps/api/src/modules/answering/answering.service.ts apps/api/src/infra/llm/llm.types.ts apps/api/src/infra/llm/prompt-manager.service.ts apps/api/test/assistants-api.test.js apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/prompt-manager.test.js
git commit -m "feat(api): expand assistant answer policy"
git push
```

- [ ] **Step 4: Prepare the next-chat handoff**

Report the completed task, commands run, docs updated, commit hash, push result, and the next recommended unchecked task.
