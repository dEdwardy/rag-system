import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

test("web ask response type covers the full backend contextGroups shape", async () => {
  const source = await readFile(resolve(__dirname, "../src/types/api.ts"), "utf8");

  assert.match(source, /contextGroups\?: ContextGroup\[\];/);
  assert.match(source, /export type ContextGroup = \{[\s\S]*documentId: string;/);
  assert.match(source, /export type ContextGroup = \{[\s\S]*documentTitle: string;/);
  assert.match(source, /export type ContextGroup = \{[\s\S]*startChunkIndex: number;/);
  assert.match(source, /export type ContextGroup = \{[\s\S]*endChunkIndex: number;/);
  assert.match(source, /export type ContextGroup = \{[\s\S]*chunkIds: string\[\];/);
  assert.match(source, /export type ContextGroup = \{[\s\S]*primaryChunkIds: string\[\];/);
  assert.match(source, /export type ContextGroup = \{[\s\S]*mergedContent: string;/);
  assert.match(source, /export type ContextGroup = \{[\s\S]*pageNumbers: number\[\];/);
  assert.match(source, /export type ContextGroup = \{[\s\S]*sectionTitles: string\[\];/);
});
