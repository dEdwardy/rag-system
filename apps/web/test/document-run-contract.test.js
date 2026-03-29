const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");

test("web document run types include backend failureSummary fields for list and summary responses", async () => {
  const source = await readFile(resolve(__dirname, "../src/types/api.ts"), "utf8");

  assert.match(source, /export type KnowledgeBaseDocumentRunRecord = \{[\s\S]*failureSummary\?: \{/);
  assert.match(source, /export type DocumentRunRecord = \{[\s\S]*failureSummary\?: \{/);
  assert.match(source, /export type KnowledgeBaseDocumentRunSummaryAnchor = \{[\s\S]*failureSummary: KnowledgeBaseDocumentRunFailureSummary \| null;/);
  assert.match(source, /latestRetryableFailure: KnowledgeBaseDocumentRunSummaryAnchor \| null;/);
  assert.match(source, /latestSkipped: KnowledgeBaseDocumentRunSummaryAnchor \| null;/);
  assert.match(source, /latestFailure: KnowledgeBaseDocumentRunSummaryAnchor \| null;/);
});

test("web snapshot comparison type keeps additive sourceFamilyDeltas and issueHotspotSlice fields", async () => {
  const source = await readFile(resolve(__dirname, "../src/types/api.ts"), "utf8");

  assert.match(
    source,
    /mode: "snapshot";[\s\S]*sourceFamilyDeltas\?: KnowledgeBaseDocumentRunComparisonSourceFamilyDelta\[];/
  );
  assert.match(
    source,
    /mode: "snapshot";[\s\S]*issueHotspotSlice\?: KnowledgeBaseDocumentRunIssueHotspotSlice;/
  );
  assert.match(
    source,
    /export type KnowledgeBaseDocumentRunIssueHotspotSlice = \{[\s\S]*leftHotspot: KnowledgeBaseDocumentRunIssueHotspot \| null;/
  );
  assert.match(
    source,
    /export type KnowledgeBaseDocumentRunIssueHotspotSlice = \{[\s\S]*rightHotspot: KnowledgeBaseDocumentRunIssueHotspot \| null;/
  );
  assert.match(
    source,
    /export type KnowledgeBaseDocumentRunIssueHotspotSlice = \{[\s\S]*dominantShift: KnowledgeBaseDocumentRunIssueHotspotShift \| null;/
  );
});
