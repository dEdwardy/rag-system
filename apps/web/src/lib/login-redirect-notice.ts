export const LOGIN_REDIRECT_NOTICE_STORAGE_KEY = 'rag-login-redirect-notice';

export type LoginRedirectNotice = 'expired' | 'missing';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function storeLoginRedirectNotice(
  storage: StorageLike,
  notice: LoginRedirectNotice
) {
  storage.setItem(LOGIN_REDIRECT_NOTICE_STORAGE_KEY, notice);
}

export function readLoginRedirectNotice(
  storage: StorageLike
): LoginRedirectNotice | null {
  const raw = storage.getItem(LOGIN_REDIRECT_NOTICE_STORAGE_KEY);
  return raw === 'expired' || raw === 'missing' ? raw : null;
}

export function consumeLoginRedirectNotice(
  storage: StorageLike
): LoginRedirectNotice | null {
  const raw = readLoginRedirectNotice(storage);
  if (raw == null) {
    storage.removeItem(LOGIN_REDIRECT_NOTICE_STORAGE_KEY);
    return null;
  }

  storage.removeItem(LOGIN_REDIRECT_NOTICE_STORAGE_KEY);
  return raw;
}
