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
    /executionMode:\s*TraceExecutionPlan\['executionMode'\] \| null;/
  );
  assert.match(traceSummaryBody, /executionModeReadabilityLabel:\s*string;/);
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
