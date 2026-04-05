const assert = require("node:assert/strict");
const { test } = require("node:test");

test("vitest defaults keep fast feedback strict and side-effect free", async () => {
  const { default: config } = await import("../vitest.config.mjs");

  assert.equal(config.test.retry, undefined);
  assert.deepEqual(config.test.reporters, ["default"]);
  assert.equal(config.test.outputFile, undefined);
});

test("vitest enables junit output only when explicitly requested", async () => {
  process.env.VITEST_JUNIT_OUTPUT = "./test-results/custom-junit.xml";
  const configUrl = new URL("../vitest.config.mjs", `file://${__filename}`).href;
  const { default: config } = await import(`${configUrl}?junit=${Date.now()}`);

  assert.deepEqual(config.test.reporters, ["default", "junit"]);
  assert.deepEqual(config.test.outputFile, {
    junit: "./test-results/custom-junit.xml"
  });

  delete process.env.VITEST_JUNIT_OUTPUT;
});
