# Long Chunk Test

## Overview

This paragraph is intentionally long to verify that the ingestion pipeline can split oversized content into multiple chunks while preserving the current section title across resulting chunks. The content should not remain as a single oversized block because that harms retrieval quality and increases prompt noise. We want sentence-aware splitting first, line-aware splitting second, and hard length splitting only as a final fallback. This test repeats the same theme with slightly varied wording so that the parser has enough material to cross the chunk target and the chunk hard limit without becoming a malformed document. The chunker should keep paragraphs coherent, avoid empty fragments, and make resulting pieces easier for vector retrieval and answer citation. This paragraph is intentionally long to verify that the ingestion pipeline can split oversized content into multiple chunks while preserving the current section title across resulting chunks. The content should not remain as a single oversized block because that harms retrieval quality and increases prompt noise. We want sentence-aware splitting first, line-aware splitting second, and hard length splitting only as a final fallback. This test repeats the same theme with slightly varied wording so that the parser has enough material to cross the chunk target and the chunk hard limit without becoming a malformed document. The chunker should keep paragraphs coherent, avoid empty fragments, and make resulting pieces easier for vector retrieval and answer citation.

## Details

Second section content should become another chunk group and keep its own heading.
