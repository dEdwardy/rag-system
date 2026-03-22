const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const appShellPath = resolve(__dirname, "../src/app/AppShell.tsx");
const chatPagePath = resolve(__dirname, "../src/pages/chat/ChatPage.tsx");
const knowledgeBasePath = resolve(__dirname, "../src/pages/knowledge-base/KnowledgeBasePage.tsx");
const traceDetailPath = resolve(__dirname, "../src/pages/traces/TraceDetailPage.tsx");
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

test("knowledge base page uses a compact metric grid instead of a long side rail", () => {
  const source = readFileSync(knowledgeBasePath, "utf8");

  assert.match(source, /workspace-metric-grid/);
  assert.doesNotMatch(source, /workspace-page-grid-main-first/);
});

test("assistant copy avoids exposing backend field names and trace raw payload is secondary", () => {
  const messagesSource = readFileSync(messagesPath, "utf8");
  const traceSource = readFileSync(traceDetailPath, "utf8");

  assert.doesNotMatch(messagesSource, /enableHybrid|enableRerank/);
  assert.match(traceSource, /<details[\s\S]*common\.fields\.rawPayload/);
});

test("index html defines a favicon to avoid the default 404 noise", () => {
  const source = readFileSync(indexHtmlPath, "utf8");

  assert.match(source, /rel="icon"/);
});
