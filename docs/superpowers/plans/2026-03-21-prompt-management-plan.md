# Prompt Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend prompt-management layer that owns answer and query-rewrite prompt construction with stable version identifiers.

**Architecture:** Introduce a dedicated `PromptManagerService` in the LLM infra layer, move answer/rewrite prompt construction into typed builder methods, and have `LlmService` consume those builders while preserving current provider behavior and output parsing.

**Tech Stack:** NestJS, TypeScript, node:test, existing LLM adapter layer

---

### Task 1: Lock prompt-management behavior with failing tests

**Files:**
- Create: `apps/api/test/prompt-manager.test.js`
- Modify: `apps/api/test/llm.test.js`

- [ ] Step 1: Write a failing test for `PromptManagerService.buildAnswerPrompt()` that expects `promptId = "answer.v1"` and the current answer-policy/source instructions.
- [ ] Step 2: Write a failing test for `PromptManagerService.buildRewritePrompt()` that expects `promptId = "rewrite-query.v1"` and the current rewrite rules.
- [ ] Step 3: Write a failing `LlmService` test that proves Ollama/OpenAI answer generation uses prompt-manager output rather than inline prompt strings.
- [ ] Step 4: Write a failing `LlmService` test that proves rewrite generation uses prompt-manager output.

### Task 2: Implement the prompt manager and wire it into the LLM module

**Files:**
- Create: `apps/api/src/infra/llm/prompt-manager.service.ts`
- Modify: `apps/api/src/infra/llm/llm.module.ts`
- Modify: `apps/api/src/infra/llm/llm.service.ts`

- [ ] Step 1: Add typed prompt-manager methods for answer and rewrite prompts.
- [ ] Step 2: Move current prompt text and formatting rules from `LlmService` into `PromptManagerService`.
- [ ] Step 3: Inject `PromptManagerService` into `LlmService`.
- [ ] Step 4: Replace inline prompt assembly with prompt-manager calls while preserving current behavior.
- [ ] Step 5: Re-run focused prompt-manager and llm tests until they pass.

### Task 3: Document the new prompt-management layer

**Files:**
- Modify: `docs/current-progress.md`
- Modify: `docs/current-dev-setup.md`

- [ ] Step 1: Mark `更系统的 prompt 管理` complete in `docs/current-progress.md`.
- [ ] Step 2: Add a concise note in `docs/current-dev-setup.md` that answer/rewrite prompts now come from a versioned backend prompt manager.

### Task 4: Verify, commit, and push

**Files:**
- Modify: working tree as produced above

- [ ] Step 1: Run minimal sufficient verification:
  - `pnpm --filter @rag-system/api build`
  - `node --test apps/api/test/prompt-manager.test.js apps/api/test/llm.test.js`
  - `pnpm test:api`
- [ ] Step 2: Review `git status --short` and confirm user-owned `AGENTS.md` changes remain untouched.
- [ ] Step 3: Commit the task-specific files.
- [ ] Step 4: Push the current branch.
