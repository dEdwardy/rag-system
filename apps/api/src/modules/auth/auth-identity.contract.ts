import { DEFAULT_DEV_AUTH_SOURCE, DEFAULT_DEV_TENANT_ID, DEFAULT_DEV_USER_ID } from "./auth.constants";

export type AuthSource = "session" | "dev_seed" | (string & {});

export type AuthRole = "owner" | "member" | (string & {});

export type AuthIdentity = {
  userId: string;
  tenantId: string;
  role: AuthRole;
  sessionId: string | null;
  authSource: AuthSource;
};

export type RequestAuthContext = {
  identity: AuthIdentity | null;
  currentIdentity: AuthIdentity;
};

export type ApiRequestWithAuthContext = {
  authContext?: RequestAuthContext;
};

const DEFAULT_AUTH_SOURCE: AuthSource = DEFAULT_DEV_AUTH_SOURCE;
const DEFAULT_AUTH_ROLE: AuthRole = "owner";

export function resolveCurrentAuthIdentity(input: { identity?: AuthIdentity | null }): AuthIdentity {
  const resolved = normalizeAuthIdentity(input.identity);
  if (resolved != null) {
    return resolved;
  }

  return buildDefaultDevIdentity();
}

export function resolveRequestAuthContext(input: {
  authContext?: RequestAuthContext | null;
}): { identity: AuthIdentity } {
  const currentIdentity = input.authContext?.currentIdentity;
  if (isAuthIdentity(currentIdentity)) {
    return {
      identity: currentIdentity
    };
  }

  const identity = input.authContext?.identity;
  return {
    identity: resolveCurrentAuthIdentity({ identity })
  };
}

function buildDefaultDevIdentity(): AuthIdentity {
  return {
    userId: DEFAULT_DEV_USER_ID,
    tenantId: DEFAULT_DEV_TENANT_ID,
    role: DEFAULT_AUTH_ROLE,
    sessionId: null,
    authSource: DEFAULT_AUTH_SOURCE
  };
}

function isAuthIdentity(value: unknown): value is AuthIdentity {
  return normalizeAuthIdentity(value) != null;
}

function normalizeAuthIdentity(value: unknown): AuthIdentity | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.userId !== "string" ||
    typeof candidate.tenantId !== "string" ||
    (typeof candidate.sessionId !== "string" && candidate.sessionId !== null) ||
    typeof candidate.authSource !== "string"
  ) {
    return null;
  }

  return {
    userId: candidate.userId,
    tenantId: candidate.tenantId,
    role: typeof candidate.role === "string" ? candidate.role : DEFAULT_AUTH_ROLE,
    sessionId: candidate.sessionId,
    authSource: candidate.authSource
  };
}
