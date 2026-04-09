---
name: performance-latency-diagnosis
description: Diagnose latency, slow paths, and bottlenecks in APIs, web apps, background jobs, data pipelines, or RAG systems before making risky behavior changes. Use when traces or logs show slow first byte, slow request handling, slow database access, suspicious Supabase or Prisma latency, slow external calls, or when a project needs a repeatable performance investigation workflow that separates wall-time from real execution cost.
---

# Performance Latency Diagnosis

## Overview

Use this skill to run a conservative latency diagnosis workflow before changing behavior, weakening guarantees, or applying blind optimizations.

Default bias:

- preserve behavior first
- add observability before guessing
- separate database execution time from application wall-time
- prefer connection-path and implementation fixes before semantic retrieval changes

## Workflow

### 1. Confirm the target metric

Identify which latency or throughput target actually matters:

- first byte or first token
- full response time
- database query latency
- external dependency latency
- background job duration
- throughput under concurrency
- page load or interaction latency

If the user just says performance is slow, default to:

- request wall-time
- first-byte or first-visible-result latency
- slowest internal stage

### 2. Split the path before changing behavior

Do not start by changing business logic, reducing work quality, or bypassing safeguards.

First add or inspect timing for:

- request start to first byte
- request start to completion
- queue wait
- database read
- database write
- external API call
- cache lookup
- compute-heavy local processing
- finalization or post-processing

If the system is a RAG or search pipeline, also inspect:

- `retrievalMs`
- `vectorSearchMs`
- `vectorCandidateFetchMs`
- `chunkWindowMs`

If the system already has traces or structured logs, use those first.

### 3. Classify the bottleneck before choosing fixes

Use the timings to classify the problem:

- first-byte small gap but completion large gap: focus on long-running work after response starts
- pre-response stages dominate: focus on orchestration before output begins
- database read or write dominates: inspect connection path and query behavior
- external call dominates: inspect network path, retries, rate limits, and provider latency
- queue wait dominates: inspect concurrency, worker capacity, and scheduling
- CPU-heavy local stage dominates: inspect algorithmic cost and repeated work

If the system is RAG-like, treat retrieval as just one stage, not the default explanation for all slowness.

Do not infer that SQL is slow from application timings alone.

### 4. Separate database execution time from wall-time

This is the most important step.

Check:

- actual table size
- actual index presence
- `EXPLAIN ANALYZE` for the critical SQL
- application-side wall-time for the same query

If database execution is millisecond-level but application wall-time is hundreds of milliseconds or seconds, the problem is likely:

- network RTT
- region mismatch
- driver or connection overhead
- connection pooling path
- TLS or proxy overhead

### 5. Check connection path and deployment topology early

Always verify:

- which datasource or endpoint is actually used
- whether the app and database are in nearby regions
- whether traffic goes through a pooler, proxy, or gateway
- whether a lower-latency direct path exists for critical reads

For latency-sensitive paths, prefer the simplest safe low-latency path when available.

Do not assume the most operationally convenient path is the lowest-latency option.

### 6. Only then decide the optimization layer

Pick the safest layer that matches the root cause:

- connection path or datasource selection
- database query shape
- index changes
- orchestration or await ordering
- retry, timeout, and external-call policy
- implementation cost and repeated work
- business semantics only as a later step

If quality, correctness, or contract stability matters, keep this priority:

1. observability
2. connection path
3. implementation-cost reduction
4. database or index improvements
5. behavior or semantic changes

## Output Expectations

When using this skill, produce a compact diagnosis with:

1. The dominant bottleneck
2. Evidence from timings or plans
3. What is not the bottleneck
4. The next safest optimization step
5. Any correctness or quality-risk warning before changing behavior

## Decision Rules

- If traces are noisy, compare medians from several similar requests rather than a single sample.
- If tables are small, do not over-index on SQL rewrites before checking wall-time and connection path.
- If quality or correctness has already regressed once, avoid semantic shortcuts until connection and implementation layers are exhausted.
- If a pooled or proxied path is slower than a direct path, treat datasource selection as a first-order optimization candidate.

## Reference Files

- For a reusable general Chinese checklist, read:
  - `references/general-latency-checklist.md`
- For Supabase or Prisma specific lessons, read:
  - `references/supabase-prisma-latency-checklist.md`
