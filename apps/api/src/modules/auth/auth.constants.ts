export const DEFAULT_DEV_USER_ID = "default-user";
export const DEFAULT_DEV_TENANT_ID = "default-tenant";
export const DEFAULT_DEV_AUTH_SOURCE = "dev_seed";

export const DEFAULT_AUTH_SESSION_COOKIE_NAME = "rag_session";
export const DEFAULT_AUTH_SESSION_TTL_HOURS = 24 * 7;

export function isAuthDevDefaultUserModeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.AUTH_DEV_DEFAULT_USER_MODE?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") {
    return true;
  }

  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return false;
  }

  return env.NODE_ENV !== "production";
}
