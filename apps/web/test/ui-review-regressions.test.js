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
const globalCssPath = resolve(__dirname, "../src/styles/global.css");
const messagesPath = resolve(__dirname, "../src/i18n/messages.ts");
const indexHtmlPath = resolve(__dirname, "../index.html");

test("shell and chat do not present unfinished controls as active interactions", () => {
  const shellSource = readFileSync(appShellPath, "utf8");
  const chatSource = readFileSync(chatPagePath, "utf8");

  assert.doesNotMatch(shellSource, /aria-label=\{locale === "zh" \? "褰撳墠鐭ヨ瘑搴? : "Current knowledge base"\}[\s\S]*type="button"/);
  assert.match(shellSource, /aria-hidden="true"[\s\S]*Current knowledge base/);

  assert.doesNotMatch(chatSource, /"浼氳瘽" : "Conversations"[\s\S]*type="button"[\s\S]*"寮曠敤" : "Citations"[\s\S]*type="button"/);
  assert.match(chatSource, /Current citations/);
  assert.match(chatSource, /Coming soon|敬请期待|即将支持/);
});

test("app shell shows a compact current identity card for auth context", () => {
  const shellSource = readFileSync(appShellPath, "utf8");

  assert.match(shellSource, /data-testid="current-identity-card"/);
  assert.match(shellSource, /Current identity|当前身份/);
  assert.match(shellSource, /Active auth context|登录态上下文/);
  assert.match(shellSource, /currentIdentity\.userId/);
  assert.match(shellSource, /currentIdentity\.tenantId/);
  assert.match(shellSource, /currentIdentity\.authSource/);
});

test("knowledge base page uses a compact metric grid instead of a long side rail", () => {
  const source = readFileSync(knowledgeBasePath, "utf8");

  assert.match(source, /workspace-metric-grid/);
  assert.doesNotMatch(source, /workspace-page-grid-main-first/);
  assert.match(source, /useKnowledgeBaseDocumentRuns/);
  assert.match(source, /useKnowledgeBaseDocumentRunSummary/);
  assert.match(source, /Latest failure context|最新失败上下文/);
  assert.match(source, /status:\s*runFilter === "all" \? undefined : runFilter/);
  assert.match(source, /to=\{`\/documents\/\$\{runSummaryQuery\.data\.latestFailure\.documentId\}`\}/);
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

test("chat and trace detail surface higher-level workspace summaries before diagnostics", () => {
  const chatSource = readFileSync(chatPagePath, "utf8");
  const traceSource = readFileSync(traceDetailPath, "utf8");
  const statePanelSource = readFileSync(resolve(__dirname, "../src/components/StatePanel.tsx"), "utf8");

  assert.match(chatSource, /workspace-chat-summary/);
  assert.match(chatSource, /Ready to ask|准备提问/);
  assert.match(traceSource, /Execution summary|执行摘要/);
  assert.match(traceSource, /Failure taxonomy \(P6 v1\)|失败分类（P6 v1）/);
  assert.match(traceSource, /No-hit retrieval|无命中检索（no-hit）/);
  assert.match(traceSource, /Trace quick jumps|Trace 快速跳转/);
  assert.match(traceSource, /Go to retrieved chunks|查看命中 Chunk/);
  assert.match(traceSource, /href=\{`#\$\{TRACE_DETAIL_SECTION_IDS\.retrievedChunks\}`\}/);
  assert.match(traceSource, /href=\{`#\$\{TRACE_DETAIL_SECTION_IDS\.citations\}`\}/);
  assert.match(traceSource, /href=\{`#\$\{TRACE_DETAIL_SECTION_IDS\.rawPayload\}`\}/);
  assert.match(traceSource, /workspace-metric-grid/);
  assert.match(traceSource, /Answer provenance|回答溯源/);
  assert.match(traceSource, /Missing-information provenance|缺失信息溯源/);
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

test("report center keeps run inputs in query params for carry-through reruns", () => {
  const reportCenterSource = readFileSync(reportCenterPath, "utf8");

  assert.match(reportCenterSource, /useSearchParams/);
  assert.match(reportCenterSource, /searchParams\.get\("questionSetId"\)/);
  assert.match(reportCenterSource, /searchParams\.get\("assistantId"\)/);
  assert.match(reportCenterSource, /searchParams\.get\("baselineSnapshotId"\)/);
  assert.match(reportCenterSource, /setSearchParams\(nextSearchParams, \{ replace: true \}\)/);
  assert.match(reportCenterSource, /Start with one scan-first run|先跑一次 scan-first run/);
  assert.match(reportCenterSource, /scan-first: no baseline linked for this run|scan-first：当前 run 未绑定 baseline/);
  assert.match(reportCenterSource, /formatBaselineMetadataValue\(runEvalMutation\.data\.baselineSnapshotId\)/);
  assert.match(reportCenterSource, /formatBaselineMetadataValue\(runEvalMutation\.data\.baselineVersion\)/);
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
