import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  DEFAULT_AUTH_OAUTH_STATE_COOKIE_NAME,
  DEFAULT_AUTH_OAUTH_STATE_TTL_SECONDS,
  DEFAULT_OIDC_OAUTH_SCOPE,
  DEFAULT_OIDC_WELL_KNOWN_PATH
} from "./auth.constants";

export type OidcOauthStartConfig = {
  issuer: string;
  discoveryUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  stateCookieName: string;
  stateTtlSeconds: number;
};

export type OidcOauthCallbackConfig = {
  issuer: string;
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export interface OidcOauthProvider {
  resolveStartConfig(): OidcOauthStartConfig;
  resolveCallbackConfig(): OidcOauthCallbackConfig;
}

export const OIDC_OAUTH_PROVIDER = Symbol("OIDC_OAUTH_PROVIDER");

@Injectable()
export class HttpOidcOauthProvider implements OidcOauthProvider {
  resolveStartConfig(): OidcOauthStartConfig {
    const baseConfig = this.resolveBaseConfig();

    if (baseConfig.clientId.length === 0 || baseConfig.redirectUri.length === 0) {
      throw new ServiceUnavailableException(
        "OIDC OAuth start is not configured. Required env: AUTH_OIDC_ISSUER, AUTH_OIDC_CLIENT_ID, AUTH_OIDC_REDIRECT_URI."
      );
    }

    const scope = (process.env.AUTH_OIDC_SCOPE ?? DEFAULT_OIDC_OAUTH_SCOPE).trim() || DEFAULT_OIDC_OAUTH_SCOPE;
    const stateCookieName =
      (process.env.AUTH_OAUTH_STATE_COOKIE_NAME ?? DEFAULT_AUTH_OAUTH_STATE_COOKIE_NAME).trim() ||
      DEFAULT_AUTH_OAUTH_STATE_COOKIE_NAME;

    const rawStateTtlSeconds =
      (process.env.AUTH_OAUTH_STATE_TTL_SECONDS ?? `${DEFAULT_AUTH_OAUTH_STATE_TTL_SECONDS}`).trim();
    const parsedStateTtlSeconds = Number.parseInt(rawStateTtlSeconds, 10);
    const stateTtlSeconds = Number.isFinite(parsedStateTtlSeconds) && parsedStateTtlSeconds > 0
      ? parsedStateTtlSeconds
      : DEFAULT_AUTH_OAUTH_STATE_TTL_SECONDS;

    return {
      issuer: baseConfig.issuer,
      discoveryUrl: baseConfig.discoveryUrl,
      clientId: baseConfig.clientId,
      redirectUri: baseConfig.redirectUri,
      scope,
      stateCookieName,
      stateTtlSeconds
    };
  }

  resolveCallbackConfig(): OidcOauthCallbackConfig {
    const baseConfig = this.resolveBaseConfig();

    if (baseConfig.clientId.length === 0 || baseConfig.clientSecret.length === 0 || baseConfig.redirectUri.length === 0) {
      throw new ServiceUnavailableException(
        "OIDC OAuth callback is not configured. Required env: AUTH_OIDC_ISSUER, AUTH_OIDC_CLIENT_ID, AUTH_OIDC_CLIENT_SECRET, AUTH_OIDC_REDIRECT_URI."
      );
    }

    return {
      issuer: baseConfig.issuer,
      discoveryUrl: baseConfig.discoveryUrl,
      clientId: baseConfig.clientId,
      clientSecret: baseConfig.clientSecret,
      redirectUri: baseConfig.redirectUri
    };
  }

  private resolveBaseConfig(): {
    issuer: string;
    discoveryUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } {
    const rawIssuer = (process.env.AUTH_OIDC_ISSUER ?? "").trim();
    if (rawIssuer.length === 0) {
      throw new ServiceUnavailableException(
        "OIDC OAuth config is not configured. Required env: AUTH_OIDC_ISSUER."
      );
    }

    const issuer = rawIssuer.replace(/\/+$/, "");
    const discoveryUrl = `${issuer}${DEFAULT_OIDC_WELL_KNOWN_PATH}`;

    return {
      issuer,
      discoveryUrl,
      clientId: (process.env.AUTH_OIDC_CLIENT_ID ?? "").trim(),
      clientSecret: (process.env.AUTH_OIDC_CLIENT_SECRET ?? "").trim(),
      redirectUri: (process.env.AUTH_OIDC_REDIRECT_URI ?? "").trim()
    };
  }
}
