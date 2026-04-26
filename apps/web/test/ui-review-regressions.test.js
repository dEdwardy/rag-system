import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const appShellPath = resolve(__dirname, '../src/app/AppShell.tsx');
const chatPagePath = resolve(__dirname, '../src/pages/chat/ChatPage.tsx');
const documentsPath = resolve(
  __dirname,
  '../src/pages/documents/DocumentsPage.tsx'
);
const documentsSourceEntryPanelPath = resolve(
  __dirname,
  '../src/pages/documents/DocumentsSourceEntryPanel.tsx'
);
const documentDetailPath = resolve(
  __dirname,
  '../src/pages/documents/DocumentDetailPage.tsx'
);
const assistantPagePath = resolve(
  __dirname,
  '../src/pages/assistant/AssistantPage.tsx'
);
const knowledgeBasePath = resolve(
  __dirname,
  '../src/pages/knowledge-base/KnowledgeBasePage.tsx'
);
const usagePath = resolve(__dirname, '../src/pages/usage/UsagePage.tsx');
const usageHealthBoardPath = resolve(
  __dirname,
  '../src/pages/usage/UsageHealthBoard.tsx'
);
const usageHelpersPath = resolve(
  __dirname,
  '../src/pages/usage/usage-page-helpers.ts'
);
const traceListPath = resolve(
  __dirname,
  '../src/pages/traces/TraceListPage.tsx'
);
const traceDetailPath = resolve(
  __dirname,
  '../src/pages/traces/TraceDetailPage.tsx'
);
const traceDetailSupportPanelsPath = resolve(
  __dirname,
  '../src/pages/traces/TraceDetailSupportPanels.tsx'
);
const reportCenterPath = resolve(
  __dirname,
  '../src/pages/reports/ReportCenterPage.tsx'
);
const reportCenterHelpersPath = resolve(
  __dirname,
  '../src/pages/reports/report-center-page-helpers.ts'
);
const agentSurfaceEntryPath = resolve(
  __dirname,
  '../src/pages/reports/AgentSurfaceEntry.tsx'
);
const workspaceSelectionPath = resolve(
  __dirname,
  '../src/features/api/workspace-selection.ts'
);
const englishMessagesPath = resolve(__dirname, '../src/i18n/messages.en.ts');
const chineseMessagesPath = resolve(__dirname, '../src/i18n/messages.zh.ts');

test('workspace shell and chat keep the current single-library scan-first wiring', () => {
  const shellSource = readFileSync(appShellPath, 'utf8');
  const chatSource = readFileSync(chatPagePath, 'utf8');
  const workspaceSelectionSource = readFileSync(workspaceSelectionPath, 'utf8');

  assert.match(
    shellSource,
    /getPrimaryKnowledgeBase\(knowledgeBasesQuery\.data\)/
  );
  assert.match(shellSource, /data-testid="current-identity-card"/);
  assert.doesNotMatch(
    shellSource,
    /useDocuments\(activeKnowledgeBase\?\.id \?\? "default-kb"/
  );

  assert.match(chatSource, /data-testid="chat-page"/);
  assert.match(chatSource, /xl:grid-cols-\[minmax\(0,1fr\)_340px\]/);
  assert.match(chatSource, /const ChatWorkspacePanels = lazy/);
  assert.match(chatSource, /getPrimaryAssistantForKnowledgeBase/);
  assert.match(
    chatSource,
    /currentCitations:\s*t\('chat\.copy\.currentCitations'\)/
  );
  assert.match(chatSource, /newChat:\s*t\('chat\.copy\.newChat'\)/);
  assert.doesNotMatch(chatSource, /default-kb/);

  assert.match(
    workspaceSelectionSource,
    /\(assistant\) => assistant\.kbId === knowledgeBaseId/
  );
});

test('documents, assistant, and knowledge-base pages keep current workspace-first empty states', () => {
  const documentsSource = readFileSync(documentsPath, 'utf8');
  const documentsSourceEntryPanelSource = readFileSync(
    documentsSourceEntryPanelPath,
    'utf8'
  );
  const detailSource = readFileSync(documentDetailPath, 'utf8');
  const assistantSource = readFileSync(assistantPagePath, 'utf8');
  const knowledgeBaseSource = readFileSync(knowledgeBasePath, 'utf8');
  const englishMessagesSource = readFileSync(englishMessagesPath, 'utf8');

  assert.match(documentsSource, /workspaceStatusNoActiveKnowledgeBase/);
  assert.match(documentsSource, /documents\.currentKnowledgeBaseHintHasKb/);
  assert.doesNotMatch(documentsSource, /default-kb|Default KB/);
  assert.match(documentsSourceEntryPanelSource, /useCreateWebPageDocument/);
  assert.match(documentsSourceEntryPanelSource, /useCreateFeedDocument/);
  assert.match(documentsSourceEntryPanelSource, /useCreateSitemapDocument/);
  assert.match(
    documentsSourceEntryPanelSource,
    /documents\.sourceEntryStatusNoActiveKnowledgeBase/
  );

  assert.match(detailSource, /data-testid="document-delete-trigger"/);
  assert.match(detailSource, /data-testid="document-delete-confirm"/);
  assert.match(detailSource, /data-testid="document-delete-confirmation"/);

  assert.match(assistantSource, /const AssistantSettingsForm = lazy/);
  assert.match(assistantSource, /to="\/knowledge-base"/);
  assert.match(assistantSource, /to="\/documents"/);

  assert.match(knowledgeBaseSource, /workspace-metric-grid/);
  assert.match(knowledgeBaseSource, /useCreateKnowledgeBase/);
  assert.match(knowledgeBaseSource, /knowledgeBase\.create\.nextStepTitle/);

  assert.match(
    englishMessagesSource,
    /noActiveKnowledgeBaseTitle:\s*'No active workspace library for this page'/
  );
  assert.match(
    englishMessagesSource,
    /modalTitle:\s*'Create the first workspace library'/
  );
});

test('usage, trace, and report-center helpers keep current scan-first contracts', () => {
  const usageSource = readFileSync(usagePath, 'utf8');
  const usageHealthBoardSource = readFileSync(usageHealthBoardPath, 'utf8');
  const usageHelpersSource = readFileSync(usageHelpersPath, 'utf8');
  const traceListSource = readFileSync(traceListPath, 'utf8');
  const traceSource = readFileSync(traceDetailPath, 'utf8');
  const traceSupportPanelsSource = readFileSync(
    traceDetailSupportPanelsPath,
    'utf8'
  );
  const reportSource = readFileSync(reportCenterPath, 'utf8');
  const reportHelpersSource = readFileSync(reportCenterHelpersPath, 'utf8');
  const agentSurfaceEntrySource = readFileSync(agentSurfaceEntryPath, 'utf8');
  const englishMessagesSource = readFileSync(englishMessagesPath, 'utf8');
  const chineseMessagesSource = readFileSync(chineseMessagesPath, 'utf8');

  assert.match(usageSource, /const UsageHealthBoard = lazy/);
  assert.match(usageSource, /buildRunSummaryActionTarget/);
  assert.doesNotMatch(usageSource, /default-kb/);
  assert.match(usageHealthBoardSource, /usage-p6-pre-run-guidance/);
  assert.match(usageHealthBoardSource, /source-family-hotspot-row/);

  assert.match(
    usageHelpersSource,
    /export function buildRunSummaryActionTarget/
  );
  assert.match(usageHelpersSource, /Open item with issues/);
  assert.match(usageHelpersSource, /Open operations summary/);
  assert.match(
    usageHelpersSource,
    /\/documents\/\$\{args\.latestFailureDocumentId\}/
  );

  assert.match(traceListSource, /workspace-trace-list/);
  assert.match(traceListSource, /TraceRouteFilterPanel/);
  assert.ok(
    traceSource.indexOf('Single diagnostic path (scan-first)') <
      traceSource.indexOf('Execution summary'),
    'Trace detail should keep the scan-first path ahead of the execution summary'
  );
  assert.match(traceSupportPanelsSource, /common\.fields\.rawPayload/);

  assert.match(reportSource, /useSearchParams/);
  assert.match(reportSource, /buildEvalRunCarryThroughPreview/);
  assert.match(reportSource, /AgentSurfaceEntry/);
  assert.match(reportSource, /report-center-pre-run-path/);
  assert.match(reportHelpersSource, /export function normalizeEvalRunParams/);
  assert.match(
    reportHelpersSource,
    /export function buildEvalRunCarryThroughPreview/
  );
  assert.match(agentSurfaceEntrySource, /route/i);
  assert.match(agentSurfaceEntrySource, /mode/i);
  assert.match(agentSurfaceEntrySource, /tools/i);

  assert.match(englishMessagesSource, /documents:\s*'Library'/);
  assert.match(englishMessagesSource, /currentCitations:\s*'Sources'/);
  assert.match(chineseMessagesSource, /documents:\s*'[\u4e00-\u9fff]+/);
});
