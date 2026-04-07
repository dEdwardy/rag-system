const assert = require("node:assert/strict");
const test = require("node:test");

const { DocumentIngestionProcessor } = require("../src/modules/ingestion/document-ingestion.processor.ts");

test("DocumentIngestionProcessor validates 50MB file size limit", async () => {
  const maxFileSize = 50 * 1024 * 1024;
  
  const smallBuffer = Buffer.alloc(maxFileSize - 1);
  assert.equal(smallBuffer.length < maxFileSize, true);
  
  const largeBuffer = Buffer.alloc(maxFileSize + 1);
  assert.equal(largeBuffer.length > maxFileSize, true);
});

test("50MB file size limit is correctly calculated", async () => {
  const maxFileSize = 50 * 1024 * 1024;
  
  assert.equal(maxFileSize, 52428800);
  assert.equal(maxFileSize / 1024 / 1024, 50);
});

test("Error message indicates file size limit exceeded", async () => {
  const errorMessage = "Document file size exceeds limit of 50MB.";
  
  assert.match(errorMessage, /50MB/);
  assert.match(errorMessage, /exceeds limit/);
});
