const test = require("node:test");
const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { resolve } = require("node:path");

test("web ask response type covers the full backend contextGroups shape", async () => {
  const source = await readFile(resolve(__dirname, "../src/types/api.ts"), "utf8");

  assert.match(source, /contextGroups\?: Array<\{[\s\S]*documentId: string;/);
  assert.match(source, /contextGroups\?: Array<\{[\s\S]*documentTitle: string;/);
  assert.match(source, /contextGroups\?: Array<\{[\s\S]*startChunkIndex: number;/);
  assert.match(source, /contextGroups\?: Array<\{[\s\S]*endChunkIndex: number;/);
  assert.match(source, /contextGroups\?: Array<\{[\s\S]*chunkIds: string\[\];/);
  assert.match(source, /contextGroups\?: Array<\{[\s\S]*primaryChunkIds: string\[\];/);
  assert.match(source, /contextGroups\?: Array<\{[\s\S]*mergedContent: string;/);
  assert.match(source, /contextGroups\?: Array<\{[\s\S]*pageNumbers: number\[\];/);
  assert.match(source, /contextGroups\?: Array<\{[\s\S]*sectionTitles: string\[\];/);
});
