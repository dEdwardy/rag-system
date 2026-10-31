import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  assertSafeSourceUrl,
  isBlockedSourceAddress
} from '../src/infra/http/source-url-safety.ts';

test('isBlockedSourceAddress blocks loopback, private, link-local, and metadata ranges', () => {
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '::1',
    'fe80::1',
    'fd00::1'
  ]) {
    assert.equal(isBlockedSourceAddress(address), true, address);
  }

  assert.equal(isBlockedSourceAddress('93.184.216.34'), false);
});

test('assertSafeSourceUrl rejects private literals and hostnames without DNS', async () => {
  await assert.rejects(
    () => assertSafeSourceUrl('http://127.0.0.1/admin'),
    /blocked address/
  );
  await assert.rejects(
    () => assertSafeSourceUrl('http://169.254.169.254/latest/meta-data'),
    /blocked address/
  );
  await assert.rejects(
    () => assertSafeSourceUrl('http://localhost/admin'),
    /host is not allowed/
  );
  await assert.rejects(
    () => assertSafeSourceUrl('file:///etc/passwd'),
    /must use http or https/
  );
});

test('assertSafeSourceUrl checks every resolved address', async () => {
  await assert.rejects(
    () =>
      assertSafeSourceUrl('https://public.example/source', {
        lookup: async () => [
          { address: '93.184.216.34', family: 4 },
          { address: '10.0.0.7', family: 4 }
        ]
      }),
    /blocked address/
  );

  await assert.doesNotReject(() =>
    assertSafeSourceUrl('https://public.example/source', {
      lookup: async () => [{ address: '93.184.216.34', family: 4 }]
    })
  );
});

test('assertSafeSourceUrl enforces SOURCE_FETCH_ALLOWED_HOSTS when configured', async () => {
  process.env.SOURCE_FETCH_ALLOWED_HOSTS = 'example.com,cdn.example.com';

  try {
    await assert.rejects(
      () => assertSafeSourceUrl('https://evil.example/source'),
      /outside SOURCE_FETCH_ALLOWED_HOSTS/
    );
    await assert.doesNotReject(() =>
      assertSafeSourceUrl('https://cdn.example.com/source', {
        lookup: async () => [{ address: '93.184.216.34', family: 4 }]
      })
    );
  } finally {
    delete process.env.SOURCE_FETCH_ALLOWED_HOSTS;
  }
});
