import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

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
  assert.match(
    source,
    /export type KnowledgeBaseDocumentRunIssueHotspot = \{[\s\S]*sourceFamily: string;[\s\S]*totalRuns: number;[\s\S]*issueSignalScore: number;[\s\S]*issueConcentration: number;/
  );
  assert.match(
    source,
    /export type KnowledgeBaseDocumentRunIssueHotspotShift = \{[\s\S]*sourceFamily: string;[\s\S]*leftIssueSignalScore: number;[\s\S]*rightIssueSignalScore: number;[\s\S]*issueSignalDelta: number;[\s\S]*leftIssueConcentration: number;[\s\S]*rightIssueConcentration: number;[\s\S]*issueConcentrationDelta: number;/
  );
});

test("document detail failure summary copy keeps one-line summary plus trace follow-up contract", async () => {
  const englishSource = await readFile(resolve(__dirname, "../src/i18n/messages.en.ts"), "utf8");
  const chineseSource = await readFile(resolve(__dirname, "../src/i18n/messages.zh.ts"), "utf8");

  assert.match(englishSource, /primaryStatusSummaryFailed:[\s\S]*What happened: \{runSummary\}/);
  assert.match(englishSource, /primaryStatusNextActionFailed:[\s\S]*one-line run failure summary[\s\S]*diagnostics/);
  assert.match(chineseSource, /primaryStatusSummaryFailed:/);
  assert.match(chineseSource, /primaryStatusNextActionFailed:/);
  assert.match(chineseSource, /workspaceNextActionNeedsAttention:/);
});
