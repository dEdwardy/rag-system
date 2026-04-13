import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const modulePath = resolve(__dirname, '../src/lib/login-redirect-notice.ts');

async function loadFreshModule() {
  return import(
    `${pathToFileURL(modulePath).href}?t=${Date.now()}-${Math.random()}`
  );
}

function createStorage() {
  const data = new Map();

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    }
  };
}

test('login redirect notice is consumed once', async () => {
  const { consumeLoginRedirectNotice, storeLoginRedirectNotice } =
    await loadFreshModule();
  const storage = createStorage();

  storeLoginRedirectNotice(storage, 'expired');

  assert.equal(consumeLoginRedirectNotice(storage), 'expired');
  assert.equal(consumeLoginRedirectNotice(storage), null);
});

test('login redirect notice ignores unknown values and clears them', async () => {
  const { LOGIN_REDIRECT_NOTICE_STORAGE_KEY, consumeLoginRedirectNotice } =
    await loadFreshModule();
  const storage = createStorage();

  storage.setItem(LOGIN_REDIRECT_NOTICE_STORAGE_KEY, 'unexpected');

  assert.equal(consumeLoginRedirectNotice(storage), null);
  assert.equal(storage.getItem(LOGIN_REDIRECT_NOTICE_STORAGE_KEY), null);
});

test('login redirect notice can be read without consuming it', async () => {
  const {
    readLoginRedirectNotice,
    storeLoginRedirectNotice,
    consumeLoginRedirectNotice
  } = await loadFreshModule();
  const storage = createStorage();

  storeLoginRedirectNotice(storage, 'missing');

  assert.equal(readLoginRedirectNotice(storage), 'missing');
  assert.equal(consumeLoginRedirectNotice(storage), 'missing');
});
