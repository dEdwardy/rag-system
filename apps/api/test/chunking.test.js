const assert = require("node:assert/strict");
const { ChunkingService } = require("../src/infra/parsing/chunking.service.ts");

test("ChunkingService splits oversized paragraphs and preserves section titles", () => {
  const service = new ChunkingService();
  const content = `# Title

## Overview

This paragraph is intentionally long to verify that the ingestion pipeline can split oversized content into multiple chunks while preserving the current section title across resulting chunks. The content should not remain as a single oversized block because that harms retrieval quality and increases prompt noise. We want sentence-aware splitting first, line-aware splitting second, and hard length splitting only as a final fallback. This test repeats the same theme with slightly varied wording so that the parser has enough material to cross the chunk target and the chunk hard limit without becoming a malformed document. The chunker should keep paragraphs coherent, avoid empty fragments, and make resulting pieces easier for vector retrieval and answer citation. This paragraph is intentionally long to verify that the ingestion pipeline can split oversized content into multiple chunks while preserving the current section title across resulting chunks. The content should not remain as a single oversized block because that harms retrieval quality and increases prompt noise.

## Details

Second section content should become another chunk group and keep its own heading.`;

  const chunks = service.buildChunks(content);

  assert.ok(chunks.length >= 4);
  const overviewChunks = chunks.filter(chunk => chunk.sectionTitle === "Overview");
  assert.ok(overviewChunks.length >= 2);
  assert.ok(overviewChunks.every(chunk => chunk.content.length <= 1200));
  assert.equal(chunks.at(-1).sectionTitle, "Details");
  assert.deepEqual(overviewChunks[0].headingPath, ["Title", "Overview"]);
  assert.equal(overviewChunks[0].blockType, "paragraph");
  assert.equal(overviewChunks[0].isTableLike, false);
});

test("ChunkingService preserves block metadata for lists tables and faq blocks", () => {
  const service = new ChunkingService();
  const content = `# Guide

## Checklist

1. First item
2. Second item

## Table

| Name | Value |
| ---- | ----- |
| A    | B     |

## FAQ

Q: What is this?
A: A test block.`;

  const chunks = service.buildChunks(content);

  assert.equal(chunks.find(chunk => chunk.sectionTitle === "Checklist")?.blockType, "list");
  assert.equal(chunks.find(chunk => chunk.sectionTitle === "Checklist")?.listOrdinal, 1);
  assert.equal(chunks.find(chunk => chunk.sectionTitle === "Table")?.isTableLike, true);
  assert.equal(chunks.find(chunk => chunk.sectionTitle === "Table")?.blockType, "table");
  assert.equal(chunks.find(chunk => chunk.sectionTitle === "FAQ")?.blockType, "faq");
});
