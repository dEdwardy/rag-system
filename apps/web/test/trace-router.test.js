import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

test("router registers traces list and detail routes", async () => {
  const routerSource = await readFile(resolve(__dirname, "../src/app/router.tsx"), "utf8");

  assert.match(routerSource, /path:\s*"traces"/);
  assert.match(routerSource, /path:\s*"traces\/:traceId"/);
  assert.match(routerSource, /path:\s*"usage"/);
  assert.match(routerSource, /path:\s*"reports"/);
  assert.doesNotMatch(routerSource, /path:\s*"knowledge-base"[\s\S]*path:\s*"knowledge-base"/);
});
