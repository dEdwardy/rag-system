# Client Priority Realignment Design

## Task Identification

This document records a project-priority adjustment requested on `2026-03-21`: the client scope for the current stage is limited to PC Web, and mobile adaptation is deferred until the feature surface and validation coverage are more mature.

## Goal

Align repository planning documents so the automatic development workflow does not continue selecting mobile adaptation as the next task.

## Decision

For the current stage:

- the active client target is `PC Web`
- mobile adaptation is not a current execution priority
- validation depth and core feature completeness take precedence over responsive/mobile polish

## Reasoning

The current engineering risks are still concentrated in:

- integration-level validation
- end-to-end document and ask flows
- retrieval / answering evolution
- future knowledge-source expansion

Mobile adaptation would add layout and interaction work, but would not materially reduce the main product risks in the current phase. It is therefore better deferred until the product surface is more stable.

## Required Documentation Changes

1. `docs/current-progress.md`
   - reorder unchecked tasks so mobile is not the next selected task
   - explicitly state that current client scope is PC Web
   - promote integration automation / E2E items ahead of mobile

2. `docs/current-dev-setup.md`
   - clarify that the current client focus is PC Web
   - note that mobile adaptation is intentionally deferred

## Success Criteria

- `docs/current-progress.md` no longer makes mobile the first unchecked task
- the next recommended work centers on validation and feature completeness
- the current client scope is explicitly documented as PC Web first
