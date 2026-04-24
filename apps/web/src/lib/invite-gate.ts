const INVITE_GATE_STORAGE_KEY = 'rag.invite.approved';
const INVITE_GATE_CODE = 'edw4rd';
const PRIVATE_BETA_DEFAULT_CREDENTIALS = {
  email: 'default-user@example.com',
  password: 'local-password-1'
} as const;

export function isDevelopment() {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

export function isInviteGateAccepted() {
  // Temporary bypass: disable the invite gate so unauthenticated users land on
  // the login page directly instead of being sent to the private-beta screen.
  return true;
}

export function acceptInviteGate() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(INVITE_GATE_STORAGE_KEY, '1');
  } catch {
    void 0;
  }
}

export function matchesInviteCode(input: string) {
  return input.trim().toLowerCase() === INVITE_GATE_CODE;
}

// Temporary private-beta fallback. Remove after the invite-only test phase ends.
export function getPrivateBetaDefaultCredentials() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (isDevelopment() || isInviteGateAccepted()) {
    return PRIVATE_BETA_DEFAULT_CREDENTIALS;
  }

  return null;
}
