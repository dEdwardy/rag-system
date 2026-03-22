import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJsonPath = new URL("../package.json", import.meta.url);
const viteConfigPath = new URL("../vite.config.ts", import.meta.url);
const mainPath = new URL("../src/main.tsx", import.meta.url);
const appShellPath = new URL("../src/app/AppShell.tsx", import.meta.url);
const chatPagePath = new URL("../src/pages/chat/ChatPage.tsx", import.meta.url);
const globalCssPath = new URL("../src/styles/global.css", import.meta.url);

test("web package adopts tailwind dependencies for UI styling", async () => {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

  assert.ok(packageJson.dependencies?.tailwindcss || packageJson.devDependencies?.tailwindcss);
  assert.ok(packageJson.dependencies?.["@tailwindcss/vite"] || packageJson.devDependencies?.["@tailwindcss/vite"]);
});

test("vite and main entry wire tailwind global styles", async () => {
  const viteConfig = await readFile(viteConfigPath, "utf8");
  const mainSource = await readFile(mainPath, "utf8");
  const globalCss = await readFile(globalCssPath, "utf8");

  assert.match(viteConfig, /@tailwindcss\/vite/);
  assert.match(mainSource, /import "\.\/styles\/global\.css";/);
  assert.match(globalCss, /@import "tailwindcss";|@tailwind base;/);
});

test("app shell exposes the fixed creative-dark frame via tailwind utility classes", async () => {
  const shellSource = await readFile(appShellPath, "utf8");

  assert.match(shellSource, /w-\[280px\]/);
  assert.match(shellSource, /h-screen/);
  assert.match(shellSource, /sticky top-0/);
  assert.match(shellSource, /backdrop-blur-xl/);
});

test("chat page keeps the target two-pane chat area and right workspace panel", async () => {
  const chatSource = await readFile(chatPagePath, "utf8");

  assert.match(chatSource, /grid-cols-\[minmax\(0,1fr\)_340px\]/);
  assert.match(chatSource, /placeholder=.*Enter/);
  assert.match(chatSource, /new chat|新会话/i);
  assert.match(chatSource, /latest citations|当前引用/i);
});
