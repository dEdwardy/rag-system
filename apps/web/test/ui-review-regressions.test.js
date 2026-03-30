const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const appShellPath = resolve(__dirname, "../src/app/AppShell.tsx");
const chatPagePath = resolve(__dirname, "../src/pages/chat/ChatPage.tsx");
const documentsPath = resolve(__dirname, "../src/pages/documents/DocumentsPage.tsx");
const documentDetailPath = resolve(__dirname, "../src/pages/documents/DocumentDetailPage.tsx");
const knowledgeBasePath = resolve(__dirname, "../src/pages/knowledge-base/KnowledgeBasePage.tsx");
const usagePath = resolve(__dirname, "../src/pages/usage/UsagePage.tsx");
const traceListPath = resolve(__dirname, "../src/pages/traces/TraceListPage.tsx");
const traceDetailPath = resolve(__dirname, "../src/pages/traces/TraceDetailPage.tsx");
const reportCenterPath = resolve(__dirname, "../src/pages/reports/ReportCenterPage.tsx");
const loginPagePath = resolve(__dirname, "../src/pages/auth/LoginPage.tsx");
const globalCssPath = resolve(__dirname, "../src/styles/global.css");
const messagesPath = resolve(__dirname, "../src/i18n/messages.ts");
const apiTypesPath = resolve(__dirname, "../src/types/api.ts");
const indexHtmlPath = resolve(__dirname, "../index.html");

test("shell and chat do not present unfinished controls as active interactions", () => {
  const shellSource = readFileSync(appShellPath, "utf8");
  const chatSource = readFileSync(chatPagePath, "utf8");

  assert.doesNotMatch(shellSource, /aria-label=\{locale === "zh" \? "褰撳墠鐭ヨ瘑搴? : "Current knowledge base"\}[\s\S]*type="button"/);
  assert.match(shellSource, /aria-hidden="true"[\s\S]*appShellCopy\.currentKnowledgeBase/);

  assert.doesNotMatch(chatSource, /"浼氳瘽" : "Conversations"[\s\S]*type="button"[\s\S]*"寮曠敤" : "Citations"[\s\S]*type="button"/);
  assert.match(chatSource, /chatCopy\.currentCitations/);
  assert.match(chatSource, /chatCopy\.citationsAndTrace|chatCopy\.fileUploadComingSoon/);
});

test("wave 1 remediation controls expose stable mobile-nav and delete-confirm selectors", () => {
  const shellSource = readFileSync(appShellPath, "utf8");
  const detailSource = readFileSync(documentDetailPath, "utf8");

  assert.match(shellSource, /data-testid="mobile-nav-toggle"/);
  assert.match(shellSource, /data-testid="mobile-nav-drawer"/);
  assert.match(shellSource, /aria-controls="mobile-nav-drawer"/);
  assert.match(detailSource, /data-testid="document-delete-trigger"/);
  assert.match(detailSource, /data-testid="document-delete-confirm"/);
  assert.match(detailSource, /data-testid="document-delete-cancel"/);
  assert.match(detailSource, /opened=\{isDeleteConfirmOpen\}/);
});

test("app shell shows a compact current identity card for auth context", () => {
  const shellSource = readFileSync(appShellPath, "utf8");

  assert.match(shellSource, /data-testid="current-identity-card"/);
  assert.match(shellSource, /appShellCopy\.currentIdentityHeading/);
  assert.match(shellSource, /appShellCopy\.currentIdentityDescription/);
  assert.match(shellSource, /currentIdentity\.userId/);
  assert.match(shellSource, /currentIdentity\.tenantId/);
  assert.match(shellSource, /currentIdentity\.authSource/);
  assert.match(shellSource, /loginProvenance\.type/);
  assert.match(shellSource, /appShellCopy\.oauthSessionPrefix/);
  assert.match(shellSource, /Local session|本地会话/);
});

test("web auth me contract includes additive login provenance shape", () => {
  const apiTypesSource = readFileSync(apiTypesPath, "utf8");

  assert.match(apiTypesSource, /loginProvenance:\s*\{/);
  assert.match(apiTypesSource, /type:\s*"local_session"\s*\|\s*"oauth_session"/);
  assert.match(apiTypesSource, /oauthProvider:\s*"github"\s*\|\s*"google"\s*\|\s*"oidc"\s*\|\s*null/);
});

test("login page keeps provider-entry parity for GitHub Google and OIDC", () => {
  const loginPageSource = readFileSync(loginPagePath, "utf8");

  assert.match(loginPageSource, /resolveApiUrl\("\/auth\/oauth\/github\/start"\)/);
  assert.match(loginPageSource, /resolveApiUrl\("\/auth\/oauth\/google\/start"\)/);
  assert.match(loginPageSource, /resolveApiUrl\("\/auth\/oauth\/oidc\/start"\)/);
  assert.match(loginPageSource, /Continue with GitHub/);
  assert.match(loginPageSource, /Continue with Google/);
  assert.match(loginPageSource, /Continue with OIDC/);
});

test("knowledge base page uses a compact metric grid instead of a long side rail", () => {
  const source = readFileSync(knowledgeBasePath, "utf8");

  assert.match(source, /workspace-metric-grid/);
  assert.doesNotMatch(source, /workspace-page-grid-main-first/);
  assert.match(source, /useKnowledgeBaseDocumentRuns/);
  assert.match(source, /useKnowledgeBaseDocumentRunSummary/);
  assert.match(source, /Latest failure context|最新失败上下文/);
  assert.match(source, /status:\s*runStatusFilter/);
  assert.match(source, /to=\{`\/documents\/\$\{latestFailure\.documentId\}`\}/);
});

test("assistant copy avoids exposing backend field names and trace raw payload is secondary", () => {
  const messagesSource = readFileSync(messagesPath, "utf8");
  const traceSource = readFileSync(traceDetailPath, "utf8");

  assert.doesNotMatch(messagesSource, /enableHybrid|enableRerank/);
  assert.match(traceSource, /<details[\s\S]*common\.fields\.rawPayload/);
});

test("documents and trace list emphasize readable workspace summaries over sparse or overly technical cards", () => {
  const documentsSource = readFileSync(documentsPath, "utf8");
  const detailSource = readFileSync(documentDetailPath, "utf8");
  const runListSource = readFileSync(resolve(__dirname, "../src/components/document-runs/DocumentRunList.tsx"), "utf8");
  const traceListSource = readFileSync(traceListPath, "utf8");

  assert.match(documentsSource, /workspace-metric-grid/);
  assert.match(documentsSource, /workspace-subpanel/);
  assert.match(detailSource, /workspace-detail-secondary-grid|workspace-collection-grid/);
  assert.match(detailSource, /useDocumentRuns/);
  assert.match(detailSource, /Document runs|文档 runs/);
  assert.match(runListSource, /component=\{Link\}/);
  assert.match(runListSource, /to=\{`\/documents\/\$\{run\.documentId\}`\}/);
  assert.match(runListSource, /onReindexRun/);
  assert.match(traceListSource, /workspace-trace-list/);
  assert.doesNotMatch(traceListSource, /Conversation ID[^]*Latest trace[^]*Created/);
});

test("documents page source-entry keeps web page/feed/sitemap entrypoint parity under one submit guard", () => {
  const documentsSource = readFileSync(documentsPath, "utf8");
  const messagesSource = readFileSync(messagesPath, "utf8");

  assert.match(documentsSource, /useCreateWebPageDocument/);
  assert.match(documentsSource, /useCreateFeedDocument/);
  assert.match(documentsSource, /useCreateSitemapDocument/);
  assert.match(documentsSource, /createWebPageMutation\.isPending \|\| createFeedMutation\.isPending \|\| createSitemapMutation\.isPending/);
  assert.match(documentsSource, /documents\.sourceEntryScanPath/);
  assert.match(documentsSource, /documents\.webPage\.sectionTitle/);
  assert.match(documentsSource, /documents\.feed\.sectionTitle/);
  assert.match(documentsSource, /documents\.sitemap\.sectionTitle/);
  assert.match(documentsSource, /documents\.webPage\.submitAction/);
  assert.match(documentsSource, /documents\.feed\.submitAction/);
  assert.match(documentsSource, /documents\.sitemap\.submitAction/);
  assert.match(documentsSource, /validateSourceEntryUrl/);
  assert.match(documentsSource, /documents\.sourceEntryInlineErrorRequired/);
  assert.match(documentsSource, /documents\.sourceEntryInlineErrorInvalidHttpUrl/);
  assert.match(messagesSource, /sourceEntryInlineErrorRequired: "Enter a URL in this source field before submitting\."/);
  assert.match(messagesSource, /sourceEntryInlineErrorInvalidHttpUrl: "Enter a valid http\(s\) URL for this source field\."/);
  assert.match(messagesSource, /sourceEntryInlineErrorRequired: "请先在此来源输入框中填入 URL 再提交。"/);
  assert.match(messagesSource, /sourceEntryInlineErrorInvalidHttpUrl: "请输入合法的 http\(s\) 来源 URL。"/);
  assert.match(messagesSource, /webPage:\s*\{[^]*submitSuccess: "Source URL submitted: \{url\}\."/);
  assert.match(messagesSource, /feed:\s*\{[^]*submitSuccess: "Source URL submitted: \{url\}\."/);
  assert.match(messagesSource, /sitemap:\s*\{[^]*submitSuccess: "Source URL submitted: \{url\}\."/);
  assert.match(messagesSource, /webPage:\s*\{[^]*submitSuccess: "已提交来源 URL：\{url\}。"/);
  assert.match(messagesSource, /feed:\s*\{[^]*submitSuccess: "已提交来源 URL：\{url\}。"/);
  assert.match(messagesSource, /sitemap:\s*\{[^]*submitSuccess: "已提交来源 URL：\{url\}。"/);
  assert.match(documentsSource, /resolveSourceEntryStatus/);
  assert.match(documentsSource, /documents\.sourceEntryStatusEmpty/);
  assert.match(documentsSource, /documents\.sourceEntryStatusReady/);
  assert.match(documentsSource, /documents\.sourceEntryStatusSubmitting/);
  assert.match(messagesSource, /sourceEntrySubmittingHint: "Source intake busy\. Wait for the current submission to finish before submitting another URL\."/);
  assert.match(messagesSource, /sourceEntryStatusEmpty: "Source intake idle\. Paste one URL to enable submission\."/);
  assert.match(messagesSource, /sourceEntryStatusSubmitting: "Source intake busy\. Keep this section read-only until it finishes\."/);
  assert.match(messagesSource, /sourceEntrySubmittingHint: "来源录入忙碌中：请等待当前提交完成后再提交下一条 URL。"/);
  assert.match(messagesSource, /sourceEntryStatusEmpty: "来源录入待命：先粘贴一个 URL，提交按钮才会启用。"/);
  assert.match(messagesSource, /sourceEntryStatusSubmitting: "来源录入忙碌中：该区域暂时只读，提交完成后再继续。"/);
  assert.match(documentsSource, /webPageSourceEntryStatus/);
  assert.match(documentsSource, /feedSourceEntryStatus/);
  assert.match(documentsSource, /sitemapSourceEntryStatus/);
  assert.match(documentsSource, /error=\{webPageInlineError \?\? undefined\}/);
  assert.match(documentsSource, /error=\{feedInlineError \?\? undefined\}/);
  assert.match(documentsSource, /error=\{sitemapInlineError \?\? undefined\}/);
  assert.match(documentsSource, /disabled=\{isAnySourceSubmissionPending\}/);
});

test("chat and trace detail surface higher-level workspace summaries before diagnostics", () => {
  const chatSource = readFileSync(chatPagePath, "utf8");
  const traceSource = readFileSync(traceDetailPath, "utf8");
  const statePanelSource = readFileSync(resolve(__dirname, "../src/components/StatePanel.tsx"), "utf8");

  assert.match(chatSource, /workspace-chat-summary/);
  assert.match(chatSource, /resolveWorkspaceStatus\(/);
  assert.match(chatSource, /readyToAsk:\s*t\("chat\.copy\.readyToAsk"\)/);
  assert.match(traceSource, /workspace-metric-grid/);
  assert.match(traceSource, /tone="loading"/);
  assert.match(traceSource, /href=\{`#\$\{TRACE_DETAIL_SECTION_IDS\.retrievedChunks\}`\}/);
  assert.match(traceSource, /href=\{`#\$\{TRACE_DETAIL_SECTION_IDS\.citations\}`\}/);
  assert.match(traceSource, /href=\{`#\$\{TRACE_DETAIL_SECTION_IDS\.rawPayload\}`\}/);
  assert.match(traceSource, /Grounded \(grounded\)/);
  assert.match(traceSource, /上下文不足（insufficient_context）/);
  assert.match(statePanelSource, /data-tone=/);
});

test("usage page exposes a single P6 v1 alert view for warnings and threshold issues", () => {
  const usageSource = readFileSync(usagePath, "utf8");

  assert.match(usageSource, /P6 v1 alert view|P6 v1 告警视图/);
  assert.match(usageSource, /important warnings and threshold issues|重要 warning 与阈值问题/);
  assert.match(usageSource, /run-backlog-threshold/);
  assert.match(usageSource, /issue-events-threshold/);
});

test("usage page exposes a P6 v1 trend view with 1h/6h/24h windows", () => {
  const usageSource = readFileSync(usagePath, "utf8");

  assert.match(usageSource, /P6 v1 trend view|P6 v1 趋势视图/);
  assert.match(usageSource, /1h:\s*\{metric\.values\[0\]\} · 6h:\s*\{metric\.values\[1\]\} · 24h:\s*\{metric\.values\[2\]\}/);
  assert.match(usageSource, /failed-runs/);
  assert.match(usageSource, /issue-events/);
});

test("usage page exposes a P6 v1 anomaly clustering view for repeated failure patterns", () => {
  const usageSource = readFileSync(usagePath, "utf8");

  assert.match(usageSource, /P6 v1 anomaly clustering view|P6 v1 异常聚类视图/);
  assert.match(usageSource, /Group related failures by stage and code|按阶段与错误码聚合同类失败/);
  assert.match(usageSource, /failure-pattern-cluster/);
});

test("usage page exposes a P6 v1 regression diff view for concise run-to-run diagnostics", () => {
  const usageSource = readFileSync(usagePath, "utf8");

  assert.match(usageSource, /P6 v1 regression diff view|P6 v1 回归差异视图/);
  assert.match(usageSource, /latest two issue runs|最近两次问题 run/);
  assert.match(usageSource, /useKnowledgeBaseDocumentRunComparison/);
  assert.match(usageSource, /regression-diff-row/);
});

test("usage page exposes a source-family hotspot panel from bySourceFamily summary data", () => {
  const usageSource = readFileSync(usagePath, "utf8");

  assert.match(usageSource, /P6 v1 source-family hotspot|P6 v1 source-family 热点/);
  assert.match(usageSource, /bySourceFamily summary data|bySourceFamily 摘要/);
  assert.match(usageSource, /source-family-hotspot-row/);
});

test("usage page exposes a focused snapshot window diff (6h vs 24h) for issue snapshots", () => {
  const usageSource = readFileSync(usagePath, "utf8");

  assert.match(usageSource, /P6 v1 snapshot window diff|P6 v1 快照窗口差异/);
  assert.match(usageSource, /6h vs 24h issue snapshots|6h 与 24h 的 issue snapshot/);
  assert.match(usageSource, /leftSinceHours:\s*6/);
  assert.match(usageSource, /rightSinceHours:\s*24/);
  assert.match(usageSource, /snapshot-window-diff-row/);
  assert.match(usageSource, /sourceFamilyDeltas/);
  assert.match(usageSource, /issueHotspotSlice/);
  assert.match(usageSource, /snapshot-window-source-family-drilldown/);
  assert.match(usageSource, /issue-window slice|issue-window 切片/);
  assert.match(usageSource, /snapshot-window-issue-slice/);
  assert.match(usageSource, /snapshot-window-issue-left-hotspot/);
  assert.match(usageSource, /snapshot-window-issue-right-hotspot/);
  assert.match(usageSource, /snapshot-window-issue-dominant-shift/);
  assert.match(usageSource, /snapshot-window-issue-left-hotspot-empty/);
  assert.match(usageSource, /snapshot-window-issue-right-hotspot-empty/);
  assert.match(usageSource, /snapshot-window-issue-dominant-shift-empty/);
  assert.match(usageSource, /Left window[^\n]*hotspot:[^\n]*issue signal[^\n]*\/ total/);
  assert.match(usageSource, /Right window[^\n]*hotspot:[^\n]*issue signal[^\n]*\/ total/);
  assert.match(usageSource, /Dominant shift:[^\n]*issue concentration Δ[^\n]*issue signal Δ/);
  assert.match(usageSource, /左窗口[^\n]*热点：[^\n]*issue signal[^\n]*\/ total/);
  assert.match(usageSource, /右窗口[^\n]*热点：[^\n]*issue signal[^\n]*\/ total/);
  assert.match(usageSource, /主变化项：[^\n]*issue concentration Δ[^\n]*issue signal Δ/);
  assert.match(usageSource, /No left-window hotspot detected|未检测到热点/);
  assert.match(usageSource, /No right-window hotspot detected|未检测到热点/);
  assert.match(usageSource, /No readable dominant shift is available|未形成可读主变化项/);
});

test("usage page keeps a no-knowledge-base guidance state and avoids default-kb fallback loading", () => {
  const usageSource = readFileSync(usagePath, "utf8");

  assert.match(usageSource, /No active knowledge base to scan|还没有可扫描的知识库/);
  assert.match(usageSource, /Create a knowledge base first|先创建知识库/);
  assert.match(usageSource, /useDocuments\(activeKnowledgeBase\?\.id \?\? "", hasActiveKnowledgeBase\)/);
  assert.doesNotMatch(usageSource, /useDocuments\(activeKnowledgeBase\?\.id \?\? "default-kb"\)/);
});

test("usage page keeps one explicit P6 pre-run guidance state when run history is still empty", () => {
  const usageSource = readFileSync(usagePath, "utf8");

  assert.match(usageSource, /showP6PreRunGuidance/);
  assert.match(usageSource, /usage-p6-pre-run-guidance/);
  assert.match(usageSource, /P6 pre-run guidance \(scan-first\)|P6 预运行引导（scan-first）/);
  assert.match(usageSource, /Start with one scan-first run|先跑一次扫描/);
  assert.match(usageSource, /has no document-run history yet|还没有文档运行记录/);
  assert.match(usageSource, /Trigger one document scan\/re-run|触发一次文档扫描\/重跑/);
  assert.match(usageSource, /trend\/alert\/anomaly\/diff\/hotspot panels stay collapsed|趋势\/告警\/异常\/差异\/热点面板会保持收起/);
  assert.match(usageSource, /usage-p6-pre-run-path/);
  assert.match(usageSource, /scan path: Knowledge base \(trigger scan\) → Usage \(review P6 signals\)/);
});

test("report center keeps run inputs in query params for carry-through reruns", () => {
  const reportCenterSource = readFileSync(reportCenterPath, "utf8");

  assert.match(reportCenterSource, /useSearchParams/);
  assert.match(reportCenterSource, /searchParams\.get\("questionSetId"\)/);
  assert.match(reportCenterSource, /searchParams\.get\("assistantId"\)/);
  assert.match(reportCenterSource, /searchParams\.get\("baselineSnapshotId"\)/);
  assert.match(reportCenterSource, /setSearchParams\(createEvalRunSearchParams\(evalRunParams\), \{ replace: true \}\)/);
  assert.match(reportCenterSource, /normalizeEvalRunParams/);
  assert.match(reportCenterSource, /report-center-pre-run-path/);
  assert.match(reportCenterSource, /scan path: Eval run \(trigger first run\) -> Report center \(review quality\/diff\/weakest items\)/);
  assert.match(reportCenterSource, /Start with one scan-first run|先跑一次 scan-first run/);
  assert.match(reportCenterSource, /scan-first: this run is not linked to a baseline snapshot|scan-first：本次 run 未绑定 baseline snapshot/);
  assert.match(
    reportCenterSource,
    /scan-first: baseline version is unavailable until a baseline snapshot is linked|scan-first：baseline version 暂不可读（先绑定 baseline snapshot）/
  );
  assert.match(reportCenterSource, /formatBaselineMetadataValue\(runEvalMutation\.data\.baselineSnapshotId,/);
  assert.match(reportCenterSource, /formatBaselineMetadataValue\(runEvalMutation\.data\.baselineVersion,/);
  assert.match(reportCenterSource, /hasRunItems/);
  assert.match(reportCenterSource, /This run has no eval items yet|本次 run 暂无题目结果/);
});

test("shared secondary text contrast is lifted above the previous dim baseline", () => {
  const cssSource = readFileSync(globalCssPath, "utf8");

  assert.match(cssSource, /--app-text-secondary:\s*#c9c9d4;/);
  assert.match(cssSource, /--app-text-muted:\s*#a2a2af;/);
});

test("index html defines a favicon to avoid the default 404 noise", () => {
  const source = readFileSync(indexHtmlPath, "utf8");

  assert.match(source, /rel="icon"/);
});
