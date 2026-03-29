export const DEFAULT_DEV_USER_ID = "default-user";
export const DEFAULT_DEV_TENANT_ID = "default-tenant";
export const DEFAULT_DEV_AUTH_SOURCE = "dev_seed";

export const DEFAULT_AUTH_SESSION_COOKIE_NAME = "rag_session";
export const DEFAULT_AUTH_SESSION_TTL_HOURS = 24 * 7;
export const DEFAULT_AUTH_OAUTH_STATE_COOKIE_NAME = "rag_oauth_state";
export const DEFAULT_AUTH_OAUTH_STATE_TTL_SECONDS = 10 * 60;
export const DEFAULT_GITHUB_OAUTH_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";

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
