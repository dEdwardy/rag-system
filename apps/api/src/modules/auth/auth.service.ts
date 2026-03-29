import { Injectable, NotImplementedException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { compare } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../infra/database/prisma.service";
import {
  DEFAULT_AUTH_SESSION_TTL_HOURS,
  DEFAULT_GITHUB_OAUTH_AUTHORIZE_URL,
  DEFAULT_AUTH_OAUTH_STATE_TTL_SECONDS,
  DEFAULT_AUTH_OAUTH_STATE_COOKIE_NAME
} from "./auth.constants";
import {
  resolveCurrentAuthIdentity,
  type AuthIdentity,
  type RequestAuthContext
} from "./auth-identity.contract";
import { evaluateOwnerResourceAccess, type ResourceAccessPolicyInput } from "./resource-access-policy.contract";
import type { OauthProvider } from "./auth.schemas";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  startOauthProvider(input: {
    provider: OauthProvider;
  }): {
    provider: "github";
    redirectUrl: string;
    state: string;
    stateCookieName: string;
    stateTtlSeconds: number;
  } {
    if (input.provider !== "github") {
      throw new NotImplementedException(`OAuth provider '${input.provider}' is not implemented yet.`);
    }

    const githubConfig = this.resolveGithubOauthConfig();
    const state = this.generateOauthState();
    const url = new URL(githubConfig.authorizeUrl);
    url.searchParams.set("client_id", githubConfig.clientId);
    url.searchParams.set("redirect_uri", githubConfig.redirectUri);
    url.searchParams.set("scope", githubConfig.scope);
    url.searchParams.set("state", state);

    return {
      provider: "github",
      redirectUrl: url.toString(),
      state,
      stateCookieName: githubConfig.stateCookieName,
      stateTtlSeconds: githubConfig.stateTtlSeconds
    };
  }

  async login(input: { email: string; password: string }): Promise<{ identity: AuthIdentity; expiresAt: string }> {
    const email = this.normalizeEmail(input.email);
    if (email.length === 0 || input.password.length === 0) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const user = await this.prisma.user.findUnique({
      where: {
        email
      },
      select: {
        id: true,
        tenantId: true,
        role: true,
        status: true,
        passwordHash: true
      }
    });

    if (user == null || user.status !== "active" || typeof user.passwordHash !== "string" || user.passwordHash.length === 0) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordMatched = await compare(input.password, user.passwordHash);
    if (!passwordMatched) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const now = Date.now();
    const expiresAt = new Date(now + this.resolveSessionTtlMs());
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        expiresAt,
        lastSeenAt: new Date(now)
      },
      select: {
        id: true
      }
    });

    return {
      identity: {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        sessionId: session.id,
        authSource: "session"
      },
      expiresAt: expiresAt.toISOString()
    };
  }

  async logout(input: { sessionId?: string | null }): Promise<{ ok: true }> {
    if (typeof input.sessionId === "string" && input.sessionId.length > 0) {
      await this.prisma.authSession.updateMany({
        where: {
          id: input.sessionId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });
    }

    return { ok: true };
  }

  getMe(input: { authContext?: RequestAuthContext | null }): {
    identity: AuthIdentity | null;
    currentIdentity: AuthIdentity;
  } {
    return {
      identity: input.authContext?.identity ?? null,
      currentIdentity: resolveCurrentAuthIdentity({ identity: input.authContext?.identity ?? null })
    };
  }

  checkPermission(input: {
    authContext?: RequestAuthContext | null;
    action: ResourceAccessPolicyInput["action"];
    resource: ResourceAccessPolicyInput["resource"];
  }): {
    currentIdentity: AuthIdentity;
    decision: ReturnType<typeof evaluateOwnerResourceAccess>;
  } {
    const currentIdentity = resolveCurrentAuthIdentity({
      identity: input.authContext?.identity ?? null
    });

    return {
      currentIdentity,
      decision: evaluateOwnerResourceAccess({
        identity: {
          tenantId: currentIdentity.tenantId,
          userId: currentIdentity.userId
        },
        action: input.action,
        resource: input.resource
      })
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private resolveSessionTtlMs(): number {
    const rawTtlHours = (process.env.AUTH_SESSION_TTL_HOURS ?? `${DEFAULT_AUTH_SESSION_TTL_HOURS}`).trim();
    const parsed = Number.parseInt(rawTtlHours, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000;
    }

    return parsed * 60 * 60 * 1000;
  }

  private resolveGithubOauthConfig(): {
    clientId: string;
    redirectUri: string;
    authorizeUrl: string;
    scope: string;
    stateCookieName: string;
    stateTtlSeconds: number;
  } {
    const clientId = (process.env.AUTH_GITHUB_CLIENT_ID ?? "").trim();
    const redirectUri = (process.env.AUTH_GITHUB_REDIRECT_URI ?? "").trim();

    if (clientId.length === 0 || redirectUri.length === 0) {
      throw new ServiceUnavailableException(
        "GitHub OAuth is not configured. Set AUTH_GITHUB_CLIENT_ID and AUTH_GITHUB_REDIRECT_URI."
      );
    }

    const authorizeUrl = (process.env.AUTH_GITHUB_AUTHORIZE_URL ?? DEFAULT_GITHUB_OAUTH_AUTHORIZE_URL).trim();
    const scope = (process.env.AUTH_GITHUB_SCOPE ?? "read:user user:email").trim() || "read:user user:email";
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
      clientId,
      redirectUri,
      authorizeUrl,
      scope,
      stateCookieName,
      stateTtlSeconds
    };
  }

  private generateOauthState(): string {
    return randomBytes(24).toString("base64url");
  }
}
