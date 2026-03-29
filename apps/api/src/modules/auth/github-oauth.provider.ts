import { Injectable, UnauthorizedException, ServiceUnavailableException } from "@nestjs/common";

export type GithubOauthIdentity = {
  subject: string;
  email: string | null;
  profileSnapshot: Record<string, unknown>;
};

export interface GithubOauthProvider {
  exchangeCodeForIdentity(input: { code: string }): Promise<GithubOauthIdentity>;
}

export const GITHUB_OAUTH_PROVIDER = Symbol("GITHUB_OAUTH_PROVIDER");

@Injectable()
export class HttpGithubOauthProvider implements GithubOauthProvider {
  async exchangeCodeForIdentity(input: { code: string }): Promise<GithubOauthIdentity> {
    const config = this.resolveConfig();
    const accessToken = await this.exchangeCodeForToken({
      code: input.code,
      config
    });

    const userProfile = await this.fetchGithubUserProfile({
      accessToken,
      config
    });
    const subject = this.extractGithubSubject(userProfile);
    const email = typeof userProfile.email === "string" ? userProfile.email.trim().toLowerCase() : null;

    return {
      subject,
      email: email && email.length > 0 ? email : null,
      profileSnapshot: userProfile
    };
  }

  private resolveConfig(): {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    tokenUrl: string;
    userUrl: string;
  } {
    const clientId = (process.env.AUTH_GITHUB_CLIENT_ID ?? "").trim();
    const clientSecret = (process.env.AUTH_GITHUB_CLIENT_SECRET ?? "").trim();
    const redirectUri = (process.env.AUTH_GITHUB_REDIRECT_URI ?? "").trim();
    const tokenUrl = (process.env.AUTH_GITHUB_TOKEN_URL ?? "https://github.com/login/oauth/access_token").trim();
    const userUrl = (process.env.AUTH_GITHUB_USER_URL ?? "https://api.github.com/user").trim();

    if (clientId.length === 0 || clientSecret.length === 0 || redirectUri.length === 0) {
      throw new ServiceUnavailableException(
        "GitHub OAuth callback is not configured. Required env: AUTH_GITHUB_CLIENT_ID, AUTH_GITHUB_CLIENT_SECRET, AUTH_GITHUB_REDIRECT_URI."
      );
    }

    return {
      clientId,
      clientSecret,
      redirectUri,
      tokenUrl,
      userUrl
    };
  }

  private async exchangeCodeForToken(input: {
    code: string;
    config: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      tokenUrl: string;
    };
  }): Promise<string> {
    const response = await fetch(input.config.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: input.config.clientId,
        client_secret: input.config.clientSecret,
        code: input.code,
        redirect_uri: input.config.redirectUri
      }).toString()
    });

    if (!response.ok) {
      throw new UnauthorizedException("GitHub OAuth code exchange failed.");
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const accessToken = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
    if (accessToken.length === 0) {
      throw new UnauthorizedException("GitHub OAuth code exchange did not return an access token.");
    }

    return accessToken;
  }

  private async fetchGithubUserProfile(input: {
    accessToken: string;
    config: {
      userUrl: string;
    };
  }): Promise<Record<string, unknown>> {
    const response = await fetch(input.config.userUrl, {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "rag-system-auth"
      }
    });

    if (!response.ok) {
      throw new UnauthorizedException("GitHub OAuth user profile fetch failed.");
    }

    const payload = await response.json();
    if (typeof payload !== "object" || payload == null) {
      throw new UnauthorizedException("GitHub OAuth user profile payload is invalid.");
    }

    return payload as Record<string, unknown>;
  }

  private extractGithubSubject(profile: Record<string, unknown>): string {
    const rawId = profile.id;
    const subject = typeof rawId === "number" ? `${rawId}` : typeof rawId === "string" ? rawId.trim() : "";

    if (subject.length === 0) {
      throw new UnauthorizedException("GitHub OAuth user profile does not include a stable subject id.");
    }

    return subject;
  }
}
