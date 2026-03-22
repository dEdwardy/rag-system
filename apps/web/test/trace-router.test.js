const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");

test("router registers traces list and detail routes", async () => {
  const routerSource = await readFile(resolve(__dirname, "../src/app/router.tsx"), "utf8");

  assert.match(routerSource, /path:\s*"traces"/);
  assert.match(routerSource, /path:\s*"traces\/:traceId"/);
  assert.match(routerSource, /path:\s*"usage"/);
  assert.doesNotMatch(routerSource, /path:\s*"knowledge-base"[\s\S]*path:\s*"knowledge-base"/);
});
