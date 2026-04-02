const test = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

const helperModuleUrl = pathToFileURL(
  resolve(__dirname, "../src/pages/reports/report-center-page-helpers.ts")
).href;

async function loadReportCenterHelpers() {
  return import(helperModuleUrl);
}

test("report center helpers normalize eval params and trim whitespace", async () => {
  const { normalizeEvalRunParams } = await loadReportCenterHelpers();

  const params = normalizeEvalRunParams({
    questionSetId: "  set-1  ",
    assistantId: "  assistant-1 ",
    baselineSnapshotId: "  snapshot-1 "
  });

  assert.deepEqual(params, {
    questionSetId: "set-1",
    assistantId: "assistant-1",
    baselineSnapshotId: "snapshot-1"
  });
});

test("report center helpers reject incomplete eval params", async () => {
  const { normalizeEvalRunParams } = await loadReportCenterHelpers();

  const params = normalizeEvalRunParams({
    questionSetId: "  ",
    assistantId: "assistant-1",
    baselineSnapshotId: ""
  });

  assert.equal(params, null);
});

test("report center helpers round-trip eval params through URLSearchParams", async () => {
  const {
    createEvalRunSearchParams,
    readEvalRunParamsFromSearchParams
  } = await loadReportCenterHelpers();

  const searchParams = createEvalRunSearchParams({
    questionSetId: "set-1",
    assistantId: "assistant-1",
    baselineSnapshotId: "snapshot-1"
  });

  assert.equal(searchParams.toString(), "questionSetId=set-1&assistantId=assistant-1&baselineSnapshotId=snapshot-1");
  assert.deepEqual(readEvalRunParamsFromSearchParams(searchParams), {
    questionSetId: "set-1",
    assistantId: "assistant-1",
    baselineSnapshotId: "snapshot-1"
  });
});

test("report center helpers merge eval params into existing search params", async () => {
  const { mergeSearchParamsWithEvalRunParams } = await loadReportCenterHelpers();

  const current = new URLSearchParams("other=value&questionSetId=old");
  const merged = mergeSearchParamsWithEvalRunParams(current, {
    questionSetId: "new-set",
    assistantId: "new-assistant"
  });

  assert.equal(merged.toString(), "other=value&questionSetId=new-set&assistantId=new-assistant");
});

test("report center helpers clear eval params when null evalRunParams", async () => {
  const { mergeSearchParamsWithEvalRunParams } = await loadReportCenterHelpers();

  const current = new URLSearchParams("questionSetId=old&assistantId=old&baselineSnapshotId=old");
  const merged = mergeSearchParamsWithEvalRunParams(current, null);

  assert.equal(merged.toString(), "");
});
