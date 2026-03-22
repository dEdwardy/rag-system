import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const statePanelPath = new URL("../src/components/StatePanel.tsx", import.meta.url);

test("empty state panel uses workspace dark surface styles", async () => {
  const source = await readFile(statePanelPath, "utf8");

  assert.match(source, /rounded-\[28px\]/);
  assert.match(source, /bg-\[linear-gradient\(180deg,rgba\(30,30,38,0.98\)_0%,rgba\(24,24,31,0.98\)_100%\)\]/);
});

test("loading state panel uses workspace muted text colors", async () => {
  const source = await readFile(statePanelPath, "utf8");

  assert.match(source, /text-\[var\(--app-text-muted\)\]/);
});
