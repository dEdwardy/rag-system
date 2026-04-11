import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  DEFAULT_AUTH_ACCESS_JWT_TTL_MINUTES,
  DEFAULT_AUTH_ACCESS_TOKEN_COOKIE_NAME,
  DEFAULT_AUTH_LOGIN_PROVENANCE_COOKIE_NAME,
  DEFAULT_AUTH_OAUTH_STATE_COOKIE_NAME,
  DEFAULT_AUTH_OAUTH_STATE_TTL_SECONDS,
  DEFAULT_AUTH_REFRESH_TOKEN_COOKIE_NAME,
  DEFAULT_AUTH_SESSION_TTL_HOURS,
  DEFAULT_DEV_LOGIN_EMAIL,
  DEFAULT_DEV_LOGIN_PASSWORD,
  DEFAULT_DEV_TENANT_ID,
  DEFAULT_GITHUB_OAUTH_AUTHORIZE_URL,
  DEFAULT_GOOGLE_OAUTH_AUTHORIZE_URL,
  DEFAULT_OIDC_OAUTH_SCOPE,
  DEFAULT_OIDC_WELL_KNOWN_PATH,
  isAuthDevDefaultUserModeEnabled
} from "./auth.constants";

export type AuthRateLimitProfile = "login" | "oauth_start" | "oauth_callback" | "refresh";

export type AuthProviderRuntimeConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizeUrl: string;
  tokenUrl: string;
  userUrl: string;
  scope: string;
};

export type OidcRuntimeConfig = {
  issuer: string;
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
};

export type AuthRuntimeConfig = {
  isDevelopmentLike: boolean;
  defaultTenantId: string;
  sessionStoreProvider: "database" | "redis";
  redisUrl: string | null;
  sessionStoreKeyPrefix: string;
  sessionTtlHours: number;
  accessJwtTtlMinutes: number;
  sessionCookieName: string;
  accessTokenCookieName: string;
  refreshTokenCookieName: string;
  oauthStateCookieName: string;
  loginProvenanceCookieName: string;
  oauthStateTtlSeconds: number;
  oauthSuccessRedirectUrl: string;
  // access JWT 的签名密钥。生产环境必须显式配置。
  accessJwtSecret: string;
  // 统一控制 auth cookie 是否带 Secure。
  cookieSecure: boolean;
  // 统一控制 auth cookie 的 SameSite 策略。
  cookieSameSite: "Lax" | "Strict" | "None";
  localDevCredentials: {
    enabled: boolean;
    email: string;
    password: string;
  };
  github: AuthProviderRuntimeConfig;
  google: AuthProviderRuntimeConfig;
  oidc: OidcRuntimeConfig;
  rateLimits: Record<AuthRateLimitProfile, {
    windowMs: number;
    maxAttempts: number;
  }>;
};

export const AUTH_RUNTIME_CONFIG = Symbol("AUTH_RUNTIME_CONFIG");

export class AuthRuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthRuntimeConfigError";
  }
}

export function resolveAuthRuntimeConfig(env: NodeJS.ProcessEnv = process.env): AuthRuntimeConfig {
  const sessionTtlHours = parsePositiveInteger(env.AUTH_SESSION_TTL_HOURS, DEFAULT_AUTH_SESSION_TTL_HOURS, "AUTH_SESSION_TTL_HOURS");
  // access token 默认短 TTL，目标是把大多数请求挡在 JWT 本地验签层，不再每次查 session。
  const accessJwtTtlMinutes = parsePositiveInteger(
    env.AUTH_ACCESS_JWT_TTL_MINUTES,
    DEFAULT_AUTH_ACCESS_JWT_TTL_MINUTES,
    "AUTH_ACCESS_JWT_TTL_MINUTES"
  );
  const oauthStateTtlSeconds = parsePositiveInteger(
    env.AUTH_OAUTH_STATE_TTL_SECONDS,
    DEFAULT_AUTH_OAUTH_STATE_TTL_SECONDS,
    "AUTH_OAUTH_STATE_TTL_SECONDS"
  );
  const corsOrigins = readCsv(env.CORS_ORIGIN);
  const configuredOauthSuccessRedirect = readString(env.AUTH_OAUTH_SUCCESS_REDIRECT_URI) ?? readString(env.AUTH_WEB_SUCCESS_REDIRECT_URI);

  return {
    isDevelopmentLike: (env.NODE_ENV ?? "").trim() !== "production",
    defaultTenantId: readString(env.AUTH_DEFAULT_TENANT_ID) ?? DEFAULT_DEV_TENANT_ID,
    sessionStoreProvider: readAuthSessionStoreProvider(env.AUTH_SESSION_STORE_PROVIDER),
    redisUrl: readString(env.REDIS_URL) ?? null,
    sessionStoreKeyPrefix: readString(env.AUTH_SESSION_STORE_KEY_PREFIX) ?? "rag-auth",
    sessionTtlHours,
    accessJwtTtlMinutes,
    sessionCookieName: readString(env.AUTH_SESSION_COOKIE_NAME) ?? "rag_session",
    accessTokenCookieName: readString(env.AUTH_ACCESS_TOKEN_COOKIE_NAME) ?? DEFAULT_AUTH_ACCESS_TOKEN_COOKIE_NAME,
    refreshTokenCookieName: readString(env.AUTH_REFRESH_TOKEN_COOKIE_NAME) ?? DEFAULT_AUTH_REFRESH_TOKEN_COOKIE_NAME,
    oauthStateCookieName: readString(env.AUTH_OAUTH_STATE_COOKIE_NAME) ?? DEFAULT_AUTH_OAUTH_STATE_COOKIE_NAME,
    loginProvenanceCookieName:
      readString(env.AUTH_LOGIN_PROVENANCE_COOKIE_NAME) ?? DEFAULT_AUTH_LOGIN_PROVENANCE_COOKIE_NAME,
    oauthStateTtlSeconds,
    oauthSuccessRedirectUrl: configuredOauthSuccessRedirect ?? corsOrigins[0] ?? "http://localhost:5173",
    // 开发环境给一个默认值，避免本地未配 secret 时整条登录链路不可用；生产环境仍要求显式配置。
    accessJwtSecret: readString(env.AUTH_ACCESS_JWT_SECRET) ?? (((env.NODE_ENV ?? "").trim() !== "production") ? "dev-access-jwt-secret" : ""),
    cookieSecure: readBoolean(env.AUTH_COOKIE_SECURE, (env.NODE_ENV ?? "").trim() === "production"),
    cookieSameSite: readSameSite(env.AUTH_COOKIE_SAME_SITE) ?? "Lax",
    localDevCredentials: {
      enabled: isAuthDevDefaultUserModeEnabled(env),
      email: readString(env.AUTH_DEV_DEFAULT_USER_EMAIL) ?? DEFAULT_DEV_LOGIN_EMAIL,
      password: readString(env.AUTH_DEV_DEFAULT_USER_PASSWORD) ?? DEFAULT_DEV_LOGIN_PASSWORD
    },
    github: {
      clientId: readString(env.AUTH_GITHUB_CLIENT_ID) ?? "",
      clientSecret: readString(env.AUTH_GITHUB_CLIENT_SECRET) ?? "",
      redirectUri: readString(env.AUTH_GITHUB_REDIRECT_URI) ?? "",
      authorizeUrl: readString(env.AUTH_GITHUB_AUTHORIZE_URL) ?? DEFAULT_GITHUB_OAUTH_AUTHORIZE_URL,
      tokenUrl: readString(env.AUTH_GITHUB_TOKEN_URL) ?? "https://github.com/login/oauth/access_token",
      userUrl: readString(env.AUTH_GITHUB_USER_URL) ?? "https://api.github.com/user",
      scope: readString(env.AUTH_GITHUB_SCOPE) ?? "read:user user:email"
    },
    google: {
      clientId: readString(env.AUTH_GOOGLE_CLIENT_ID) ?? "",
      clientSecret: readString(env.AUTH_GOOGLE_CLIENT_SECRET) ?? "",
      redirectUri: readString(env.AUTH_GOOGLE_REDIRECT_URI) ?? "",
      authorizeUrl: readString(env.AUTH_GOOGLE_AUTHORIZE_URL) ?? DEFAULT_GOOGLE_OAUTH_AUTHORIZE_URL,
      tokenUrl: readString(env.AUTH_GOOGLE_TOKEN_URL) ?? "https://oauth2.googleapis.com/token",
      userUrl: readString(env.AUTH_GOOGLE_USER_URL) ?? "https://openidconnect.googleapis.com/v1/userinfo",
      scope: readString(env.AUTH_GOOGLE_SCOPE) ?? "openid email profile"
    },
    oidc: {
      issuer: normalizeIssuer(readString(env.AUTH_OIDC_ISSUER) ?? ""),
      discoveryUrl: buildOidcDiscoveryUrl(readString(env.AUTH_OIDC_ISSUER) ?? ""),
      clientId: readString(env.AUTH_OIDC_CLIENT_ID) ?? "",
      clientSecret: readString(env.AUTH_OIDC_CLIENT_SECRET) ?? "",
      redirectUri: readString(env.AUTH_OIDC_REDIRECT_URI) ?? "",
      scope: readString(env.AUTH_OIDC_SCOPE) ?? DEFAULT_OIDC_OAUTH_SCOPE
    },
    rateLimits: {
      login: {
        windowMs: parsePositiveInteger(env.AUTH_RATE_LIMIT_LOGIN_WINDOW_MS, 60_000, "AUTH_RATE_LIMIT_LOGIN_WINDOW_MS"),
        maxAttempts: parsePositiveInteger(env.AUTH_RATE_LIMIT_LOGIN_MAX, 5, "AUTH_RATE_LIMIT_LOGIN_MAX")
      },
      oauth_start: {
        windowMs: parsePositiveInteger(env.AUTH_RATE_LIMIT_OAUTH_START_WINDOW_MS, 60_000, "AUTH_RATE_LIMIT_OAUTH_START_WINDOW_MS"),
        maxAttempts: parsePositiveInteger(env.AUTH_RATE_LIMIT_OAUTH_START_MAX, 10, "AUTH_RATE_LIMIT_OAUTH_START_MAX")
      },
      oauth_callback: {
        windowMs: parsePositiveInteger(
          env.AUTH_RATE_LIMIT_OAUTH_CALLBACK_WINDOW_MS,
          60_000,
          "AUTH_RATE_LIMIT_OAUTH_CALLBACK_WINDOW_MS"
        ),
        maxAttempts: parsePositiveInteger(env.AUTH_RATE_LIMIT_OAUTH_CALLBACK_MAX, 10, "AUTH_RATE_LIMIT_OAUTH_CALLBACK_MAX")
      },
      refresh: {
        // refresh 是轻接口，但仍需要限流，避免 access token 过期后被高频撞击。
        windowMs: parsePositiveInteger(env.AUTH_RATE_LIMIT_REFRESH_WINDOW_MS, 60_000, "AUTH_RATE_LIMIT_REFRESH_WINDOW_MS"),
        maxAttempts: parsePositiveInteger(env.AUTH_RATE_LIMIT_REFRESH_MAX, 30, "AUTH_RATE_LIMIT_REFRESH_MAX")
      }
    }
  };
}

function readAuthSessionStoreProvider(rawValue: string | undefined): "database" | "redis" {
  const normalized = rawValue?.trim().toLowerCase();
  if (!normalized) {
    return "database";
  }

  if (normalized === "database" || normalized === "redis") {
    return normalized;
  }

  throw new AuthRuntimeConfigError("AUTH_SESSION_STORE_PROVIDER must be one of: database, redis.");
}

function readBoolean(rawValue: string | undefined, fallback: boolean): boolean {
  const normalized = rawValue?.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }

  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }

  throw new AuthRuntimeConfigError("AUTH_COOKIE_SECURE must be a boolean when set.");
}

function readSameSite(rawValue: string | undefined): "Lax" | "Strict" | "None" | undefined {
  const normalized = rawValue?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === "lax") {
    return "Lax";
  }

  if (normalized === "strict") {
    return "Strict";
  }

  if (normalized === "none") {
    return "None";
  }

  throw new AuthRuntimeConfigError("AUTH_COOKIE_SAME_SITE must be one of: lax, strict, none.");
}

function readString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function readCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);
}

function parsePositiveInteger(rawValue: string | undefined, fallback: number, envName: string) {
  if (!rawValue?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AuthRuntimeConfigError(`${envName} must be a positive integer when set.`);
  }

  return parsed;
}

function normalizeIssuer(rawIssuer: string): string {
  return rawIssuer.replace(/\/+$/, "");
}

function buildOidcDiscoveryUrl(rawIssuer: string): string {
  const issuer = normalizeIssuer(rawIssuer);
  return issuer.length > 0 ? `${issuer}${DEFAULT_OIDC_WELL_KNOWN_PATH}` : "";
}

@Injectable()
export class AuthRuntimeConfigService {
  constructor(
    @Optional()
    @Inject(AUTH_RUNTIME_CONFIG)
    private readonly config?: AuthRuntimeConfig
  ) {}

  getConfig() {
    return this.config ?? resolveAuthRuntimeConfig();
  }
}
