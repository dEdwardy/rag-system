export type AuthSource = "session" | "dev_seed" | (string & {});

export type AuthIdentity = {
  userId: string;
  tenantId: string;
  sessionId: string | null;
  authSource: AuthSource;
};

export type RequestAuthContext = {
  identity: AuthIdentity | null;
};

export type ApiRequestWithAuthContext = {
  authContext?: RequestAuthContext;
};

const DEFAULT_DEV_AUTH_SOURCE: AuthSource = "dev_seed";
const DEFAULT_DEV_USER_ID = "default-user";

export function resolveRequestAuthContext(input: {
  authContext?: RequestAuthContext | null;
  fallbackTenantId: string;
}): { identity: AuthIdentity } {
  const identity = input.authContext?.identity;
  if (isAuthIdentity(identity)) {
    return {
      identity
    };
  }

  return {
    identity: {
      userId: DEFAULT_DEV_USER_ID,
      tenantId: input.fallbackTenantId,
      sessionId: null,
      authSource: DEFAULT_DEV_AUTH_SOURCE
    }
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
