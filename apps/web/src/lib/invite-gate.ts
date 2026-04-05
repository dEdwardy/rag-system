const INVITE_GATE_STORAGE_KEY = "rag.invite.approved";
const INVITE_GATE_CODE = "edw4rd";

export function isInviteGateAccepted() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.sessionStorage.getItem(INVITE_GATE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function acceptInviteGate() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(INVITE_GATE_STORAGE_KEY, "1");
  } catch {
  }
}

export function matchesInviteCode(input: string) {
  return input.trim().toLowerCase() === INVITE_GATE_CODE;
}
