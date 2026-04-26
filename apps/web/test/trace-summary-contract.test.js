import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

test('web trace summary type guards current backend summary field set', async () => {
  const source = await readFile(
    resolve(__dirname, '../src/types/api.ts'),
    'utf8'
  );
  const sharedSource = await readFile(
    resolve(__dirname, '../../../packages/shared/src/trace-contracts.ts'),
    'utf8'
  );
  const tracesServiceSource = await readFile(
    resolve(__dirname, '../../api/src/modules/traces/traces.service.ts'),
    'utf8'
  );
  const routeViewHelpersSource = await readFile(
    resolve(__dirname, '../src/pages/reports/route-view-helpers.ts'),
    'utf8'
  );
  const agentSurfaceEntrySource = await readFile(
    resolve(__dirname, '../src/pages/reports/AgentSurfaceEntry.tsx'),
    'utf8'
  );
  const chatPageHelpersSource = await readFile(
    resolve(__dirname, '../src/pages/chat/chat-page-helpers.ts'),
    'utf8'
  );
  const traceSummaryMatch = sharedSource.match(
    /export type TraceSummary = \{([\s\S]*?)\n\};/
  );

  assert.ok(
    traceSummaryMatch,
    'TraceSummary type block should exist in shared contracts'
  );

  const traceSummaryBody = traceSummaryMatch[1];

  assert.match(traceSummaryBody, /primaryIssue:\s*TracePrimaryIssue \| null;/);
  assert.match(traceSummaryBody, /retrievalModeProvenanceSentence:\s*string;/);
  assert.match(traceSummaryBody, /failureReadabilitySentence:\s*string;/);
  assert.match(
    traceSummaryBody,
    /answerStatusSourceReadabilitySentence:\s*string;/
  );
  assert.match(
    traceSummaryBody,
    /executionMode:\s*TraceExecutionMode \| null;/
  );
  assert.match(traceSummaryBody, /routeTypeReadabilityLabel:\s*string;/);
  assert.match(traceSummaryBody, /routeReasonReadabilityLabel:\s*string;/);
  assert.match(traceSummaryBody, /routeDecisionReadabilityLabel:\s*string;/);
  assert.match(traceSummaryBody, /routeDecisionReadabilitySentence:\s*string;/);
  assert.match(traceSummaryBody, /executionModeReadabilityLabel:\s*string;/);
  assert.match(traceSummaryBody, /executionModeReadabilitySentence:\s*string;/);
  assert.match(
    traceSummaryBody,
    /executionToolNames:\s*TraceExecutionToolName\[\];/
  );
  assert.match(
    traceSummaryBody,
    /executionToolNamesReadabilityLabel:\s*string;/
  );
  assert.match(
    traceSummaryBody,
    /executionToolNamesReadabilitySentence:\s*string;/
  );
  assert.match(
    traceSummaryBody,
    /missingInformationProvenanceSentence:\s*string;/
  );

  assert.match(source, /from\s+['"]@rag-system\/shared['"]/);
  assert.match(source, /traceSummary:\s*TraceSummary;/);
  assert.match(
    sharedSource,
    /export type TraceRetrievalQuerySource =[\s\S]*?original_unchanged';/
  );
  assert.match(
    sharedSource,
    /export type TraceFailedStage =[\s\S]*?answering';/
  );
  assert.match(sharedSource, /export type RetrievalStrategySummary = \{/);
  assert.match(sharedSource, /rewriteEnabled:\s*boolean;/);
  assert.match(sharedSource, /rewriteApplied:\s*boolean;/);
  assert.match(sharedSource, /usedFallback:\s*boolean \| null;/);
  assert.match(sharedSource, /rewriteUsedFallback:\s*boolean \| null;/);
  assert.match(sharedSource, /rewritePromptId:\s*string \| null;/);
  assert.match(sharedSource, /rewriteModelName:\s*string \| null;/);
  assert.match(sharedSource, /strategyMode:\s*TraceRetrievalMode \| null;/);
  assert.match(sharedSource, /strategySummary:\s*RetrievalStrategySummary;/);
  assert.match(sharedSource, /export type TraceTimingSummary = \{/);
  assert.match(
    sharedSource,
    /export type TraceExecutionMode = 'manual' \| 'workflow';/
  );
  assert.match(sharedSource, /export type TraceMetadataCanonicalSurface = \{/);
  assert.match(sharedSource, /routeType:\s*TraceRouteType;/);
  assert.match(sharedSource, /routeReason:\s*TraceRouteReason;/);
  assert.match(sharedSource, /export const TRACE_ROUTE_TYPE_LABELS = \{/);
  assert.match(sharedSource, /export const TRACE_ROUTE_REASON_LABELS = \{/);
  assert.match(
    sharedSource,
    /export function buildTraceRouteTypeReadabilityLabel\([\s\S]*?\) \{/
  );
  assert.match(
    sharedSource,
    /export function buildTraceRouteReasonReadabilityLabel\([\s\S]*?\) \{/
  );
  assert.match(
    sharedSource,
    /export function buildTraceRouteDecisionReadabilityLabel\([\s\S]*?\) \{/
  );
  assert.match(
    sharedSource,
    /export function buildTraceRouteDecisionReadabilitySentence\([\s\S]*?\) \{/
  );
  assert.match(sharedSource, /routeDecision:\s*TraceRouteDecisionSummary;/);
  assert.match(
    sharedSource,
    /executionToolNames:\s*TraceExecutionToolName\[\];/
  );
  assert.match(
    sharedSource,
    /export function buildTraceMetadataCanonicalSurface\([\s\S]*?routeDecision:\s*TraceRouteDecisionSummary;[\s\S]*?\): TraceMetadataCanonicalSurface/
  );
  assert.match(sharedSource, /export const TRACE_EXECUTION_MODE_LABELS = \{/);
  assert.match(sharedSource, /manual:\s*'manual',/);
  assert.match(sharedSource, /workflow:\s*'workflow'/);
  assert.match(
    sharedSource,
    /export const TRACE_EXECUTION_MODES = \[\s*'manual',\s*'workflow'\s*\] as const satisfies TraceExecutionMode\[\];/
  );
  assert.match(
    sharedSource,
    /export function readTraceExecutionMode\([\s\S]*?\): TraceExecutionMode \| null/
  );
  assert.match(
    sharedSource,
    /export function buildTraceExecutionModeReadabilityLabel\([\s\S]*?\)\s*\{/
  );
  assert.match(
    sharedSource,
    /export function buildTraceExecutionModeReadabilitySentence\([\s\S]*?\)\s*\{/
  );
  assert.match(
    sharedSource,
    /export const TRACE_EXECUTION_TOOL_NAMES = \[[\s\S]*?'knowledge_base_search',[\s\S]*?'external_source_fetch',[\s\S]*?'policy_reply'[\s\S]*?\] as const satisfies TraceExecutionToolName\[\];/
  );
  assert.match(
    sharedSource,
    /return TRACE_EXECUTION_TOOL_NAMES\.filter\(\(toolName\) =>[\s\S]*?toolNames\.has\(toolName\)[\s\S]*?\);/
  );
  assert.match(
    sharedSource,
    /export function buildTraceExecutionToolNamesReadabilitySentence\([\s\S]*?\)\s*\{/
  );
  assert.match(routeViewHelpersSource, /from ['"]@rag-system\/shared['"]/);
  assert.match(
    routeViewHelpersSource,
    /knowledge_base:\s*TRACE_ROUTE_TYPE_LABELS\.knowledge_base/
  );
  assert.match(
    routeViewHelpersSource,
    /explicit_source_urls:\s*TRACE_ROUTE_REASON_LABELS\.explicit_source_urls/
  );
  assert.match(
    routeViewHelpersSource,
    /export function buildEnglishInspectionSurfaceExamples\(\)/
  );
  assert.match(
    routeViewHelpersSource,
    /TRACE_EXECUTION_MODE_LABELS\[executionMode\]/
  );
  assert.match(
    routeViewHelpersSource,
    /TRACE_EXECUTION_TOOL_LABELS\[toolName\]/
  );
  assert.match(
    agentSurfaceEntrySource,
    /import \{ buildEnglishInspectionSurfaceExamples \} from '\.\/route-view-helpers';/
  );
  assert.match(
    agentSurfaceEntrySource,
    /const englishExamples = buildEnglishInspectionSurfaceExamples\(\);/
  );
  assert.match(
    agentSurfaceEntrySource,
    /routeExamples:\s*englishExamples\.routeExamples/
  );
  assert.match(
    agentSurfaceEntrySource,
    /modeExamples:\s*englishExamples\.modeExamples/
  );
  assert.match(
    agentSurfaceEntrySource,
    /toolExamples:\s*englishExamples\.toolExamples/
  );
  assert.match(
    chatPageHelpersSource,
    /answerStatusSourceReadabilitySentence\?:\s*string \| null;/
  );
  assert.match(
    chatPageHelpersSource,
    /missingInformationProvenanceSentence\?:\s*string \| null;/
  );
  assert.match(
    chatPageHelpersSource,
    /retrievalModeProvenanceSentence\?:\s*string \| null;/
  );
  assert.match(
    chatPageHelpersSource,
    /normalizeTraceSummaryHintPart\([\s\S]*?summary\.answerStatusSourceReadabilitySentence[\s\S]*?summary\.missingInformationProvenanceSentence[\s\S]*?summary\.retrievalModeProvenanceSentence/
  );
  assert.match(
    tracesServiceSource,
    /buildTraceRouteDecisionReadabilitySentence,/
  );
  assert.match(
    tracesServiceSource,
    /buildTraceExecutionModeReadabilitySentence,/
  );
  assert.match(
    tracesServiceSource,
    /const routeDecisionReadabilitySentence =\s*buildTraceRouteDecisionReadabilitySentence\(routeType, routeReason\);/
  );
  assert.match(
    tracesServiceSource,
    /buildTraceExecutionToolNamesReadabilitySentence,/
  );
  assert.match(
    tracesServiceSource,
    /const executionModeReadabilitySentence =\s*buildTraceExecutionModeReadabilitySentence\(executionMode\);/
  );
  assert.match(
    tracesServiceSource,
    /const executionToolNamesReadabilitySentence =\s*buildTraceExecutionToolNamesReadabilitySentence\(executionToolNames\);/
  );
  assert.match(sharedSource, /timingSummary:\s*TraceTimingSummary;/);
  assert.match(sharedSource, /timingReadabilitySentence:\s*string;/);
  assert.match(sharedSource, /firstTokenMs:\s*number \| null;/);
  assert.match(sharedSource, /preGenerationMs:\s*number \| null;/);
  assert.match(sharedSource, /llmFirstTokenMs:\s*number \| null;/);
  assert.match(sharedSource, /answerGenerationMs:\s*number \| null;/);
  assert.match(sharedSource, /llmQueueWaitMs:\s*number \| null;/);
  assert.match(sharedSource, /retrievalQueueWaitMs:\s*number \| null;/);
  assert.match(sharedSource, /rewriteReadabilityLabel:\s*string;/);
  assert.match(sharedSource, /promptId:\s*string \| null;/);
  assert.match(sharedSource, /answerStatus:\s*TraceAnswerStatus \| null;/);
  assert.match(sharedSource, /qualityOverall:\s*TraceQualityOverall \| null;/);
  assert.match(sharedSource, /primaryIssue:\s*TracePrimaryIssue \| null;/);
  assert.match(sharedSource, /retrievalMode:\s*TraceRetrievalMode \| null;/);
  assert.match(
    sharedSource,
    /retrievalQuerySource:\s*TraceRetrievalQuerySource \| null;/
  );
  assert.match(sharedSource, /generationMode:\s*TraceGenerationMode \| null;/);
  assert.match(sharedSource, /contextMode:\s*TraceContextMode \| null;/);
  assert.match(sharedSource, /rewriteApplied:\s*boolean;/);
  assert.match(sharedSource, /fallbackReason:\s*TraceFallbackReason \| null;/);
  assert.match(
    sharedSource,
    /resolvedLanguage:\s*TraceResolvedLanguage \| null;/
  );
  assert.match(sharedSource, /export type TraceAnswerAttributionSummary = \{/);
  assert.match(
    sharedSource,
    /attribution:\s*TraceCitationAttribution \| null;/
  );
  assert.match(sharedSource, /source:\s*TraceCitationSelectionSource \| null;/);
  assert.match(
    sharedSource,
    /readability:\s*TraceAnswerAttributionReadability \| null;/
  );
  assert.match(sharedSource, /attributionLabel:\s*string \| null;/);
  assert.match(sharedSource, /sourceLabel:\s*string \| null;/);
  assert.match(sharedSource, /readabilityLabel:\s*string \| null;/);
  assert.match(sharedSource, /readabilityResolvedLabel:\s*string;/);
  assert.match(sharedSource, /readabilityHint:\s*string \| null;/);
  assert.match(sharedSource, /readabilitySentence:\s*string \| null;/);
  assert.match(
    sharedSource,
    /answerAttributionSummary:\s*TraceAnswerAttributionSummary;/
  );
  assert.match(sharedSource, /answerAttributionReadabilitySentence:\s*string;/);
  assert.match(sharedSource, /answerProvenanceSentence:\s*string;/);
  assert.match(sharedSource, /strategyReadabilityLabel:\s*string;/);
  assert.match(sharedSource, /retrievalModeProvenanceSentence:\s*string;/);
  assert.match(
    sharedSource,
    /answerAttribution:\s*TraceCitationAttribution \| null;/
  );
  assert.match(
    sharedSource,
    /answerAttributionSource:\s*TraceCitationSelectionSource \| null;/
  );
  assert.match(
    sharedSource,
    /answerEvidenceSource:\s*TraceCitationSelectionSource \| null;/
  );
  assert.match(sharedSource, /answerEvidenceSourceReadabilityLabel:\s*string;/);
  assert.match(
    sharedSource,
    /answerEvidenceSourceReadabilitySentence:\s*string;/
  );
  assert.match(
    sharedSource,
    /citationAttribution:\s*TraceCitationAttribution \| null;/
  );
  assert.match(
    sharedSource,
    /citationSelectionSource:\s*TraceCitationSelectionSource \| null;/
  );
  assert.match(sharedSource, /missingInformationCount:\s*number;/);
  assert.match(sharedSource, /answerTextSourceReadabilityLabel:\s*string;/);
  assert.match(sharedSource, /answerTextSourceReadabilitySentence:\s*string;/);
  assert.match(
    sharedSource,
    /answerTextSource:\s*TraceAnswerTextSource \| null;/
  );
  assert.match(sharedSource, /answerStatusSourceReadabilityLabel:\s*string;/);
  assert.match(
    sharedSource,
    /answerStatusSourceReadabilitySentence:\s*string;/
  );
  assert.match(
    sharedSource,
    /executionToolNamesReadabilitySentence:\s*string;/
  );
  assert.match(
    sharedSource,
    /answerStatusSource:\s*TraceAnswerStatusSource \| null;/
  );
  assert.match(sharedSource, /answerProvenanceReadabilitySentence:\s*string;/);
  assert.match(
    sharedSource,
    /missingInformationCountReadabilityLabel:\s*string;/
  );
  assert.match(
    sharedSource,
    /missingInformationSource:\s*TraceMissingInformationSource \| null;/
  );
  assert.match(
    sharedSource,
    /missingInformationSourceReadabilityLabel:\s*string;/
  );
  assert.match(
    sharedSource,
    /insufficientContextReason:\s*TraceInsufficientContextReason \| null;/
  );
  assert.match(sharedSource, /missingInformationProvenanceSentence:\s*string;/);
  assert.match(sharedSource, /failedStage:\s*TraceFailedStage \| null;/);
  assert.match(sharedSource, /failedStageReadabilityLabel:\s*string;/);
  assert.match(sharedSource, /failureMessage:\s*string \| null;/);
  assert.match(sharedSource, /failureReadabilitySentence:\s*string;/);
  assert.match(sharedSource, /candidateLimit:\s*number;/);
  assert.match(sharedSource, /vectorCandidateCount:\s*number;/);
  assert.match(sharedSource, /lexicalCandidateCount:\s*number;/);
  assert.match(sharedSource, /mergedCandidateCount:\s*number;/);
  assert.match(sharedSource, /rankedCandidateCount:\s*number;/);
  assert.match(sharedSource, /candidateCountReadabilityLabel:\s*string;/);
  assert.match(sharedSource, /candidateCountReadabilitySentence:\s*string;/);
  assert.match(sharedSource, /vectorCandidateLimitHit:\s*boolean;/);
  assert.match(sharedSource, /lexicalCandidateLimitHit:\s*boolean;/);
  assert.match(sharedSource, /rankingTopKHit:\s*boolean;/);
  assert.match(sharedSource, /primaryChunkCount:\s*number;/);
  assert.match(sharedSource, /neighborChunkCount:\s*number;/);
  assert.match(sharedSource, /retrievedChunkCount:\s*number;/);
  assert.match(sharedSource, /inputChunkCount:\s*number;/);
  assert.match(sharedSource, /promptContextCount:\s*number;/);
  assert.match(sharedSource, /contextGroupCount:\s*number;/);
  assert.match(sharedSource, /contextReadabilitySentence:\s*string;/);
  assert.match(sharedSource, /citationCount:\s*number;/);
  assert.match(sharedSource, /citationCountReadabilityLabel:\s*string;/);
  assert.match(sharedSource, /citationCountReadabilitySentence:\s*string;/);
  assert.match(sharedSource, /citationCountBeforeLimit:\s*number;/);
  assert.match(sharedSource, /citationLimitHit:\s*boolean;/);
  assert.match(sharedSource, /usedFallback:\s*boolean;/);
});
