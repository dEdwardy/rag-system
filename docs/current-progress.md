# Current Progress

> 文档角色：`current-status`
> 当前使用方式：保留最近仍有参考价值的进展摘要、当前活跃边界和 focused validation 基线；更旧的细节型流水记录不再作为默认上下文入口，按需从 git history 回看。
> 更新时间：2026-04-24

## Current Snapshot

- 当前默认方式仍是：单线推进、小步增量、每轮收口。
- 代码现实已明显前于旧计划表述：
  - `P3` external-source family + guardrails：开发已完成，当前只保留维护态 follow-up
  - `P4` 当前这一轮 web capability carry-through：收口已完成，当前只保留 bounded follow-up
  - `P5` eval / regression baseline：工程能力已完成，当前只保留基线治理和使用态 follow-up
- 默认助手 / 默认知识库 / 默认 retrieval profile 的 bootstrap 与 repair 也已经落地，默认路径不应再被视为待搭建能力。
- 因此，`P3` / 当前这轮 `P4` / `P5` 不应再被视为“下一步主开发波次”。
- 当前更合适的下一步是：
  - 在已完成区域内继续做 bounded maintenance
  - 继续收紧 canonical default assistant 行为和默认路径文案
  - 并在现有 RAG 主链路上补一个最小 agent 化增量

## Current Chosen Next Increment

- 当前明确选择的下一步不是再开新平台波次，而是补一个最小 agent 化能力。
- 目标是让 ask 入口从固定单路径处理，升级为“先判断问题类型，再走对应处理链路”。
- 当前新增了固定实现约束：高内聚、低耦合。后续最小 agent 化实现会把 route decision、source fetch、route-specific orchestration、trace 回写拆开，不继续把分支堆进一个大方法。
- 当前约束已经明确：
  - 优先做轻量 route decision / classifier
  - 优先复用现有 KB ask、external-source family、deterministic reply 能力
  - 优先把 route decision 写进 trace / metadata
  - 不扩成 planner、multi-agent、复杂 memory 或自治任务系统

## Recent Landed Increments

- `external-source workflow mode` now marks the multi-source external route as a workflow-style execution plan while keeping the single-source path manual
  - `packages/shared/src/trace-contracts.ts` now returns `executionMode: workflow` when `external_source` fans out across more than one source URL
  - `apps/api/test/ask-success.test.js` now locks the multi-source external routing case so the trace metadata keeps the workflow label visible on fan-out paths
  - this keeps the minimal agentization contract aligned with the actual multi-hop shape without introducing a planner or a broader agent runtime

- `markdown-link external source recognition` widened the explicit-source branch to handle a more realistic copy/paste pattern
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now extracts URLs from markdown links before falling back to bare URL matching
  - `apps/api/test/ask-success.test.js` now covers the markdown-link form so a pasted `[title](url)` still routes through external-source instead of default KB ask

- `external-source route precedence regression` now protects the explicit-source branch and the source-family split with focused tests
  - `apps/api/test/ask-success.test.js` adds a regression that checks sitemap URLs still route to `sitemap` and feed URLs route to `feed`
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now treats sitemap matching more narrowly, so generic `.xml` URLs do not automatically fall into the sitemap branch

- `multi-source external routing` now lets explicit source questions fan out to multiple source URLs instead of collapsing them into one synthetic chunk
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now recognizes multiple markdown links / URLs, fetches them in parallel, and forwards one chunk per fetched source into answering
  - `apps/api/test/ask-success.test.js` now covers the multi-source path so a single question with two explicit links produces two fetched sources and a two-chunk answer path
  - `apps/api/src/modules/traces/traces.service.ts` and `packages/shared/src/trace-contracts.ts` already carry the `explicit_source_urls` route reason so multi-source routing stays observable in trace metadata
  - the external-source path remains intentionally conservative: it only fans out when explicit source URLs are present, so the minimal agentization split stays high cohesion / low coupling

- `structured source labels` now make explicit source inputs more readable without changing the conservative route boundary
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now preserves markdown link text as a source label when present, so route metadata can surface human-readable source names instead of only raw URLs
  - bare URLs still work as before, so existing copy/paste flows remain compatible

- `trace detail external-source panel` now surfaces the labeled explicit sources directly in the UI
  - `apps/web/src/pages/traces/TraceDetailSupportPanels.tsx` now renders an `External sources` section from `retrievalMetadataJson.externalSources`
  - multi-source and labeled single-source traces are easier to inspect without opening the raw payload block

- `trace list route summary` now exposes the routing decision at the conversation-card level
  - `apps/web/src/pages/traces/TraceListPage.tsx` now shows `routeType / routeReason` from `traceSummary.routeDecisionSummary`
  - external-source traces also show a compact source-chunk count, which makes route behavior visible before entering detail view
  - the same list view now accepts `routeType` and `routeReason` query params, and the API trace list endpoint honors the same route filters without changing the existing keyword search behavior
  - the trace list hero now includes explicit route filter buttons, so the route decision can be narrowed without manually editing the URL
  - `apps/web/src/pages/reports/ReportCenterPage.tsx` now adds a small route-view shortcut block that jumps directly to the filtered trace list for knowledge-base, policy-reply, or external-source routes
  - `apps/web/src/pages/reports/ReportResultsTable.tsx` now includes the same route-view shortcuts in the results toolbar so route inspection stays close to the per-row review flow
  - the repeated route shortcut buttons are now centralized in `apps/web/src/pages/reports/ReportRouteViewShortcuts.tsx` so both report surfaces stay coupled to the same small navigation widget instead of duplicating the link set
  - `apps/web/src/pages/traces/TraceListPage.tsx` now reuses the same route shortcut widget, so the trace list and report surfaces stay aligned on a single small navigation entry point
  - `apps/web/src/pages/traces/TraceRouteFilterPanel.tsx` now bundles the trace-page route filter hint with the shared navigation widget, keeping the trace list hero focused while preserving the same route controls
  - the trace filter panel now includes a clear-filters action so route-specific trace views can fall back to the full list without manual URL edits
  - the trace filter panel now also surfaces the active route type / reason as badges, making the current trace-view context readable at a glance

- `route metadata base extraction` further reduced duplication inside the minimal agentization path by centralizing the shared non-KB metadata scaffold
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now uses one shared `buildRouteMetadataBase(...)` helper for the common `queryRewrite / strategySummary / execution` scaffold
  - `buildPolicyRouteMetadata(...)` and `buildExternalSourceRouteMetadata(...)` now stay focused on their route-specific payloads instead of re-declaring the same base shape

- `trace route readability follow-up` cleaned up a couple of diagnostic labels and kept execution mode visible in the trace detail view
  - `apps/web/src/pages/traces/TraceListPage.tsx` now shows readable Chinese labels for route decision and external-source rows instead of mojibake text
  - `apps/web/src/pages/traces/TraceDetailSupportPanels.tsx` now surfaces the execution mode badge next to the execution-step heading so `manual / workflow` remains visible in detail view

- `trace execution overview follow-up` added a compact execution-plan summary on top of the step list
  - `apps/web/src/pages/traces/TraceDetailSupportPanels.tsx` now shows the total step count alongside the `manual / workflow` execution-mode badge
  - this keeps the agentic execution shape readable at a glance before drilling into each step row

- `execution mode summary contract` promoted the execution mode into the shared trace summary so every consumer can read one canonical field
  - `packages/shared/src/trace-contracts.ts` now includes `executionMode` and its readability fields on `TraceSummary`
  - `apps/api/src/modules/traces/traces.service.ts` now derives the execution mode from the execution plan once and exposes it through the summary contract
  - `apps/web/src/pages/traces/TraceListPage.tsx` and `apps/web/src/pages/traces/TraceDetailSupportPanels.tsx` now read the canonical execution mode from summary instead of reaching back into the nested execution plan

- `execution tool name contract` started the minimal tool abstraction by attaching a canonical tool name to each execution step
  - `packages/shared/src/trace-contracts.ts` now lets execution steps carry `toolName` values such as `knowledge_base_search`, `external_source_fetch`, and `policy_reply`
  - `apps/api/src/modules/traces/traces.service.ts` now preserves the step-level tool name when reading trace metadata
  - `apps/web/src/pages/traces/TraceDetailSupportPanels.tsx` now renders the tool name badge for each execution step when present, making the execution layer easier to compare with future workflow executors

- `execution tool label registry` centralized the visible tool labels so trace consumers do not have to invent their own text
  - `packages/shared/src/trace-contracts.ts` now exports `TRACE_EXECUTION_TOOL_LABELS` and `buildTraceExecutionToolLabel(...)` as the shared registry
  - `apps/web/src/pages/traces/TraceDetailSupportPanels.tsx` now resolves the label from the shared registry before falling back to the raw tool name

- `execution tool summary contract` promoted the unique tool list into trace summary so route cards can show the tool surface at a glance
  - `packages/shared/src/trace-contracts.ts` now exposes `executionToolNames` on `TraceSummary` and a small helper to collect the names from the execution plan
  - `apps/api/src/modules/traces/traces.service.ts` now populates the summary-level tool list from the execution plan once
  - `apps/web/src/pages/traces/TraceListPage.tsx` now shows a compact execution-tools badge when a trace used routed tools, without expanding the full step list in the card body
  - `apps/web/src/pages/traces/TraceDetailSupportPanels.tsx` now shows the same summary-level execution-tool label above the detailed step rows so list and detail views stay aligned

- `special route executor registry` tightened the ask-path dispatch boundary so the special routes are selected from a small registry instead of chained conditionals
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now dispatches `policy_reply` and `external_source` through a tiny executor map
  - the change keeps the minimal agentization path more extensible without changing the underlying behavior or adding a broader runtime layer

- `external source title helper` removed one more nested ternary from the external-source execution path
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now uses one small helper to normalize external-source step titles and trace labels
  - this keeps the multi-source path easier to read while preserving the same route and trace behavior

- `route answer persistence helper` further reduced repetition inside the non-KB routes by consolidating message/trace persistence and trace finalization
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now uses one shared `persistRouteAnswerResult(...)` helper to handle assistant message creation, trace attachment, conversation touch, and trace update for policy/external paths
  - route-specific decisioning and payload assembly still stay separate, so the minimal agentization path remains high cohesion / low coupling

- `route-result payload extraction` further reduced coupling inside the minimal agentization path by centralizing policy/external route result assembly
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now uses one shared `buildRouteResultPayload(...)` helper to assemble route result output for the non-KB paths instead of repeating the payload shape in each handler
  - the route handlers still stay separate, so the split remains high cohesion / low coupling rather than collapsing into another oversized orchestration block

- `minimal agentization route split` 已落地第一版 ask 路由分流，并按高内聚、低耦合约束收口
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` 现在会先做 route decision，再在 `knowledge_base / policy_reply / external_source` 三条路径之间分流
  - `policy_reply` 继续保留为系统策略类问题的确定性回复路径
  - `external_source` 第一版只覆盖“问题中包含显式 URL”的保守场景，并复用现有 `web page / feed / sitemap` source family 能力，而不是引入自治抓取
  - route decision 已写入 trace metadata，并进入 trace summary 契约
  - focused validation:
    - `pnpm test:api:file -- test/ask-success.test.js`
    - `pnpm test:api:file -- test/ask-stream-service.test.js`
    - `pnpm test:api:file -- test/traces.service.test.js`
    - `pnpm check:encoding`

## Recent Landed Increments

- `default-path first-token thin pass final follow-up` tightened the same ask-stream orchestration slice without changing retrieval semantics or stage judgment
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now emits the `generating` status event eagerly and only awaits it at first answer emission boundaries, removing one avoidable pre-token wait on the default path
  - `apps/api/test/ask-stream-service.test.js` now locks this with a focused regression so `generating` status dispatch remains non-blocking for first-token timing
  - focused validation:
    - `pnpm test:api:file -- test/ask-stream-service.test.js`

- `default-assistant repair fallback canonicalization` closed a remaining bootstrap/repair drift edge on the same single-primary-KB path
  - `apps/api/src/modules/auth/auth.service.ts` fallback selection now prefers the canonical default-assistant identity before generic first-record fallback when read capabilities are constrained
  - `apps/api/test/auth-provider-boundary.test.js` now covers this repair-fallback ordering so duplicate/legacy assistant drift does not silently pick a non-canonical binding first
  - focused validation:
    - `pnpm --filter @rag-system/api exec vitest run test/auth-provider-boundary.test.js`

- `default-assistant repair next-action copy` clarified the same bounded path guidance for users waiting on bootstrap/repair completion
  - `apps/web/src/i18n/messages.en.ts` and `apps/web/src/i18n/messages.zh.ts` now keep the assistant-repair next action wording aligned with the current default-path behavior
  - focused validation:
    - `pnpm --filter @rag-system/web test:vitest:file -- test/i18n-copy.test.js`

- `default knowledge base canonical selection alignment` tightened the current single-primary-KB path so both API reads and web workspace selection prefer the canonical active `Default Knowledge Base` instead of blindly accepting the first returned item
  - `apps/api/src/modules/knowledge-bases/knowledge-bases.service.ts` now reorders scoped knowledge-base list reads so the canonical active default KB stays ahead of same-owner duplicates and drifted naming variants
  - `apps/web/src/features/api/workspace-selection.ts` now applies the same canonical default-KB priority before choosing the current primary workspace on the client
  - `apps/api/test/knowledge-bases-auth-write-path.test.js` and `apps/web/test/workspace-selection.test.js` now cover the canonical default-KB priority rule and the duplicate-looking default drift case
  - focused validation:
    - `pnpm test:api:file -- test/knowledge-bases-auth-write-path.test.js`
    - `pnpm --filter @rag-system/web exec vitest run test/workspace-selection.test.js`

- `default-path maintenance next wave follow-up` kept the same bounded stage judgment and tightened the current single-primary-KB default path with one more small pass across API latency, default-assistant drift coverage, and documents-to-chat clarity
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now overlaps retrieval work with early stream status delivery so first-token pre-generation orchestration cost is thinner without changing retrieval semantics
  - `apps/web/src/i18n/messages.en.ts`, `apps/web/src/i18n/messages.zh.ts`, `apps/web/src/pages/chat/ChatPage.tsx`, and `apps/web/src/pages/chat/chat-page-helpers.ts` now keep upload-ready next actions and starter auto-ask behavior clearer on the first-turn path
  - `apps/api/test/auth-provider-boundary.test.js`, `apps/api/test/retrieval-profiles-auth-scope.test.js`, `apps/web/test/trace-summary-contract.test.js`, `apps/web/test/ask-answering-metadata-contract.test.js`, and `apps/web/test/chat-page-helpers.test.js` now cover one more round of default-assistant drift and weak-answer/trace/citation explanation regressions
  - focused validation:
    - `pnpm --filter @rag-system/api test:fast:assistants`
    - `pnpm --filter @rag-system/api exec vitest run test/auth-provider-boundary.test.js test/retrieval-profiles-auth-scope.test.js`
    - `pnpm --filter @rag-system/web test:vitest:file -- test/i18n-copy.test.js test/chat-page-helpers.test.js test/workspace-selection.test.js`
    - `pnpm --filter @rag-system/web test:vitest:file -- test/trace-summary-contract.test.js test/ask-answering-metadata-contract.test.js test/chat-page-helpers.test.js`

- `chat readiness failed+ready handoff` removed one unnecessary block on the default upload-to-chat path
  - `apps/web/src/pages/chat/chat-page-helpers.ts` now treats the library as chat-ready when at least one document is already ready, even if other documents are still failed
  - this keeps users on the default ask path instead of forcing a detour whenever a non-critical failed item exists alongside usable documents
  - `apps/web/test/chat-page-helpers.test.js` now locks both branches: `failed+ready => ready` and `failed with zero ready => failed`
  - focused validation:
    - `pnpm --filter @rag-system/web typecheck`

- `default-path first-question citations/trace guard` tightened the first-question path and trace readability without changing the current stage judgment or roadmap scope
  - `apps/web/src/pages/chat/ChatPage.tsx` keeps first-question starter actions on the existing stream path so the first successful turn follows the same citations/trace inspection flow as normal chat turns
  - `apps/api/src/modules/traces/traces.service.ts` now normalizes inconsistent legacy `citationCountBeforeLimit` metadata so citation-count labels remain readable when `citationLimitHit=true`
  - `apps/api/test/traces.service.test.js` now locks this guard with an explicit legacy-inconsistency case
  - focused validation:
    - `pnpm test:api:file -- test/traces.service.test.js`
    - `git diff --check -- apps/web/src/pages/chat/ChatPage.tsx apps/api/src/modules/traces/traces.service.ts apps/api/test/traces.service.test.js docs/current-progress.md`

- `default assistant backfill/repair hardening` tightened the default-user bootstrap path without opening a new template or team wave
  - `apps/api/src/modules/auth/auth.service.ts` now treats the default assistant path as a repairable baseline: it still creates the primary knowledge base / retrieval profile / assistant when missing, and it now also repairs the existing assistant binding when the primary KB relationship or retrieval profile drifted out of sync
  - the OAuth bootstrap copy for default KB / assistant provisioning now uses product-facing default-assistant language instead of OAuth-specific placeholder text
  - `apps/api/test/auth-provider-boundary.test.js` now covers both first-time provisioning and the repair path for an already-provisioned but stale default assistant
  - focused validation:
    - `pnpm --filter @rag-system/api exec vitest run test/auth-provider-boundary.test.js`
    - `git diff --check -- apps/api/src/modules/auth/auth.service.ts apps/api/test/auth-provider-boundary.test.js docs/current-progress.md`

- `default assistant repair-state copy alignment` tightened the frontend empty-state wording around the same bootstrap contract
  - `apps/web/src/pages/assistant/AssistantPage.tsx` now treats the no-assistant branch as a temporary default-assistant repair/preparation state instead of telling the user to bind one manually
  - `apps/web/src/pages/chat/ChatPage.tsx` now shows the same repair-state wording and includes the current library name in the no-assistant state instead of falling back to a generic disabled-composer message
  - `apps/web/src/i18n/messages.en.ts` and `messages.zh.ts` now align the assistant/chat empty-state copy to the backend reality: the system is expected to provision or repair the default assistant automatically for the current primary library
  - focused validation:
    - `pnpm --filter @rag-system/web exec node --test test/i18n-copy.test.js`
    - `git diff --check -- apps/web/src/pages/assistant/AssistantPage.tsx apps/web/src/pages/chat/ChatPage.tsx apps/web/src/i18n/messages.en.ts apps/web/src/i18n/messages.zh.ts docs/current-progress.md`

- `default assistant binding visibility` added a small readout so the default path is easier to understand without reading IDs
  - `apps/web/src/pages/assistant/AssistantSettingsForm.tsx` now shows the current primary library name and an explicit default-assistant binding readout in the side status panel
  - `apps/web/src/pages/assistant/AssistantPage.tsx` passes the resolved primary knowledge base into the settings form instead of making users infer the binding indirectly
  - focused validation:
    - `pnpm --filter @rag-system/web exec node --test test/i18n-copy.test.js`
    - `git diff --check -- apps/web/src/pages/assistant/AssistantPage.tsx apps/web/src/pages/assistant/AssistantSettingsForm.tsx apps/web/src/i18n/messages.en.ts apps/web/src/i18n/messages.zh.ts docs/current-progress.md`

- `default path refresh fallback` added a small user-facing retry action without changing backend contracts
  - `apps/web/src/pages/assistant/AssistantPage.tsx` and `apps/web/src/pages/chat/ChatPage.tsx` now offer a refresh action when the default assistant is still being prepared, so users can explicitly re-fetch the current knowledge base / assistant / retrieval-profile path
  - `apps/web/src/i18n/messages.en.ts` and `messages.zh.ts` now include matching “refresh default path” labels for assistant/chat empty states
  - focused validation:
    - `pnpm --filter @rag-system/web exec node --test test/i18n-copy.test.js`
    - `pnpm --filter @rag-system/web typecheck`
    - `git diff --check -- apps/web/src/pages/assistant/AssistantPage.tsx apps/web/src/pages/chat/ChatPage.tsx apps/web/src/i18n/messages.en.ts apps/web/src/i18n/messages.zh.ts docs/current-progress.md`

- `default assistant identification tightening` made the current single-library path less ambiguous when multiple assistants point at the same library
  - `apps/web/src/features/api/workspace-selection.ts` now prefers the canonical `Default Assistant` for the active knowledge base before falling back to other same-library assistants
  - `apps/web/test/workspace-selection.test.js` now covers same-library duplicate-assistant cases so the current default-path selection rule stays explicit
  - focused validation:
    - `pnpm --filter @rag-system/web exec node --test test/workspace-selection.test.js`
    - `git diff --check -- apps/web/src/features/api/workspace-selection.ts apps/web/test/workspace-selection.test.js docs/current-progress.md`

- `default assistant priority alignment in api list reads` brought the same default-assistant rule into the backend read path
  - `apps/api/src/modules/assistants/assistants.service.ts` now reorders scoped assistant list results so the canonical `Default Assistant` stays ahead of other same-owner assistants
  - `apps/api/test/retrieval-profiles-auth-scope.test.js` now verifies the backend list path keeps the canonical default assistant first
  - focused validation:
    - `pnpm --filter @rag-system/api exec node --test test/retrieval-profiles-auth-scope.test.js`
    - `git diff --check -- apps/api/src/modules/assistants/assistants.service.ts apps/api/test/retrieval-profiles-auth-scope.test.js docs/current-progress.md`

- `knowledge-base next-step assistant wording alignment` removed the last manual-bind wording from the default path
  - `apps/web/src/pages/knowledge-base/knowledge-base-page-helpers.ts` now treats the no-assistant branch as a default-assistant preparation/repair step instead of asking users to bind an assistant manually
  - `apps/web/src/i18n/messages.en.ts` and `messages.zh.ts` now tell users to open answer settings so the default assistant can finish preparing or repairing before chat
  - `apps/web/test/knowledge-base-page-helpers.test.js` now locks that behavior into the focused helper contract
  - focused validation:
    - `pnpm --filter @rag-system/web exec node --test test/knowledge-base-page-helpers.test.js`
    - `pnpm --filter @rag-system/web exec node --test test/i18n-copy.test.js`
    - `git diff --check -- apps/web/src/pages/knowledge-base/knowledge-base-page-helpers.ts apps/web/src/i18n/messages.en.ts apps/web/src/i18n/messages.zh.ts apps/web/test/knowledge-base-page-helpers.test.js docs/current-progress.md`

- `knowledge-base default-path refresh fallback` extended the same retry affordance onto the workspace setup page
  - `apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx` now offers a `Refresh default path` action whenever the current next step is to finish preparing or repairing the default assistant
  - the refresh action invalidates the current `knowledge-bases`, `assistants`, and `retrieval-profiles` queries so users can retry the default path without leaving the page
  - `apps/web/src/i18n/messages.en.ts` and `messages.zh.ts` now include the matching workspace-setup action label
  - focused validation:
    - `pnpm --filter @rag-system/web typecheck`
    - `git diff --check -- apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx apps/web/src/i18n/messages.en.ts apps/web/src/i18n/messages.zh.ts docs/current-progress.md`

- `chat composer library shortcut` turned the existing library hint into a real path back to document upload
  - `apps/web/src/pages/chat/ChatPage.tsx` now links the composer-side library icon directly to `/documents` instead of rendering it as a disabled placeholder button
  - this keeps users on the default mainline when they realize they still need to add or update source material from inside chat
  - focused validation:
    - `pnpm --filter @rag-system/web typecheck`
    - `git diff --check -- apps/web/src/pages/chat/ChatPage.tsx docs/current-progress.md`

- `chat readiness gating` now blocks the empty-chat state behind actual library readiness instead of assuming chat is always ready once the page loads
  - `apps/web/src/pages/chat/chat-page-helpers.ts` now exposes a small readiness helper for `no active knowledge base / no documents / processing / failed / ready`
  - `apps/web/src/pages/chat/ChatPage.tsx` now reads the current library document summary and shows the matching state panel before falling through to the default-assistant or empty-conversation branches
  - this keeps first-use users on the upload / wait / fix path until the current library is actually ready for chat
  - focused validation:
    - `pnpm --filter @rag-system/web exec node --test test/chat-page-helpers.test.js`
    - `pnpm --filter @rag-system/web typecheck`
    - `git diff --check -- apps/web/src/pages/chat/chat-page-helpers.ts apps/web/src/pages/chat/ChatPage.tsx apps/web/test/chat-page-helpers.test.js docs/current-progress.md`

- `chat first-question prompts` now turn the remaining empty-chat states into clickable first-use actions
  - `apps/web/src/pages/chat/ChatPage.tsx` now shows starter question chips in both the `no active conversation` and `no messages` states, and clicking one sends the first question directly through the existing stream path
  - the `no active conversation` state also keeps a direct path back to `/documents` so users can still jump back to upload when needed
  - focused validation:
    - `pnpm --filter @rag-system/web typecheck`
    - `git diff --check -- apps/web/src/pages/chat/ChatPage.tsx docs/current-progress.md`

- `documents ready-state first-question hints` now make the upload-to-chat handoff more explicit
  - `apps/web/src/pages/documents/DocumentsPage.tsx` now shows starter-question badges inside the ready banner once the current library is fully ready for chat
  - this keeps the likely first prompts visible right where users finish uploading, before they jump into chat
  - focused validation:
    - `pnpm --filter @rag-system/web typecheck`
    - `git diff --check -- apps/web/src/pages/documents/DocumentsPage.tsx docs/current-progress.md`

- `starter-question helper alignment` now keeps the chat and documents entry hints on the same source of truth
  - `apps/web/src/pages/chat/chat-page-helpers.ts` now owns the shared starter-question list
  - `apps/web/src/pages/chat/ChatPage.tsx` and `apps/web/src/pages/documents/DocumentsPage.tsx` now both read their starter prompts from that helper instead of keeping separate inline arrays
  - `apps/web/test/chat-page-helpers.test.js` now covers both the Chinese and English starter-question sets
  - focused validation:
    - `pnpm --filter @rag-system/web exec node --test test/chat-page-helpers.test.js`
    - `pnpm --filter @rag-system/web typecheck`
    - `git diff --check -- apps/web/src/pages/chat/chat-page-helpers.ts apps/web/src/pages/chat/ChatPage.tsx apps/web/src/pages/documents/DocumentsPage.tsx apps/web/test/chat-page-helpers.test.js docs/current-progress.md`

- `state-aware starter-question variants` now keep the shared prompts aligned while still letting each page ask the more natural first question
  - `apps/web/src/pages/chat/chat-page-helpers.ts` now supports `chat` and `documents` starter-question variants on the same UTF-8-safe source of truth
  - `apps/web/src/pages/chat/ChatPage.tsx` continues to use the chat-oriented first question, while `apps/web/src/pages/documents/DocumentsPage.tsx` uses the upload/ready-state version that speaks about the current batch of library items
  - `apps/web/test/chat-page-helpers.test.js` now verifies both contexts explicitly
  - focused validation:
    - `pnpm --filter @rag-system/web exec node --test test/chat-page-helpers.test.js`
    - `pnpm --filter @rag-system/web typecheck`
    - `git diff --check -- apps/web/src/pages/chat/chat-page-helpers.ts apps/web/src/pages/chat/ChatPage.tsx apps/web/src/pages/documents/DocumentsPage.tsx apps/web/test/chat-page-helpers.test.js docs/current-progress.md`

- `frontend large-list containment pass` completed a bounded maintenance wave on the current web admin / workspace surfaces without opening a new frontend architecture track
  - `apps/api/src/modules/documents/documents.controller.ts` / `documents.service.ts` added paged document-list and document-summary endpoints, and `apps/web/src/pages/documents/DocumentsPage.tsx` now renders the library from `summary + paged list` instead of full-document fetches
  - `apps/web/src/pages/usage/UsagePage.tsx`, `apps/web/src/pages/workbench/WorkbenchPage.tsx`, and `apps/web/src/pages/assistant/AssistantPage.tsx` now consume document summary counts directly instead of pulling the full document array only to derive totals
  - `apps/api/src/modules/conversations/conversations.controller.ts` / `conversations.service.ts` added `GET /conversations/paged`, and `apps/web/src/pages/traces/TraceListPage.tsx` now uses server-backed conversation pagination instead of client-side `slice()` over the full history
  - `apps/web/src/pages/chat/ChatPage.tsx` and `apps/web/src/pages/chat/ChatWorkspacePanels.tsx` now bound conversation history with paged “load more” behavior, reducing both sidebar render cost and full-history fetch pressure on the main chat route
  - `apps/web/src/pages/reports/ReportResultsTable.tsx` now paginates large eval result sets locally, and `apps/web/src/pages/documents/DocumentDetailChunksPanel.tsx` now paginates chunk inspection while auto-jumping to the focused chunk page when entered from trace review
  - focused validation:
    - `pnpm --filter @rag-system/web typecheck`
    - `pnpm --filter @rag-system/web test:guard`
    - `pnpm test:api:file -- test/document-runs-summary.test.js`
    - `pnpm test:api:file -- test/conversations.service.test.js`
    - `git diff --check -- apps/api/src/modules/documents/documents.controller.ts apps/api/src/modules/documents/documents.service.ts apps/api/test/document-runs-summary.test.js apps/api/src/modules/conversations/conversations.controller.ts apps/api/src/modules/conversations/conversations.service.ts apps/api/test/conversations.service.test.js apps/web/src/features/api/hooks.ts apps/web/src/pages/documents/DocumentsPage.tsx apps/web/src/pages/usage/UsagePage.tsx apps/web/src/pages/workbench/WorkbenchPage.tsx apps/web/src/pages/assistant/AssistantPage.tsx apps/web/src/pages/traces/TraceListPage.tsx apps/web/src/pages/chat/ChatPage.tsx apps/web/src/pages/chat/ChatWorkspacePanels.tsx apps/web/src/pages/reports/ReportResultsTable.tsx apps/web/src/pages/documents/DocumentDetailChunksPanel.tsx docs/current-context.md docs/current-progress.md`

- `Supabase / Prisma 延迟排查复盘` 沉淀了这轮首字节优化的关键结论，供后续同类项目复用
  - 现象：应用侧 `ask_timing` 日志里 `retrievalMs`、`vectorSearchMs`、`vectorCandidateFetchMs` 很高，但数据库表规模很小，和直觉不符
  - 排查方法：
    - 先在应用侧补齐 `ask_timing`、`retrievalExecution`、`retrievalDiagnostics`，把首字节前链路拆到 retrieval 子阶段
    - 再用只读方式核对远端数据库的真实表规模、索引现状、`EXPLAIN ANALYZE` 执行时间
    - 最后把数据库内部执行时间和应用端 wall-time 对比，确认慢点到底在 SQL 本身还是在连接/网络往返
  - 关键发现：
    - 当时 `ChunkEmbedding` / `DocumentChunk` 只有约百级数据，数据库内部 SQL 执行只有毫秒级
    - 真实慢点不是 SQL 扫描，而是 API 到 Supabase 数据库之间的远程往返延迟
    - `6543` pooler 路径显著慢于 `5432` direct 路径；在当前数据规模下，缺少 `ivfflat/hnsw` 不是本轮主因
  - 误区记录：
    - 不能只看应用日志里的 `vectorSearchMs` 就直接判断是“向量检索算法慢”或“索引缺失”
    - 不能在没有对照 `EXPLAIN ANALYZE` 和真实 wall-time 前，就盲目继续做 retrieval 语义收缩
    - 对 Supabase 类项目，pooler 更适合连接数治理，不一定适合极度敏感的低延迟读路径
  - 落地改动：
    - `apps/api/src/infra/database/prisma.service.ts` 现在优先读取 `DIRECT_URL`
    - 本地/部署环境只要提供 `DIRECT_URL`，Prisma 就会走更低延迟的直连路径
    - 启动日志会明确打印当前是 `direct`、`pooler` 还是 `custom` datasource，便于排查是否真正切换成功
  - 实际结果：
    - 切到直连后，`conversationLoadMs`、`userMessagePersistMs`、`retrievalMs`、`firstTokenMs` 都明显下降
    - 一批真实问题样本里，`firstTokenMs` 已经从早期的 `4s-6s` 区间下降到约 `1.8s-2.9s`
    - 最佳样本已进入 `2s` 左右区间，说明这轮优化主收益来自数据库连接路径，而不是回答质量降级
  - 给后续 Supabase/Prisma 项目的借鉴：
    - 如果 trace 显示 retrieval 很慢，先确认“数据库内部执行慢”还是“连接往返慢”
    - 小表+慢查询 wall-time 的第一怀疑对象应该是连接路径、region、pooler，而不一定是 SQL 本身
    - 对低延迟读链路，优先预留 `DIRECT_URL`
    - 只有在数据量真正上来后，再把 `pgvector` ANN 索引（`ivfflat` / `hnsw`）作为主要优化目标
    - 回答质量敏感场景下，优先做连接/实现层优化，谨慎做 retrieval 语义收缩
  - 独立中文备忘录已整理到：
    - `docs/supabase-prisma-latency-playbook.md`

- `database latency diagnosis + direct-url preference` clarified the current TTFB ceiling and landed a bounded runtime fix
  - focused DB inspection showed current `ChunkEmbedding` / `DocumentChunk` SQL execution is only millisecond-level at the database, while end-to-end query wall time is dominated by remote connection / pooler latency
  - `apps/api/src/infra/database/prisma.service.ts` now prefers `DIRECT_URL` over `DATABASE_URL` when available, so the latency-sensitive API path can avoid the slower Supabase pooler route without changing retrieval semantics
  - local runtime config can now activate that lower-latency path simply by setting `DIRECT_URL`
  - focused validation:
    - `pnpm test:api:file -- test/prisma.service.test.js`

- `performance direction update` clarifies the next optimization target as request orchestration rather than answer-quality tuning
  - latest traces show the real cost is now dominated by the synchronous pre-generation chain, not model output quality
  - `llm first token` is already relatively low compared with the `first token pre-generation` slice, so the next ROI comes from shrinking the pre-LLM chain length
  - next safe optimization targets are conversation load slimming, user-message write decoupling, retrieval sub-stage timing, and tighter rerank gating for only genuinely complex questions

- `ask/retrieval hot-path trimming` continues to shave avoidable CPU work from the current RAG path without changing answer quality
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` no longer keeps the short-TTL retrieval cache that was only reducing repeated hot-query work
  - `apps/api/src/modules/retrieval/retrieval.service.ts` now uses cheaper set-based unique collection and avoids repeated lowercasing / join work inside candidate scoring
  - focused validation:
    - `pnpm --filter @rag-system/api typecheck`
    - `git diff --check -- apps/api/src/modules/assistants/ask-assistant.service.ts apps/api/src/modules/retrieval/retrieval.service.ts docs/current-progress.md`

- `quality/performance optimization phase 1` landed a bounded first implementation pass on the current ask pipeline without opening a new architecture wave
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now records richer retrieval/trace metadata, including prompt-context size, primary retrieval score stats, context-group average length, and explicit rewrite skip reasons
  - retrieval strategy parsing now supports `queryRewrite.mode` plus `queryRewrite.maxAddedLatencyMs`, and the ask path uses heuristic rewrite gating instead of treating rewrite as a simple global boolean
  - `apps/api/src/modules/retrieval/retrieval.service.ts` now preserves the existing hard failure contract for embedding/runtime compatibility errors instead of silently degrading into lexical fallback
  - `apps/api/src/modules/traces/traces.service.ts` and `packages/shared/src/trace-contracts.ts` now surface the new prompt/retrieval metrics through `traceSummary`, keeping the existing trace/readout path as the single observability surface
  - `apps/api/src/infra/llm/prompt-manager.service.ts` now uses tighter prompt packing for summary/list-style questions so those paths get more coverage with less prompt bloat
  - focused validation:
    - `pnpm test:api:file -- test/retrieval.test.js`
    - `pnpm test:api:file -- test/ask-success.test.js`
    - `pnpm test:api:file -- test/ask-failures.test.js`
    - `pnpm test:api:file -- test/ask-stream-service.test.js`
    - `pnpm test:api:file -- test/traces.service.test.js`
    - `pnpm test:api:file -- test/prompt-manager.test.js`
    - `pnpm test:api:fast:assistants`
    - `git diff --check -- apps/api/src/modules/assistants/ask-assistant.service.ts apps/api/src/modules/retrieval/retrieval.service.ts apps/api/src/modules/traces/traces.service.ts apps/api/src/modules/retrieval-profiles/retrieval-profile.schemas.ts apps/api/src/infra/llm/prompt-manager.service.ts packages/shared/src/trace-contracts.ts apps/api/test/retrieval.test.js apps/api/test/ask-success.test.js apps/api/test/ask-failures.test.js apps/api/test/traces.service.test.js`

- `test-system map cleanup` clarified the current repository test lanes without introducing a broad framework rewrite
  - root `package.json` now exposes explicit `test:web`, `test:web:guard`, `test:web:guard:legacy`, `test:web:legacy`, `test:web:smoke`, and `test:web:smoke:legacy` entrypoints
  - `apps/web/package.json` now splits frontend checks into `test:guard`, `test:guard:legacy`, `test:legacy`, and `test:smoke:legacy`, separating the stable guard gate from older local/source/UX verification that still needs re-baselining
  - `document-run-observability.test.js` has been promoted back into the stable default guard lane because it still matches the current helper contract
  - `document-run-contract.test.js`, `theme-preferences.test.js`, and `usage-page-helpers.test.js` have now also been rebaselined and promoted back into the stable default guard lane
  - the remaining legacy web guard backlog has now been trimmed again: obsolete source-shape tests (`assistant-strategy-source.test.js`, `chat-layout-source.test.js`, `ui-tailwind-migration.test.js`) were removed, and `i18n-copy.test.js` plus `ui-review-regressions.test.js` were rewritten to assert the current split-locale and scan-first workspace contracts instead of stale DOM/source snapshots
  - `auth-invite-login-smoke.test.js` has now been archived out of the active scripts, `test:legacy` no longer drags in browser smoke, and the only remaining smoke path is `pc-web-smoke.test.js` as a manual local seeded-account helper
  - `docs/current-dev-setup.md` now documents the current `api fast / api integration / api e2e / web guard / web smoke` map, the legacy local-web backlog split, recommended command selection, and the current CI gate boundary
  - `apps/web/AGENTS.md` now points frontend validation guidance at `test:guard`, `test:legacy`, and the current legacy local smoke lane
  - focused validation:
    - `pnpm --filter @rag-system/web test:guard`
    - `pnpm --filter @rag-system/web test:guard:legacy`
    - `pnpm --filter @rag-system/web exec node --test test/theme-preferences.test.js test/usage-page-helpers.test.js test/document-run-contract.test.js`
    - `git diff --check -- package.json apps/web/package.json apps/web/AGENTS.md docs/current-dev-setup.md docs/current-progress.md`

- `RAG retrieval/answering quality baseline refresh` 完成了一轮以稳定性为目标的收口，并形成了当前可复用基线
  - retrieval 默认配置已调整到更适合轻多跳和总结场景的组合：`topK` 提升、`chunkWindow=1`、`hybrid=ON`
  - `apps/api/src/modules/retrieval/retrieval.service.ts` 已补充 retrieval diversity 选择，减少 topK 被同一 section 的相似 chunk 占满
  - `apps/api/src/modules/answering/answering.service.ts` 已补充 `coverageSummary`，用于标记 summary/list 问题中“检到了但没写出来”的 coverage gap
  - `apps/api/src/infra/llm/prompt-manager.service.ts` 已强化 summary prompt，要求优先覆盖并列主项
  - `summaryMainItems` 两步实验已完成对照验证，但本轮明确不默认上线；实验开关保持关闭，避免把子项/示例误抬成主项
  - 本轮质量结论：
    - Fact：稳定可用
    - 2 步以内轻多跳：稳定可用
    - Summary / List：多数可用，但仍存在少量并列主项漏项 / 误归类边界
  - 后续维护约束：
    - 将当前 5 题及其同类题固定为回归评测集
    - 为 summary/list 场景单独跟踪“漏主项率”和“错误归类率”
  - focused validation:
    - `pnpm --filter @rag-system/api typecheck`
    - `pnpm --filter @rag-system/api build`
    - `pnpm --filter @rag-system/api test:file -- test/answering.test.js`

- `chat conversation UX` 又补了一轮很小的会话体验优化
  - `apps/web/src/pages/chat/ChatWorkspacePanels.tsx` 把会话重命名 / 删除收进了单个轻量菜单，减少了列表项里的视觉噪音
  - `apps/web/src/pages/chat/ChatPage.tsx` 在删除当前会话后会自动切到下一个可用会话，避免空白停留
  - focused validation:
    - `pnpm --filter @rag-system/api typecheck`
    - `pnpm --filter @rag-system/web typecheck`

- `chat conversation CRUD` 这次补齐了用户端会话管理的最小闭环
  - `apps/api/src/modules/conversations/conversations.controller.ts` 新增了 `PATCH /conversations/:id` 和 `DELETE /conversations/:id`
  - `apps/api/src/modules/conversations/conversations.service.ts` 现在支持会话重命名和归档式删除，并且会话列表只展示 `active` 会话
  - `apps/web/src/pages/chat/ChatWorkspacePanels.tsx` / `apps/web/src/pages/chat/ChatPage.tsx` 新增了会话重命名和删除入口
  - `apps/web/src/features/api/hooks.ts` 新增了会话更新和删除 mutation
  - `apps/web/src/i18n/messages.en.ts` / `apps/web/src/i18n/messages.zh.ts` 补了对应文案
  - focused validation:
    - `pnpm --filter @rag-system/api typecheck`
    - `pnpm --filter @rag-system/web typecheck`

- `api best-practices hardening wave` 已完成一轮窄范围后端维护收口
  - `apps/api/src/modules/assistants/assistants.controller.ts` 现在会在 `ask/stream` 首字节发出前保留正常 HTTP 失败语义；只有流真正开始后，才回落到 NDJSON `error` event 诊断，避免把 `404/5xx` 预流式失败吞成 `200`
  - `apps/api/src/common/http-exception.filter.ts` 提取了统一异常响应构建逻辑，streaming controller 可在 pre-stream 阶段复用现有错误 JSON 结构，而不是单独拼装返回体
  - `apps/api/src/modules/auth/auth.service.ts` 已把 OAuth 回调后的本地持久化阶段收敛到单个事务：身份链接、用户创建/复用、默认 workspace 初始化、session 创建同属一个写入边界
  - `apps/api/src/modules/auth/auth.controller.ts`、`auth.module.ts`、`auth-rate-limit.guard.ts` 为公开 auth 路由补了基于路由 metadata 的限流保护，当前覆盖 `login`、OAuth start、OAuth callback
  - `apps/api/src/modules/auth/auth-runtime-config.ts`、`apps/api/src/infra/env/api-runtime-config.ts` 与 `apps/api/src/infra/queue/queue-runtime-config.ts` 收敛了 auth / bootstrap / queue 的运行时配置读取，减少散落的 `process.env` 分支
  - 后续遗留项也已按 `Zod-first` 方向补齐一个窄范围增量：新增通用 `ZodValidationPipe`，并把多组 controller 的 `@Body()` / `@Query()` 手动 `schema.parse(...)` 提升到 Nest pipe 层；对当前仓库以 `cuid` 为主的 `id` 路由参数补的是 `trim + non-empty string` 参数 pipe，而不是误用 `ParseUUIDPipe`
  - 当前约束同步收敛为：继续保留 `Zod` 作为单一 schema/type source，通过 `ZodValidationPipe` 承接 `@Body()` / `@Query()` 校验，并按仓库实际主键形态为路由参数补合适的参数 pipe；不为了类型安全切回 `class-validator` / `class-transformer` DTO 栈
  - focused validation:
    - `pnpm --filter @rag-system/api typecheck`
    - `pnpm --filter @rag-system/api test:file -- test/auth-provider-boundary.test.js test/ask-stream-controller.test.js test/http-exception-filter.test.js`
    - `pnpm --filter @rag-system/api test:file -- test/zod-validation-pipe.test.js test/auth-provider-boundary.test.js test/ask-stream-controller.test.js test/http-exception-filter.test.js test/kb-document-access.test.js test/knowledge-bases-auth-write-path.test.js test/retrieval-profiles-auth-scope.test.js test/eval-question-sets.service.test.js`

- `web local bootstrap performance guardrail` narrowed two first-load regressions in the current maintenance wave
  - `apps/web/src/lib/api.ts` now prefers the existing Vite `/api` same-origin proxy during local dev unless `VITE_API_BASE_URL` is explicitly set, removing avoidable browser CORS preflight overhead from the normal `5173 -> 3000` path
  - `apps/web/src/app/AuthenticatedAppShell.tsx` no longer returns a blank screen while `GET /auth/me` is pending; the app now renders a lightweight loading shell immediately so first paint is not blocked on auth bootstrap visibility
  - `apps/web/src/app/AppShell.tsx` now defers non-critical sidebar metrics (`documents` / `conversations` badges) until browser idle time instead of requesting them during the first shell bootstrap on every route
  - `apps/web/src/i18n/messages.ts` is now split into `messages.en.ts` and `messages.zh.ts`, `apps/web/src/main.tsx` boots with only the active locale catalog, and `apps/web/src/i18n/I18nProvider.tsx` lazy-loads the other locale on demand; the production build now emits separate locale chunks and reduces the main `index` bundle from the earlier ~`462 KB` snapshot to ~`408 KB`
  - `apps/web/src/app/router.tsx` now lazy-loads the authenticated root route too, so `AuthenticatedAppShell` / `AppShell` no longer ride inside the entry bundle; the production build now emits a dedicated `AuthenticatedAppShell-*` chunk and further reduces the main `index` bundle from ~`408 KB` to ~`350 KB`
  - `apps/web/src/app/App.tsx` now lazy-loads `AppRouter`, moving `RouterProvider` and the router definition out of the entry bundle; the production build now emits a dedicated `AppRouter-*` chunk and further reduces the main `index` bundle from ~`350 KB` to ~`255 KB`
  - `apps/web/src/pages/reports/ReportCenterPage.tsx` now lazy-loads a dedicated `ReportCharts` submodule, so `recharts` is no longer bundled into the main report page chunk; the production build now reduces `ReportCenterPage-*` from ~`439 KB` to ~`71 KB` and emits a separate `ReportCharts-*` chunk for chart-heavy diagnostics
  - `apps/web/src/pages/assistant/AssistantPage.tsx` now lazy-loads `AssistantSettingsForm`, moving `@mantine/form` and the full answer-settings form body out of the page shell; the production build now reduces `AssistantPage-*` from ~`69 KB` to ~`12 KB` and emits a separate `AssistantSettingsForm-*` chunk for the heavy settings UI
  - `apps/web/src/pages/usage/UsagePage.tsx` now lazy-loads `UsageHealthBoard`, moving the large operations-health JSX block out of the page shell; the production build now reduces `UsagePage-*` from ~`41 KB` to ~`24 KB` and emits a separate `UsageHealthBoard-*` chunk for the deeper operational panels
  - `apps/web/src/pages/chat/ChatPage.tsx` now lazy-loads `ChatWorkspacePanels`, moving the secondary history / citations workspace out of the primary chat page shell; the production build now reduces `ChatPage-*` from ~`36.6 KB` to ~`32.6 KB` and emits a separate `ChatWorkspacePanels-*` chunk for the sidebar workflow
  - `apps/web/src/pages/traces/TraceDetailPage.tsx` now lazy-loads `TraceDetailSupportPanels`, moving metadata / quick jumps / query comparison plus citations / raw payload out of the primary trace review path; the production build now reduces `TraceDetailPage-*` from ~`34.7 KB` to ~`30.6 KB` and emits a separate `TraceDetailSupportPanels-*` chunk for the auxiliary diagnostics workflow
  - `apps/web/src/pages/knowledge-base/KnowledgeBasePage.tsx` now lazy-loads `KnowledgeBaseActivityPanel`, moving the recent activity summary, expandable run filters, and run list workflow out of the primary workspace snapshot shell; the production build now reduces `KnowledgeBasePage-*` from ~`25.4 KB` to ~`16.0 KB` and emits separate `KnowledgeBaseActivityPanel-*` and slimmed `DocumentRunList-*` chunks for the deeper maintenance workflow
  - `apps/web/src/pages/documents/DocumentsSourceEntryPanel.tsx` still exists as a separate source-entry panel for `web/feed/sitemap` ingestion flows, but the current `DocumentsPage` runtime path is centered on file upload plus document-status review rather than rendering that panel inline
  - `apps/web/src/pages/documents/DocumentDetailPage.tsx` now lazy-loads `DocumentDetailChunksPanel`, moving the chunk query, trace-focused chunk review flow, and metadata payload rendering out of the primary document status shell; the production build now reduces `DocumentDetailPage-*` from ~`15.4 KB` to ~`10.8 KB` and emits a separate `DocumentDetailChunksPanel-*` chunk for the deeper chunk-inspection workflow
  - `apps/web/src/pages/reports/ReportCenterPage.tsx` now lazy-loads `ReportResultsTable`, moving the large sortable/filterable run-item table and its review controls out of the primary report summary shell; the production build now reduces `ReportCenterPage-*` from ~`71.0 KB` to ~`64.9 KB` and emits a separate `ReportResultsTable-*` chunk for the detailed item-review workflow
  - `apps/web/src/pages/reports/ReportCenterPage.tsx` now also lazy-loads `ReportAnalysisPanels`, moving the quality-distribution, gate, diff, regression-weakest-items, run-context, and export panels out of the primary report shell; the production build now further reduces `ReportCenterPage-*` from ~`64.9 KB` to ~`53.9 KB` and emits a separate `ReportAnalysisPanels-*` chunk for the deeper analysis workflow
  - focused validation:
    - `pnpm --filter @rag-system/web build`

- `opencode loop sequential executor` now consumes the active materialized queue in order
  - root `pnpm loop:start|stop|status` now uses the repo-local Node harness under `.opencode/loop/harness/`
  - the runner selects the next runnable pending queue item, reuses the same OpenCode session across a compact wave when possible, runs queue items through the repo `build` command, and stops on failure / replan so the queue does not drift ahead of the checkout
  - this is harness/workflow plumbing only; it does not expand product scope or queue planning scope

- `docs / stage alignment refresh` 已完成当前阶段文档同步
  - `current-context`、`next_steps_rag_project_plan`、`project-status-overview` 现已统一采用同一阶段判断：
    - `P0/P1/P2` 已完成
    - `P3/P5/P6` 已完成主开发并进入维护/治理边界
    - `P4` 是当前最合理的下一条产品收口主线
  - 文档现已补充明确执行顺序：先做 docs 对齐，再做 `P4 Documents / Knowledge Base` 收口，然后是 `Document Detail / Usage / Trace`、`Report center / eval` 和 focused regression
  - 这轮同步只做阶段口径、优先级和执行顺序收正，不引入新的 backend roadmap

- `api build/start cross-environment hardening` 完成了 Windows / WSL 切换下的 narrow backend startup closeout
  - 根因是 API 旧构建产物和增量状态残留会造成 `apps/api/dist` 混合布局，进一步导致运行时模块缺失和 `/auth/*` 路由未注册
  - `apps/api/package.json` 现在在 `build` 前稳定清理构建产物，`start:prod` 继续使用 clean-build runtime boot path
  - `apps/api/scripts/start-dev.mjs` 已重新收回真正的 watch/dev 语义：启动前清理旧构建产物并执行 `prisma generate`，然后进入 `tsx watch src/main.ts`
  - 同区域 warning cleanup 已完成：
    - Prisma seed 配置从废弃的 `package.json#prisma` 迁到 `apps/api/prisma.config.ts`
    - build finalize 会给 `apps/api/dist/packages/shared/package.json` 写入 `"type": "module"`，去掉 Node runtime reparsing warning
  - focused validation：
    - `node --test apps/api/test/resolve-built-api-entry.test.js`
    - `pnpm --filter @rag-system/api build`
    - `pnpm --filter @rag-system/api start:prod`
    - `pnpm --filter @rag-system/api start:dev`
    - `GET /health` + `GET /auth/providers` + `GET /auth/me`

- `fix-typescript-errors-and-warnings` 完成了 TypeScript error/warning cleanup 并已 merge 为 PR #11
  - 修复了 `sitemap-source.service.ts` 和 `document-ingestion.processor.ts` 的类型问题
  - 修复了 `ask-success.test.js` 的接口期望同步
  - 移除了 `ReportCenterPage.tsx` 的未使用导入
  - 添加了 `ErrorCode.INGESTION_STATE_WRITE_FAILED`
  - focused validation：
    - `pnpm typecheck`
    - `pnpm test:api:file -- test/ask-success.test.js`
    - `pnpm test:api:file -- test/fetch-with-retry.test.js`
    - `pnpm test:api:file -- test/external-source-sync.test.js`

- `P3 external-source guardrails` 已完成主开发闭环
  - 现有 source family 维持为 `web page` / `feed` / `sitemap` / `sitemap index`
  - legality / courtesy / retry / timeout / incremental resync / one-level sitemap index 边界都已落地到代码和 focused tests
  - 当前只保留同一家族内的小型维护位，不再把 `P3` 当成主开发主线

- `P4 DocumentsPage source-entry carry-through` 相关代码已落地，但当前文档口径已按运行时行为收正
  - `DocumentsPage` 当前主路径是文件上传、文档列表和状态阅读，不再把 `web page` / `feed` / `sitemap` 三类 URL 入口写成当前默认可见页面能力
  - `DocumentsSourceEntryPanel` 与对应 `web page` / `feed` / `sitemap` 创建逻辑仍保留在代码库中，但当前未接入 `DocumentsPage` 的主界面路径
  - 因此，后续如果恢复或重新开放这组三类 URL 入口，应视为新的明确前端增量或一次 bounded follow-up，而不是继续把它描述为已经完成并对用户开放的当前页面行为
  - 当前仍然成立的小范围收口是：`DocumentsPage` 在无 active knowledge base 时不再对文档列表走隐式 `default-kb` 兜底，而是切到显式空态与引导动作

- `P5 approved baseline closeout` 已完成主开发闭环
  - fixed-question eval runner、baseline snapshot / compare、quality gate、report export、approved baseline manifest、demo replay pin 都已落地
  - 当前剩余事项更偏向基线治理和使用，而不是继续补工程能力

- `P5 quality governance usage loop` 已完成一轮前端使用态收口
  - `ReportCenterPage` 已从只读结果页推进到可操作的质量治理工作台：
    - 优先复盘题目 / Top 3 issues
    - review progress、本地 reviewed / pending 状态
    - 本地结论分类（检索 / 引用 / 回答 / 暂不处理）
    - 结论分布驱动的 current improvement focus
    - focus-specific troubleshooting path、第一条相关 diagnostics 跳转
    - quality gate 的 pass / warn / fail 治理提示
    - report-to-trace carry-through context
    - 本地复盘记录、改后复查建议、复制/导出本地复盘摘要
  - `TraceDetailPage` 已补 report-driven 首屏复盘顺序和来自质量报告的上下文提示，减少从报告进入后的重新定向成本
  - `DocumentDetailPage` 已补 focused chunk 的首屏检查顺序，明确先看 chunk 内容、再看命中依据、最后回诊断判断问题归因
  - `AssistantPage` 已补稳定锚点与来自质量报告的回流提示，使 `质量报告 -> 回答设置 -> 回质量报告` 成为明确路径
  - 边界保持不变：以上全部为前端本地治理层，不新增 backend review/persistence contract

- `normal-user readiness loop` 已完成一轮前端收口
  - `Library / Workspace settings / Chat` 现已统一为同一套 readiness 判断和下一步动作模型
  - `Chat` 首屏 onboarding 明确收敛到三步：添加资料 -> 确认回答设置 -> 开始聊天
  - `资料库 -> 回答设置 -> 对话` 的完成路径已补齐，ready 态不再误导到 diagnostics 或回设置页

- `P6 observability readability pass` 已完成 bounded closeout
  - Usage / Report center / Trace Detail 已完成 scan-first readability + docs sync
  - 保持边界不变：不扩成 observability platform

## Runtime Validation Addendum

- `P4 regression hardening wave` 已完成 web 页面逻辑提取和测试准备
  - `DocumentsPage` 相关的 source-entry URL 校验逻辑提取到 `documents-page-helpers.ts`，供独立 source-entry 组件复用
  - `ReportCenterPage` 的 eval URL 参数归一区、字段标签、回归原因标签提取到 `report-center-page-helpers.ts`
  - `TraceDetailPage` 的失败分类、标签、颜色、链接构建提取到 `trace-detail-page-helpers.ts`
  - `UsagePage` 的健康信号、告警项、跳转目标提取到 `usage-page-helpers.ts`
  - 所有提取保持现有 UI 行为，启用 focused regression testing，构建验证通过

## Active Boundaries

- `P3` 仍允许在现有 source family 内做小型回归修补，但不再重开新的 source expansion wave。
- `P5` 仍允许在现有 eval / replay / report / quality gate 契约内做维护，但不再把它描述成当前主开发方向。
- `P6` 仍保持 scan-first readability 和 docs sync 边界，不扩成平台化重写。
- 当前这轮 `P4` 只保留已完成页面收口范围内的小型 follow-up，不再把它写回默认主线。
- 当前真正需要推进的新增量，更适合落在：
  - 新的明确产品波次
  - 或已完成区域内的 bounded maintenance

## Next Execution Order

1. bounded maintenance in completed areas
2. keep docs and stage judgment fresh
3. choose the next single product increment before opening a new wave

## Focused Validation Baseline

- API focused test：`pnpm test:api:file -- test/<file>.test.js`
- web focused test：`pnpm --filter @rag-system/web exec vitest run test/<file>.test.js`
- docs / queue sync：`git diff --check -- <files...>`
- current source-family maintenance baseline：
  - `pnpm test:api:file -- test/external-source-sync.test.js`
  - `pnpm test:api:file -- test/fetch-with-retry.test.js`
  - `pnpm test:api:file -- test/parsing.test.js`
- current observability baseline：
  - `pnpm test:api:file -- test/traces.service.test.js`
  - `pnpm test:api:file -- test/ask-success.test.js`
  - `pnpm --filter @rag-system/web exec vitest run test/trace-summary-contract.test.js`
  - `pnpm --filter @rag-system/web exec vitest run test/document-run-observability.test.js`

## Notes

- 本文件已从 append-only 长日志收瘦为当前摘要；更早的详细完成记录请按需从 git history 回看。
- 当前阶段判断已经按代码现实收正：`P3` / 当前这轮 `P4` / `P5` 是已完成主开发或收口的阶段，不再默认作为下一步主线。
- 具体下一步方向以 [docs/next_steps_rag_project_plan.md](D:\FeProjects\rag-system\docs\next_steps_rag_project_plan.md) 的更新版口径为主。
- API review 的输入校验 follow-up 已继续推进一小步：当前 controller 侧 `@Body()` / `@Query()` 已开始迁移到 `ZodValidationPipe`，路由参数按仓库主键实际形态补的是非空字符串参数 pipe；仍不为了“全局验证”或类型安全把现有校验体系整体切到 `class-validator` / `class-transformer` DTO 栈。

## Recent React 19 UX Pass

- `apps/web` completed a small React 19 user-experience pass focused on the highest-traffic flows, without changing backend contracts.
  - `ChatPage` conversation rename/delete now uses optimistic UI updates.
  - `UsagePage`, `ReportCenterPage`, and `TraceListPage` now defer heavy list recomputation and transitions so selection changes feel more responsive.
  - `LoginPage`, `InviteGatePage`, and `AssistantSettingsForm` now use more consistent pending feedback and input blocking during submission / save.
  - focused validation:
    - `pnpm --filter @rag-system/web typecheck`
    - `git diff --check -- apps/web/src/pages/chat/ChatPage.tsx apps/web/src/pages/usage/UsagePage.tsx apps/web/src/pages/reports/ReportCenterPage.tsx apps/web/src/pages/traces/TraceListPage.tsx apps/web/src/pages/auth/LoginPage.tsx apps/web/src/pages/auth/InviteGatePage.tsx apps/web/src/pages/assistant/AssistantSettingsForm.tsx`

## Recent API Quality / Performance Follow-up

- Continued the `quality-performance-optimization-plan` implementation beyond phase 1 with bounded retrieval / answering / ingestion hardening instead of opening a new architecture wave.
  - `chunking.service.ts` now emits lightweight structural metadata (`headingPath`, `blockType`, `listOrdinal`, `isTableLike`) for list / table / FAQ-aware chunks.
  - `document-ingestion.processor.ts` now persists chunk structure hints into `DocumentChunk.metadataJson`, so retrieval and future diagnostics can reuse them.
  - `retrieval.service.ts` now reads chunk metadata, adds structure-aware lexical scoring, surfaces `matchSource`, and formalizes `rerank.mode` (`off | local_heuristic | llm_judge`) while keeping the current implementation lightweight.
  - `rerank.mode = llm_judge` now uses a bounded LLM judge prompt for the top candidate slice and falls back to the local heuristic when the judge call fails or returns unusable output.
  - `answering.service.ts` now adds `citationReliability`, enables heuristic summary-main-item extraction for summary/list questions, and applies tighter summary-oriented context packing without adding a second LLM call.
- `retrieval-profile.schemas.ts` and `ask-assistant.service.ts` now default enabled rewrite to `heuristic_only` and skip it when the estimated added latency exceeds the profile budget.
- The streaming ask path now starts trace creation in parallel with answer generation so trace persistence no longer blocks the first streamed token.
- Focused validation completed:
  - `pnpm test:api:file -- test/chunking.test.js`
  - `pnpm test:api:file -- test/retrieval.test.js`
  - `pnpm test:api:file -- test/answering.test.js`
  - `pnpm test:api:fast:assistants`
- The web trace detail page now surfaces the newest high-signal diagnostics directly in the UI, including prompt size, rewrite skip reason, primary score, and context-group sizing.
- The trace list page now previews latency and rewrite state on each conversation card so the diagnostics surface is visible before opening a detail view.
- The trace detail sidebar now highlights the slowest timing stage so the main bottleneck is visible at a glance without manual inspection.
- The trace list page now shows a compact slowest-stage preview on each conversation card so slow runs can be spotted without opening the detail page.
- Summary/list answer prompts now use a tighter compact context mode once the retrieved chunk set gets larger, trimming prompt size to reduce first-token latency.

## Recent Default KB Selection Hardening

- Fixed a main-path regression where duplicate owner-scoped default knowledge bases could cause the newest empty default KB to win primary selection.
  - `apps/api` knowledge-base listing now prioritizes the canonical active `Default Knowledge Base` ahead of newer non-canonical or inactive duplicates.
  - `apps/web` workspace selection now applies the same canonical primary-KB priority instead of blindly using the first returned knowledge base.
- Focused validation:
  - `pnpm test:api:file -- test/knowledge-bases-auth-write-path.test.js`
  - `pnpm --filter @rag-system/web exec vitest run test/workspace-selection.test.js`
  - `pnpm --filter @rag-system/web typecheck`

## Recent Retrieval / Answering Alignment

- The current default local retrieval profile is intentionally conservative and should be treated as the repository-aligned baseline:
  - `topK = 3`
  - `chunkWindow = 0`
  - `hybrid = OFF`
  - `rerank = OFF`
- The local seeded assistant currently runs on that profile via `default-retrieval-profile` in `apps/api/prisma/seed.js`; older notes that describe the default shipped path as `chunkWindow = 1` or always-on hybrid are no longer current.
- `apps/api/src/modules/retrieval/retrieval.service.ts` now applies a bounded structural fix for heading-like Markdown chunks:
  - when `chunkWindow = 0`, heading-like primary hits can still pull in the trailing body chunk
  - this improves structured document question answering without globally widening retrieval breadth
- The same retrieval pass also fixed the settled-task type mismatch in vector retrieval, so hard vector compatibility errors keep their explicit failure contract instead of being misread as lexical fallback cases.
- `apps/api/src/infra/llm/prompt-manager.service.ts` and `apps/api/src/modules/answering/answering.service.ts` now use a less over-conservative answer threshold, reducing the chance that citation-backed partial answers collapse into unnecessary `insufficient_context`.
- Current local smoke result against `D:\\FeProjects\\rag-test\\question.md`:
  - `37/40` grounded
  - `3/40` insufficient-context
  - the remaining three refusals currently look more like source-coverage limits than main-path retrieval regressions
- Follow-up posture remains bounded:
  - answer quality is now good enough to leave main-wave status and move into maintenance
  - the next best retrieval investments are replayable smoke checks and light adaptive retrieval, not globally larger defaults or broad chunking rewrites

## Route View Helper Extraction

- `route view shortcut helper extraction` now centralizes the shared route labels and trace-list links for the report and trace surfaces
  - `apps/web/src/pages/reports/route-view-helpers.ts` now owns the shared route target type, button labels, and `/traces?routeType=...` link builder
  - `apps/web/src/pages/reports/ReportRouteViewShortcuts.tsx` now consumes the shared helper instead of re-declaring its own route mapping
  - `apps/web/src/pages/traces/TraceRouteFilterPanel.tsx` now reuses the same shared labels for the active route badges, so the trace filter panel and report shortcuts stay coupled to one small navigation contract
  - focused validation:
    - `pnpm --filter @rag-system/web typecheck`
    - `pnpm check:encoding`
    - `git diff --check`

- `trace route filter helper extraction` now centralizes the trace-list route matching and active-filter summary
  - `apps/web/src/pages/traces/trace-route-helpers.ts` now owns the route-matching predicate plus the active-filter summary formatter
  - `apps/web/src/pages/traces/TraceListPage.tsx` now delegates its route filtering to the shared helper instead of re-declaring the same predicate inline
  - `apps/web/src/pages/traces/TraceRouteFilterPanel.tsx` now uses the same helper for the current filter summary, keeping the trace route UI coherent around one small contract
  - focused validation:
    - `pnpm --filter @rag-system/web typecheck`
    - `pnpm check:encoding`
    - `git diff --check`

- `external-source readable label fallback` now gives bare URLs a stable display title inside the external-source route
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now derives a readable fallback label from the URL host/path when the source has no explicit title
  - external-source combined content, diagnostics, and per-source chunks now carry that readable label instead of only raw URLs
  - `apps/api/test/ask-success.test.js` now covers the bare-URL path so a source without a fetched title still gets a deterministic document title in the route flow
  - focused validation:
    - `pnpm test:api:file -- test/ask-success.test.js`
    - `pnpm check:encoding`
    - `git diff --check`

- `report route navigation improvement` now adds a direct return path from the shared route shortcuts back to the full trace list
  - `apps/web/src/pages/reports/route-view-helpers.ts` now includes `buildAllTracesLink()` alongside the route-specific helpers
  - `apps/web/src/pages/reports/ReportRouteViewShortcuts.tsx` now shows an explicit `All traces` / `全部 trace` button before the three route-specific shortcuts, so report users can jump back to the unfiltered trace list without leaving the shared navigation block
  - focused validation:
    - `pnpm --filter @rag-system/web typecheck`
    - `pnpm check:encoding`
    - `git diff --check`

- `trace detail route decision readability` now shows the route decision as a visible badge plus reason in the diagnostic sidebar
  - `apps/web/src/pages/traces/TraceDetailSupportPanels.tsx` now renders route type as a badge and route reason as a separate explanation block inside the diagnostic metadata card
  - this makes the agent-like decision path easier to scan at a glance without opening the raw payload

- `trace list route decision readability` now mirrors the same readable route labels on the conversation cards
  - `apps/web/src/pages/traces/TraceListPage.tsx` now renders the route type as a shared label badge and keeps the route reason visible beside it
  - the list view and the detail view now agree on the same route label contract, which reduces scan-time mismatch between summary and detail

- `trace detail route label reuse` now consumes the shared route label map instead of keeping a separate route-name helper
  - `apps/web/src/pages/traces/TraceDetailSupportPanels.tsx` now uses the same shared route label contract as the list and report surfaces
  - the route label contract is now a single small UI mapping, which makes future platform handoff easier because the visible route names stay centralized

- `trace list execution mode visibility` now makes the step contract easier to read at a glance
  - `apps/web/src/pages/traces/TraceListPage.tsx` now shows `manual / workflow` beside the execution step count when a trace carries an execution plan
  - this keeps the list view aligned with the new contract without changing the backend shape or the existing route summary wording

- `trace execution plan contract` now exposes a small execution-plan shape that can carry future multi-step agent flows without changing current behavior
  - `packages/shared/src/trace-contracts.ts` now keeps `TraceExecutionPlan` as the shared contract for future step-by-step summaries
  - `apps/web/src/pages/traces/TraceDetailSupportPanels.tsx` and `apps/web/src/pages/traces/TraceListPage.tsx` now render the plan only when it is present, so current traces stay unchanged
  - `apps/api/src/modules/traces/traces.service.ts` now keeps the summary contract aligned by explicitly carrying `executionPlan` in the returned `TraceSummary`

- `step contract abstraction` now records a small execution plan alongside the existing route decision metadata
  - `packages/shared/src/trace-contracts.ts` now exports `TraceExecutionPlan` and `TraceExecutionStep` plus a tiny `buildTraceExecutionPlan(...)` helper
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now writes the execution plan into retrieval metadata for knowledge-base, policy, and external-source paths
  - `apps/api/src/modules/traces/traces.service.ts` now reads the execution plan back into `TraceSummary`, so the trace contract has a stable place for future multi-step / workflow handoff
  - focused validation:
    - `pnpm --filter @rag-system/api typecheck`
    - `pnpm check:encoding`
    - `git diff --check`

- `trace step plan preview` now shows the execution plan in the trace list and detail surfaces
  - `apps/web/src/pages/traces/TraceListPage.tsx` now shows the number of execution steps on each conversation card
  - `apps/web/src/pages/traces/TraceDetailSupportPanels.tsx` now renders the execution steps with status badges and labels
  - the route/step contract now stays visible from summary to detail, which makes the current manual flow easier to compare with a future workflow engine
  - focused validation:
    - `pnpm --filter @rag-system/api typecheck`
    - `pnpm --filter @rag-system/web typecheck`
    - `pnpm check:encoding`
    - `git diff --check`

- `conversation answer reuse` now short-circuits exact same-question repeats inside the same conversation
  - `apps/api/src/modules/assistants/ask-assistant.service.ts` now checks the current conversation history before creating new messages, and reuses the latest assistant response when the same question already has a completed answer
  - this keeps the chat path from writing duplicate messages / traces for the same turn and makes repeated submits behave like cache hits instead of reruns
  - focused validation:
    - `pnpm --filter @rag-system/api exec vitest run test/ask-reuse.test.js --config vitest.config.mjs`
    - `pnpm --filter @rag-system/api test:file -- test/ask-stream-service.test.js`
    - `pnpm --filter @rag-system/api typecheck`
