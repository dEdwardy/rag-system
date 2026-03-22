import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const chatPagePath = new URL("../src/pages/chat/ChatPage.tsx", import.meta.url);
const appShellPath = new URL("../src/app/AppShell.tsx", import.meta.url);
const globalCssPath = new URL("../src/styles/global.css", import.meta.url);

test("chat page keeps the reference three-column workspace proportions", async () => {
  const source = await readFile(chatPagePath, "utf8");

  assert.match(source, /xl:grid-cols-\[minmax\(0,1fr\)_340px\]/);
  assert.match(source, /"当前引用" : "Current citations"/);
  assert.match(source, /"新会话" : "New chat"/);
  assert.match(source, /ref=\{transcriptRef\}/);
  assert.match(source, /min-h-0 flex-1 overflow-y-auto/);
  assert.match(source, /border-t border-\[var\(--app-border\)\]/);
});

test("app shell keeps the reference navbar and header dimensions", async () => {
  const shellSource = await readFile(appShellPath, "utf8");
  const cssSource = await readFile(globalCssPath, "utf8");

  assert.match(shellSource, /w-\[280px\]/);
  assert.match(shellSource, /h-\[70px\]/);
  assert.match(cssSource, /--app-shell-navbar-width: 280px;/);
  assert.match(cssSource, /--app-shell-header-height: 70px;/);
});
