import { DEFAULT_DEV_AUTH_SOURCE, DEFAULT_DEV_TENANT_ID, DEFAULT_DEV_USER_ID } from "./auth.constants";

export type AuthSource = "session" | "dev_seed" | (string & {});

export type AuthIdentity = {
  userId: string;
  tenantId: string;
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

export function resolveCurrentAuthIdentity(input: { identity?: AuthIdentity | null }): AuthIdentity {
  const identity = input.identity;
  if (isAuthIdentity(identity)) {
    return identity;
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
    sessionId: null,
    authSource: DEFAULT_AUTH_SOURCE
  };
}

function isAuthIdentity(value: unknown): value is AuthIdentity {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.userId === "string" &&
    typeof candidate.tenantId === "string" &&
    (typeof candidate.sessionId === "string" || candidate.sessionId === null) &&
    typeof candidate.authSource === "string"
  );
}
