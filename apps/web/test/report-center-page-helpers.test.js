import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

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

test("report center helpers build URL carry-through preview from pre-run inputs", async () => {
  const { buildEvalRunCarryThroughPreview } = await loadReportCenterHelpers();

  const preview = buildEvalRunCarryThroughPreview({
    questionSetId: "  set-1  ",
    assistantId: "  assistant-1 ",
    baselineSnapshotId: "  snapshot-1 "
  });

  assert.deepEqual(preview.normalizedParams, {
    questionSetId: "set-1",
    assistantId: "assistant-1",
    baselineSnapshotId: "snapshot-1"
  });
  assert.equal(preview.searchParams?.toString(), "questionSetId=set-1&assistantId=assistant-1&baselineSnapshotId=snapshot-1");
});

test("report center helpers map regression reason codes to readable labels", async () => {
  const { getRegressionReasonLabel } = await loadReportCenterHelpers();

  assert.equal(getRegressionReasonLabel("became_failed", "en"), "Answer changed from success to failure");
  assert.equal(
    getRegressionReasonLabel("became_insufficient_context", "en"),
    "Answer lost grounding (insufficient context)"
  );
  assert.equal(getRegressionReasonLabel("quality_degraded", "en"), "Answer quality rating dropped");
  assert.equal(getRegressionReasonLabel("fallback_introduced", "en"), "Answer now depends on fallback");
  assert.equal(getRegressionReasonLabel("citations_decreased", "en"), "Answer citation count dropped");
  assert.equal(getRegressionReasonLabel("unknown_reason", "en"), "unknown_reason");
});

test("report center helpers provide explicit regression follow-up path", async () => {
  const { getReportCenterResultNextAction } = await loadReportCenterHelpers();

  assert.equal(
    getReportCenterResultNextAction({
      locale: "en",
      hasRunDiffSummary: true,
      hasWeakestItems: true,
      hasRunItems: true
    }),
    "Next action: review Run diff summary first, then replay Regression weakest items in order."
  );

  assert.equal(
    getReportCenterResultNextAction({
      locale: "en",
      hasRunDiffSummary: false,
      hasWeakestItems: true,
      hasRunItems: true
    }),
    "Next action: baseline diff is unavailable; replay Regression weakest items first, then inspect the item table."
  );

  assert.equal(
    getReportCenterResultNextAction({
      locale: "zh",
      hasRunDiffSummary: true,
      hasWeakestItems: true,
      hasRunItems: true
    }),
    "下一步：先看 Run 差异摘要，再按回归弱项顺序复盘题目。"
  );
});
