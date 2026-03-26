const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");

test("web trace summary type covers current backend query-source and failure-stage variants", async () => {
  const source = await readFile(resolve(__dirname, "../src/types/api.ts"), "utf8");
  const sharedSource = await readFile(resolve(__dirname, "../../../packages/shared/src/trace-contracts.ts"), "utf8");

  assert.match(source, /from\s+"@rag-system\/shared"/);
  assert.match(source, /traceSummary:\s*TraceSummary;/);
  assert.match(sharedSource, /export type TraceRetrievalQuerySource = "rewritten" \| "original_disabled" \| "original_unchanged";/);
  assert.match(sharedSource, /export type TraceFailedStage = "retrieval" \| "answering";/);
  assert.match(sharedSource, /promptId:\s*string \| null;/);
  assert.match(sharedSource, /missingInformationSource:\s*TraceMissingInformationSource \| null;/);
  assert.match(sharedSource, /candidateLimit:\s*number;/);
  assert.match(sharedSource, /vectorCandidateCount:\s*number;/);
  assert.match(sharedSource, /lexicalCandidateCount:\s*number;/);
  assert.match(sharedSource, /mergedCandidateCount:\s*number;/);
  assert.match(sharedSource, /rankedCandidateCount:\s*number;/);
  assert.match(sharedSource, /vectorCandidateLimitHit:\s*boolean;/);
  assert.match(sharedSource, /lexicalCandidateLimitHit:\s*boolean;/);
  assert.match(sharedSource, /rankingTopKHit:\s*boolean;/);
  assert.match(sharedSource, /primaryChunkCount:\s*number;/);
  assert.match(sharedSource, /neighborChunkCount:\s*number;/);
  assert.match(sharedSource, /inputChunkCount:\s*number;/);
  assert.match(sharedSource, /promptContextCount:\s*number;/);
  assert.match(sharedSource, /contextGroupCount:\s*number;/);
  assert.match(sharedSource, /citationCountBeforeLimit:\s*number;/);
  assert.match(sharedSource, /citationLimitHit:\s*boolean;/);
});
