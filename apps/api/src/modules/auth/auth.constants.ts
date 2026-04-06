export const DEFAULT_DEV_USER_ID = "default-user";
export const DEFAULT_DEV_TENANT_ID = "default-tenant";
export const DEFAULT_DEV_AUTH_SOURCE = "dev_seed";
export const DEFAULT_DEV_LOGIN_EMAIL = "default-user@example.com";
export const DEFAULT_DEV_LOGIN_PASSWORD = "local-password-1";

export const DEFAULT_AUTH_SESSION_COOKIE_NAME = "rag_session";
export const DEFAULT_AUTH_ACCESS_TOKEN_COOKIE_NAME = "rag_access_token";
export const DEFAULT_AUTH_LOGIN_PROVENANCE_COOKIE_NAME = "rag_login_provenance";
export const DEFAULT_AUTH_SESSION_TTL_HOURS = 24 * 7;
export const DEFAULT_AUTH_ACCESS_JWT_TTL_MINUTES = 15;
export const DEFAULT_AUTH_OAUTH_STATE_COOKIE_NAME = "rag_oauth_state";
export const DEFAULT_AUTH_OAUTH_STATE_TTL_SECONDS = 10 * 60;
export const DEFAULT_GITHUB_OAUTH_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
export const DEFAULT_GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const DEFAULT_OIDC_OAUTH_SCOPE = "openid email profile";
export const DEFAULT_OIDC_WELL_KNOWN_PATH = "/.well-known/openid-configuration";

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
