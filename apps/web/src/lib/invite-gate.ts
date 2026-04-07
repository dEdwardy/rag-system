const INVITE_GATE_STORAGE_KEY = "rag.invite.approved";
const INVITE_GATE_CODE = "edw4rd";

// 检测是否为开发环境
export function isDevelopment() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

export function isInviteGateAccepted() {
  if (typeof window === "undefined") {
    return false;
  }

  // 开发环境直接跳过验证
  if (isDevelopment()) {
    return true;
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
