import { Injectable, UnauthorizedException, ServiceUnavailableException } from "@nestjs/common";

export type GoogleOauthIdentity = {
  subject: string;
  email: string | null;
  profileSnapshot: Record<string, unknown>;
};

export interface GoogleOauthProvider {
  exchangeCodeForIdentity(input: { code: string }): Promise<GoogleOauthIdentity>;
}

export const GOOGLE_OAUTH_PROVIDER = Symbol("GOOGLE_OAUTH_PROVIDER");

@Injectable()
export class HttpGoogleOauthProvider implements GoogleOauthProvider {
  async exchangeCodeForIdentity(input: { code: string }): Promise<GoogleOauthIdentity> {
    const config = this.resolveConfig();
    const accessToken = await this.exchangeCodeForToken({
      code: input.code,
      config
    });

    const userProfile = await this.fetchGoogleUserProfile({
      accessToken,
      config
    });
    const subject = this.extractGoogleSubject(userProfile);
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
    const clientId = (process.env.AUTH_GOOGLE_CLIENT_ID ?? "").trim();
    const clientSecret = (process.env.AUTH_GOOGLE_CLIENT_SECRET ?? "").trim();
    const redirectUri = (process.env.AUTH_GOOGLE_REDIRECT_URI ?? "").trim();
    const tokenUrl = (process.env.AUTH_GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token").trim();
    const userUrl = (process.env.AUTH_GOOGLE_USER_URL ?? "https://openidconnect.googleapis.com/v1/userinfo").trim();

    if (clientId.length === 0 || clientSecret.length === 0 || redirectUri.length === 0) {
      throw new ServiceUnavailableException(
        "Google OAuth callback is not configured. Set AUTH_GOOGLE_CLIENT_ID, AUTH_GOOGLE_CLIENT_SECRET, and AUTH_GOOGLE_REDIRECT_URI."
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
        redirect_uri: input.config.redirectUri,
        grant_type: "authorization_code"
      }).toString()
    });

    if (!response.ok) {
      throw new UnauthorizedException("Google OAuth code exchange failed.");
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const accessToken = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
    if (accessToken.length === 0) {
      throw new UnauthorizedException("Google OAuth code exchange did not return an access token.");
    }

    return accessToken;
  }

  private async fetchGoogleUserProfile(input: {
    accessToken: string;
    config: {
      userUrl: string;
    };
  }): Promise<Record<string, unknown>> {
    const response = await fetch(input.config.userUrl, {
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new UnauthorizedException("Google OAuth user profile fetch failed.");
    }

    const payload = await response.json();
    if (typeof payload !== "object" || payload == null) {
      throw new UnauthorizedException("Google OAuth user profile payload is invalid.");
    }

    return payload as Record<string, unknown>;
  }

  private extractGoogleSubject(profile: Record<string, unknown>): string {
    const rawSubject = profile.sub;
    const subject = typeof rawSubject === "string" ? rawSubject.trim() : "";

    if (subject.length === 0) {
      throw new UnauthorizedException("Google OAuth user profile does not include a stable subject id.");
    }

    return subject;
  }
}
