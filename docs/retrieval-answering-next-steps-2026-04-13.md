# Retrieval And Answering Next Steps - 2026-04-13

## Purpose

This note captures the most worthwhile follow-up work for retrieval and answering quality based on the current repository implementation, local smoke behavior, and recent trace-guided fixes.

It is intentionally scoped to bounded, incremental improvements.

## Current Baseline

- The project is already in a usable quality band for normal local RAG workflows.
- Structured Markdown retrieval improved after the heading-neighbor expansion fix in `retrieval.service.ts`.
- Local smoke run against [D:\FeProjects\rag-test\question.md](D:\FeProjects\rag-test\question.md) produced `37/40` grounded answers.
- The current weak points are no longer basic chain breakage; they are mostly:
  - retrieval adaptivity
  - structured-document context assembly
  - selective quality hardening for summary/list/why/how questions

## Priority 1: Do Next

### 1. Tool the current smoke set

Turn the existing local smoke workflow into a replayable command or script.

Why this is first:

- It protects current quality before further optimization.
- It makes retrieval/answering changes much safer to iterate on.
- The repository already has a practical local baseline in [local-smoke-eval-2026-04-13.md](D:\FeProjects\rag-system\docs\local-smoke-eval-2026-04-13.md).

Desired outcome:

- one command to replay the question set
- output grouped into `passed / reasonable_refusal / potential_regression`

### 2. Add lightweight dynamic retrieval expansion

Do not globally raise defaults. Expand retrieval only when the first-pass evidence looks thin.

Useful gating signals:

- primary chunks are too short
- heading-only or structure-heavy hits dominate
- average primary score is low
- the question looks like `why / how / compare / summarize / list`

Why this is the best retrieval ROI:

- it is more targeted than globally raising `topK`
- it is less invasive than a chunking rewrite
- it fits the current trace metadata model

### 3. Keep strengthening structured-document context assembly

The current heading-neighbor expansion is a good first step, but structured docs still deserve more targeted handling.

High-value next increments:

- when a list block is primary, consider attaching its parent heading
- when the question asks for significance, cause, or solution, prefer explanation-adjacent chunks
- keep heading/list/table heuristics separate instead of treating all chunk types the same

### 4. Add clearer retrieval diagnosis labels

The trace surface already has enough raw data. The next gain is more readable failure classification.

Examples:

- `heading_only_retrieval`
- `evidence_too_thin`
- `question_requires_explanation`
- `retrieved_but_answer_overly_conservative`

This improves debugging speed without changing answer behavior.

## Priority 2: Worth Doing Soon

### 5. Add simple question-type routing

Start with a lightweight classifier:

- fact
- list/summary
- compare
- why/how

Use it only to influence retrieval strategy, not to open a second architecture layer.

Likely controls:

- `topK`
- rerank on/off
- rewrite on/off
- context packing style

### 6. Make rerank and rewrite more conditional

Do not run expensive retrieval helpers for every question.

Recommended direction:

- keep rewrite off by default, enable only when heuristics say it is worth the latency
- keep rerank focused on larger or more ambiguous candidate sets

### 7. Improve grounded-answer completeness checks

Some questions already answer correctly but still under-cover the expected item set.

Useful bounded checks:

- if the prompt asks for `哪些 / 包括什么 / goals and challenges`, prefer multi-item coverage
- if citations span multiple context groups, bias toward merged summary instead of single-point answers

The goal is not to make the model freer. The goal is to reduce narrow-but-technically-grounded answers.

## Priority 3: Good Later Investments

### 8. Limited overlap for selected chunk types

Overlap is a valid technique, but it should not be the first global response.

Best fit:

- long narrative paragraphs
- FAQ-like explanatory content
- content where one fact often crosses a hard boundary

Why later:

- it affects indexing behavior globally
- it increases duplication and prompt noise if overused
- the current project is getting more value from structural assembly than from global overlap

### 9. More specialized chunking by block type

This would mean treating:

- heading
- paragraph
- list
- table
- faq

as intentionally different chunk families.

This is promising, but heavier than the current bounded maintenance phase needs.

### 10. Two-stage adaptive retrieval

Example shape:

- first pass with a small candidate set
- detect thin or weak evidence
- expand or change strategy
- answer only after the second pass when needed

This is valuable, but should follow after smoke automation and light dynamic retrieval are in place.

## Not Recommended Right Now

- globally raising default `topK`
- globally turning `chunkWindow` back up
- globally enabling overlap
- broad chunking rewrites
- retrieval planner / agentic retrieval expansion
- loosening the product boundary away from “answer from sources”

## Practical Order

1. tool the smoke question set
2. add lightweight dynamic retrieval expansion
3. extend structured-document context assembly
4. add clearer retrieval diagnosis labels
5. route by coarse question type
6. selectively enable rerank/rewrite
7. trial limited overlap only where evidence shows it helps

## One-Line Recommendation

The best next step is not a broad retrieval rewrite. It is to move from fixed-parameter retrieval toward lightly adaptive retrieval, while keeping the current source-grounded behavior and protecting quality with replayable smoke checks.
