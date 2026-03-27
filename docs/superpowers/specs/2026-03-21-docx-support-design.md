# DOCX Support Design

## Goal

Add backend DOCX ingestion support so uploaded `.docx` files can flow through parsing, chunking, indexing, retrieval, and ask using the existing RAG pipeline.

## Scope

- Backend/API only
- Support `.docx` text extraction for normal Word documents
- Reuse existing upload, ingestion, chunking, indexing, retrieval, and answering flow
- Add targeted parsing and ingestion test coverage
- Update current progress/setup docs to reflect the new supported format

## Non-Goals

- No frontend-specific DOCX UI work
- No `.doc` legacy binary format support
- No structured preservation of tables, images, headers, footers, or rich styles
- No broader parser plugin architecture refactor

## Current State

The current backend supports Markdown, TXT, and text-based PDF parsing in [`apps/api/src/infra/parsing/parsing.service.ts`](../../../apps/api/src/infra/parsing/parsing.service.ts). Uploaded files are persisted, then the ingestion worker parses content, builds chunks, indexes them, and marks the document ready in [`apps/api/src/modules/ingestion/ingestion.service.ts`](../../../apps/api/src/modules/ingestion/ingestion.service.ts).

There is no existing DOCX-specific spec or plan in `docs/superpowers/specs/` or `docs/superpowers/plans/`.

## Design

### Parsing approach

Use a lightweight DOCX-to-text library inside the existing `ParsingService`. The service will detect DOCX by extension or MIME type and extract raw text, then normalize line endings and excess blank lines similarly to PDF parsing.

This keeps file-type routing in one place and avoids changing ingestion, chunking, or indexing contracts.

### Detection rules

Treat a file as DOCX when either of these matches:

- extension is `.docx`
- MIME type is `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

This matches normal browser upload behavior while staying resilient to extension/MIME mismatches.

### Output contract

DOCX parsing returns plain UTF-8 text content as a string. If extracted content is empty after normalization, parsing should fail and let the ingestion worker record the document as failed, consistent with current behavior for empty parsed content.

### Testing

Add test coverage in two layers:

- parsing test: a real DOCX fixture is parsed into expected text
- ingestion orchestrator test: a DOCX document goes through parse -> chunk -> index -> ready using the existing orchestration contract

This is enough to prove backend support without expanding into new end-to-end scope.

## Files Expected To Change

- Modify: [`apps/api/package.json`](../../../apps/api/package.json)
- Modify: [`apps/api/src/infra/parsing/parsing.service.ts`](../../../apps/api/src/infra/parsing/parsing.service.ts)
- Modify: [`apps/api/test/parsing.test.js`](../../../apps/api/test/parsing.test.js)
- Modify: [`apps/api/test/ingestion.orchestrator.test.js`](../../../apps/api/test/ingestion.orchestrator.test.js)
- Modify: [`README.md`](../../../README.md)
- Modify: [`docs/current-dev-setup.md`](../../current-dev-setup.md)
- Modify: [`docs/current-progress.md`](../../current-progress.md)
- Modify: test helper logic inside `apps/api/test/parsing.test.js` to generate a deterministic DOCX buffer

## Risks

- DOCX extraction quality varies with document complexity; first version is intentionally plain-text oriented.
- Upload MIME types can vary between clients, so extension and MIME detection must both be supported.
- Tests need a deterministic DOCX sample so parsing behavior is reproducible.

## Acceptance Criteria

- Uploading a `.docx` document no longer fails due to unsupported type
- `ParsingService` extracts non-empty plain text from a deterministic DOCX sample
- Existing ingestion pipeline can process a DOCX document to `ready`
- Docs list DOCX alongside current supported ingestion formats
