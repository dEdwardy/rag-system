const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");

test("web ask response type covers current backend retrievalMetadata execution shape", async () => {
  const source = await readFile(resolve(__dirname, "../src/types/api.ts"), "utf8");

  assert.match(source, /retrievalMetadata\?:\s*AskRetrievalMetadata;/);
  assert.match(source, /queryRewrite:\s*\{[\s\S]*enabled: boolean;/);
  assert.match(source, /queryRewrite:\s*\{[\s\S]*applied: boolean;/);
  assert.match(source, /queryRewrite:\s*\{[\s\S]*finalQuerySource: "rewritten" \| "original_disabled" \| "original_unchanged";/);
  assert.match(source, /queryRewrite:\s*\{[\s\S]*usedFallback: boolean \| null;/);
  assert.match(source, /queryRewrite:\s*\{[\s\S]*promptId: string \| null;/);
  assert.match(source, /execution:\s*\{[\s\S]*retrievalQuery: string;/);
  assert.match(source, /execution:\s*\{[\s\S]*topK: number;/);
  assert.match(source, /execution:\s*\{[\s\S]*scoreThreshold: number;/);
  assert.match(source, /execution:\s*\{[\s\S]*chunkWindow: number;/);
  assert.match(source, /execution:\s*\{[\s\S]*actualMode: "vector" \| "hybrid" \| "lexical";/);
  assert.match(source, /execution:\s*\{[\s\S]*usedFallback: boolean;/);
  assert.match(source, /execution:\s*\{[\s\S]*fallbackReason: "vector_error" \| "no_ranked_candidates" \| null;/);
  assert.match(source, /execution:\s*\{[\s\S]*rerankApplied: boolean;/);
  assert.match(source, /execution:\s*\{[\s\S]*chunkWindowApplied: boolean;/);
  assert.match(source, /execution:\s*\{[\s\S]*vectorSearchAttempted: boolean;/);
  assert.match(source, /execution:\s*\{[\s\S]*lexicalSearchAttempted: boolean;/);
  assert.match(source, /execution:\s*\{[\s\S]*vectorCandidateLimitHit: boolean;/);
  assert.match(source, /execution:\s*\{[\s\S]*lexicalCandidateLimitHit: boolean;/);
  assert.match(source, /execution:\s*\{[\s\S]*rankingTopKHit: boolean;/);
  assert.match(source, /execution:\s*\{[\s\S]*candidateLimit: number;/);
  assert.match(source, /execution:\s*\{[\s\S]*vectorCandidateCount: number;/);
  assert.match(source, /execution:\s*\{[\s\S]*lexicalCandidateCount: number;/);
  assert.match(source, /execution:\s*\{[\s\S]*mergedCandidateCount: number;/);
  assert.match(source, /execution:\s*\{[\s\S]*rankedCandidateCount: number;/);
  assert.match(source, /execution:\s*\{[\s\S]*retrievedChunkCount: number;/);
  assert.match(source, /execution:\s*\{[\s\S]*contextGroupCount: number;/);
  assert.match(source, /execution:\s*\{[\s\S]*primaryChunkCount: number;/);
  assert.match(source, /execution:\s*\{[\s\S]*neighborChunkCount: number;/);
});
