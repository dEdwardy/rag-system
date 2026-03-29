const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");

const appShellPath = resolve(__dirname, "../src/app/AppShell.tsx");
const routerPath = resolve(__dirname, "../src/app/router.tsx");
const usagePagePath = resolve(__dirname, "../src/pages/usage/UsagePage.tsx");
const reportCenterPagePath = resolve(__dirname, "../src/pages/reports/ReportCenterPage.tsx");
const pagePaths = [
  resolve(__dirname, "../src/pages/documents/DocumentsPage.tsx"),
  resolve(__dirname, "../src/pages/documents/DocumentDetailPage.tsx"),
  resolve(__dirname, "../src/pages/knowledge-base/KnowledgeBasePage.tsx"),
  resolve(__dirname, "../src/pages/assistant/AssistantPage.tsx"),
  resolve(__dirname, "../src/pages/traces/TraceListPage.tsx"),
  resolve(__dirname, "../src/pages/traces/TraceDetailPage.tsx")
];

test("app shell keeps dedicated usage/report routes with no hard-coded nav badge counts", async () => {
  const shellSource = await readFile(appShellPath, "utf8");
  const routerSource = await readFile(routerPath, "utf8");

  assert.match(shellSource, /to:\s*"\/usage"/);
  assert.match(shellSource, /to:\s*"\/reports"/);
  assert.doesNotMatch(shellSource, /badge:\s*"3"/);
  assert.doesNotMatch(shellSource, /badge:\s*"12"/);
  assert.doesNotMatch(shellSource, /Claude 3 Opus|Gemini Pro|Llama 3 70B/);
  assert.match(routerSource, /path:\s*"usage"/);
  assert.match(routerSource, /path:\s*"reports"/);
});

test("usage page exists as a dedicated desktop page", async () => {
  const source = await readFile(usagePagePath, "utf8");

  assert.match(source, /export function UsagePage/);
  assert.match(source, /workspace-hero|rounded-\[28px\]|workspace-panel/);
});

test("report center page exists as a dedicated p5 v1 page", async () => {
  const source = await readFile(reportCenterPagePath, "utf8");

  assert.match(source, /export function ReportCenterPage/);
  assert.match(source, /quality summaries|质量汇总|质量分布/);
});

test("desktop data pages share the same hero and panel language", async () => {
  for (const pagePath of pagePaths) {
    const source = await readFile(pagePath, "utf8");
    assert.match(source, /workspace-hero|className="rounded-\[28px\]/, pagePath);
    assert.match(source, /workspace-panel-hover|rounded-\[28px\]|workspace-section-heading/, pagePath);
  }
});
