# Answering Structured Output And Assistant Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable validated assistant answer policy configuration and a first structured answering contract in the backend ask flow.

**Architecture:** Keep the change backend-only and incremental. Thread a small validated `answerPolicyJson` schema from assistant updates into `AskAssistantService`, have `AnsweringService` request and normalize structured LLM output with safe fallback behavior, and extend the ask response with structured answer metadata while preserving the existing response shape.

**Tech Stack:** NestJS, Prisma, Zod, node:test, existing LLM/fallback adapter

---

### Task 1: Lock In Assistant Policy And Structured Answer Expectations With Tests

**Files:**
- Modify: `apps/api/test/answering.test.js`
- Modify: `apps/api/test/ask-success.test.js`
- Create: `apps/api/test/assistants-api.test.js`

- [ ] **Step 1: Extend `apps/api/test/answering.test.js` with a failing structured-output test**

Assert that `AnsweringService.generateAnswer()` can normalize an LLM result shaped like:

```js
{
  answer: "Structured answer",
  modelName: "test-model",
  answerStatus: "grounded",
  citedChunkNumbers: [2],
  missingInformation: []
}
```

and returns `answerStatus` plus `missingInformation` alongside filtered citations.

- [ ] **Step 2: Add a failing fallback test in `apps/api/test/answering.test.js`**

Assert that when the LLM only returns plain text markers and no structured fields, the service still falls back to citation extraction and returns default structured metadata.

- [ ] **Step 3: Extend `apps/api/test/ask-success.test.js` with policy propagation assertions**

Assert that `AskAssistantService` passes `assistant.answerPolicyJson` into `AnsweringService.generateAnswer()` and returns `answerStatus` / `missingInformation` in the final API-shaped object.

- [ ] **Step 4: Create a focused assistant API regression test**

Create `apps/api/test/assistants-api.test.js` to:

- seed defaults
- `PATCH /assistants/default-assistant` with a valid `answerPolicyJson`
- assert the response includes the persisted policy
- send an invalid `answerPolicyJson.maxCitations`
- assert the API rejects it

- [ ] **Step 5: Run the focused tests and verify they fail for the intended missing behavior**

Run:

```bash
node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js
```

Expected: FAIL because policy validation and structured answer metadata are not implemented yet.

### Task 2: Implement The Backend Contract Minimally

**Files:**
- Modify: `apps/api/src/modules/assistants/assistant.schemas.ts`
- Modify: `apps/api/src/modules/assistants/ask-assistant.service.ts`
- Modify: `apps/api/src/modules/answering/answering.service.ts`
- Modify: `apps/api/src/infra/llm/llm.types.ts`
- Modify: `apps/api/src/infra/llm/llm.service.ts`

- [ ] **Step 1: Add a validated assistant answer policy schema**

Define a reusable Zod schema for:

- `responseStyle`
- `citationMode`
- `maxCitations`
- `noAnswerBehavior`

and allow `updateAssistantSchema` to accept `answerPolicyJson`.

- [ ] **Step 2: Extend LLM answer types for structured metadata**

Update `GenerateAnswerInput` and `GenerateAnswerOutput` to carry normalized answer policy and structured answer metadata.

- [ ] **Step 3: Implement structured answer prompting and parsing**

Update `LlmService` so provider prompts request JSON output, then parse:

- `answer`
- `status`
- `citations`
- `missingInformation`

If parsing fails, gracefully fall back to current plain-text behavior.

- [ ] **Step 4: Normalize answer policy and structured fields in `AnsweringService`**

Apply defaults when policy is missing, cap citations according to `maxCitations`, and return:

- `answer`
- `modelName`
- `citations`
- `retrievedChunks`
- `answerStatus`
- `missingInformation`

- [ ] **Step 5: Thread answer policy through ask orchestration**

Pass `assistant.answerPolicyJson` into `AnsweringService.generateAnswer()` and include structured fields in the ask response.

- [ ] **Step 6: Re-run the focused tests**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js
```

Expected: PASS

### Task 3: Prove The Main HTTP Path Still Works

**Files:**
- Modify: `apps/api/test/api-flow.test.js`

- [ ] **Step 1: Extend the integration assertions for the structured ask response**

After `POST /assistants/default-assistant/ask`, assert:

- `answerStatus` is `grounded` or `insufficient_context`
- `missingInformation` is an array

- [ ] **Step 2: Run the main API path regression**

Run:

```bash
pnpm --filter @rag-system/api build
node --test --test-concurrency=1 apps/api/test/api-flow.test.js
```

Expected: PASS with the extended response contract.

### Task 4: Sync Progress Docs

**Files:**
- Modify: `docs/current-dev-setup.md`
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Update setup docs**

Note the new assistant answer policy capability and the structured ask response fields.

- [ ] **Step 2: Update progress**

Mark `8.2` item `Answering 结构化与 assistant 配置增强` complete and add the task to the recent completed increments list. Do not rewrite unrelated roadmap items.

### Task 5: Final Verification, Commit, And Push

**Files:**
- Modify: working tree as produced above

- [ ] **Step 1: Run minimal sufficient verification**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js
node --test --test-concurrency=1 apps/api/test/api-flow.test.js
```

- [ ] **Step 2: Review git diff and status**

Run:

```bash
git status --short
git diff -- docs/current-progress.md apps/api/src/modules/assistants/assistant.schemas.ts apps/api/src/modules/assistants/ask-assistant.service.ts apps/api/src/modules/answering/answering.service.ts apps/api/src/infra/llm/llm.types.ts apps/api/src/infra/llm/llm.service.ts apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js apps/api/test/api-flow.test.js docs/current-dev-setup.md docs/superpowers/specs/2026-03-21-answering-structured-assistant-config-design.md docs/superpowers/plans/2026-03-21-answering-structured-assistant-config-plan.md
```

- [ ] **Step 3: Commit and push**

Run:

```bash
git add docs/current-progress.md docs/current-dev-setup.md docs/superpowers/specs/2026-03-21-answering-structured-assistant-config-design.md docs/superpowers/plans/2026-03-21-answering-structured-assistant-config-plan.md apps/api/src/modules/assistants/assistant.schemas.ts apps/api/src/modules/assistants/ask-assistant.service.ts apps/api/src/modules/answering/answering.service.ts apps/api/src/infra/llm/llm.types.ts apps/api/src/infra/llm/llm.service.ts apps/api/test/answering.test.js apps/api/test/ask-success.test.js apps/api/test/assistants-api.test.js apps/api/test/api-flow.test.js
git commit -m "feat(api): structure answering output"
git push
```

- [ ] **Step 4: Final delivery summary**

Report:

- identified task
- commands run and results
- updated docs
- commit hash
- push result
