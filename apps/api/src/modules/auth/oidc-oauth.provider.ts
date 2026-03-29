import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
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

export type OidcOauthIdentity = {
  subject: string;
  email: string | null;
  profileSnapshot: Record<string, unknown>;
};

export interface OidcOauthProvider {
  resolveStartConfig(): OidcOauthStartConfig;
  resolveCallbackConfig(): OidcOauthCallbackConfig;
  exchangeCodeForIdentity(input: { code: string }): Promise<OidcOauthIdentity>;
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

  async exchangeCodeForIdentity(input: { code: string }): Promise<OidcOauthIdentity> {
    const config = this.resolveCallbackConfig();
    const metadata = await this.fetchDiscoveryMetadata(config.discoveryUrl);
    const accessToken = await this.exchangeCodeForToken({
      code: input.code,
      config,
      metadata
    });
    const userProfile = await this.fetchOidcUserProfile({
      accessToken,
      metadata
    });
    const subject = this.extractOidcSubject(userProfile);
    const email = typeof userProfile.email === "string" ? userProfile.email.trim().toLowerCase() : null;

    return {
      subject,
      email: email && email.length > 0 ? email : null,
      profileSnapshot: userProfile
    };
  }

  private async fetchDiscoveryMetadata(discoveryUrl: string): Promise<{ tokenEndpoint: string; userinfoEndpoint: string }> {
    const discoveryResponse = await fetch(discoveryUrl);
    if (!discoveryResponse.ok) {
      throw new ServiceUnavailableException(
        "OIDC OAuth callback is not configured. Failed to resolve discovery metadata."
      );
    }

    const payload = (await discoveryResponse.json()) as {
      token_endpoint?: unknown;
      userinfo_endpoint?: unknown;
    };
    const tokenEndpoint = typeof payload.token_endpoint === "string" ? payload.token_endpoint.trim() : "";
    const userinfoEndpoint = typeof payload.userinfo_endpoint === "string" ? payload.userinfo_endpoint.trim() : "";

    if (tokenEndpoint.length === 0) {
      throw new ServiceUnavailableException(
        "OIDC OAuth callback is not configured. Discovery metadata is missing token_endpoint."
      );
    }

    if (userinfoEndpoint.length === 0) {
      throw new ServiceUnavailableException(
        "OIDC OAuth callback is not configured. Discovery metadata is missing userinfo_endpoint."
      );
    }

    return {
      tokenEndpoint,
      userinfoEndpoint
    };
  }

  private async exchangeCodeForToken(input: {
    code: string;
    config: OidcOauthCallbackConfig;
    metadata: {
      tokenEndpoint: string;
    };
  }): Promise<string> {
    const response = await fetch(input.metadata.tokenEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: input.config.clientId,
        client_secret: input.config.clientSecret,
        code: input.code,
        redirect_uri: input.config.redirectUri,
        grant_type: "authorization_code"
      }).toString()
    });

    if (!response.ok) {
      throw new UnauthorizedException("OIDC OAuth code exchange failed.");
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const accessToken = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
    if (accessToken.length === 0) {
      throw new UnauthorizedException("OIDC OAuth code exchange did not return an access token.");
    }

    return accessToken;
  }

  private async fetchOidcUserProfile(input: {
    accessToken: string;
    metadata: {
      userinfoEndpoint: string;
    };
  }): Promise<Record<string, unknown>> {
    const response = await fetch(input.metadata.userinfoEndpoint, {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new UnauthorizedException("OIDC OAuth user profile fetch failed.");
    }

    const payload = await response.json();
    if (typeof payload !== "object" || payload == null) {
      throw new UnauthorizedException("OIDC OAuth user profile payload is invalid.");
    }

    return payload as Record<string, unknown>;
  }

  private extractOidcSubject(profile: Record<string, unknown>): string {
    const rawSubject = profile.sub;
    const subject = typeof rawSubject === "string" ? rawSubject.trim() : "";

    if (subject.length === 0) {
      throw new UnauthorizedException("OIDC OAuth user profile does not include a stable subject id.");
    }

    return subject;
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
