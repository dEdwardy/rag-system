const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const appShellPath = resolve(__dirname, "../src/app/AppShell.tsx");
const chatPagePath = resolve(__dirname, "../src/pages/chat/ChatPage.tsx");
const documentsPath = resolve(__dirname, "../src/pages/documents/DocumentsPage.tsx");
const documentDetailPath = resolve(__dirname, "../src/pages/documents/DocumentDetailPage.tsx");
const knowledgeBasePath = resolve(__dirname, "../src/pages/knowledge-base/KnowledgeBasePage.tsx");
const traceListPath = resolve(__dirname, "../src/pages/traces/TraceListPage.tsx");
const traceDetailPath = resolve(__dirname, "../src/pages/traces/TraceDetailPage.tsx");
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
  assert.match(traceSource, /workspace-metric-grid/);
  assert.match(traceSource, /Answer provenance|回答溯源/);
  assert.match(traceSource, /Missing-information provenance|缺失信息溯源/);
  assert.match(statePanelSource, /data-tone=/);
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
