import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

test("web ask response type covers current backend qualityEvaluation shape", async () => {
  const source = await readFile(resolve(__dirname, "../src/types/api.ts"), "utf8");

  assert.match(source, /qualityEvaluation\?:\s*AskQualityEvaluation;/);
  assert.match(source, /export type AskQualityEvaluation = \{[\s\S]*overall: TraceQualityOverall;/);
  assert.match(source, /export type AskQualityEvaluation = \{[\s\S]*grounding: "grounded" \| "partially_grounded" \| "ungrounded";/);
  assert.match(source, /export type AskQualityEvaluation = \{[\s\S]*completeness: "complete" \| "partial" \| "insufficient";/);
  assert.match(source, /export type AskQualityEvaluation = \{[\s\S]*primaryIssue: TracePrimaryIssue;/);
  assert.match(source, /export type AskQualityEvaluation = \{[\s\S]*flags: string\[\];/);
  assert.match(source, /export type AskQualityEvaluation = \{[\s\S]*summary: string;/);
  assert.match(source, /answerStatus\?: TraceAnswerStatus;/);
});
