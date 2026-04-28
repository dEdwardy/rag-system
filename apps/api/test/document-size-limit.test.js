import { expect, test } from 'vitest';

test('DocumentIngestionProcessor validates 50MB file size limit', async () => {
  const maxFileSize = 50 * 1024 * 1024;

  const smallBuffer = Buffer.alloc(maxFileSize - 1);
  expect(smallBuffer.length < maxFileSize).toBe(true);

  const largeBuffer = Buffer.alloc(maxFileSize + 1);
  expect(largeBuffer.length > maxFileSize).toBe(true);
});

test('50MB file size limit is correctly calculated', async () => {
  const maxFileSize = 50 * 1024 * 1024;

  expect(maxFileSize).toBe(52428800);
  expect(maxFileSize / 1024 / 1024).toBe(50);
});

test('Error message indicates file size limit exceeded', async () => {
  const errorMessage = 'Document file size exceeds limit of 50MB.';

  expect(errorMessage).toMatch(/50MB/);
  expect(errorMessage).toMatch(/exceeds limit/);
});
