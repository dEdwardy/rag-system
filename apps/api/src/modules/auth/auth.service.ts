import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { compare } from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../../infra/database/prisma.service";
import {
  DEFAULT_DEV_LOGIN_EMAIL,
  DEFAULT_DEV_LOGIN_PASSWORD,
  DEFAULT_DEV_TENANT_ID,
  DEFAULT_AUTH_SESSION_TTL_HOURS,
  DEFAULT_GITHUB_OAUTH_AUTHORIZE_URL,
  DEFAULT_GOOGLE_OAUTH_AUTHORIZE_URL,
  DEFAULT_AUTH_OAUTH_STATE_TTL_SECONDS,
  DEFAULT_AUTH_OAUTH_STATE_COOKIE_NAME,
  isAuthDevDefaultUserModeEnabled
} from "./auth.constants";
import {
  resolveCurrentAuthIdentity,
  type AuthIdentity,
  type RequestAuthContext
} from "./auth-identity.contract";
import { evaluateOwnerResourceAccess, type ResourceAccessPolicyInput } from "./resource-access-policy.contract";
import type { AuthMeLoginProvenance, OauthProvider } from "./auth.schemas";
import {
  GITHUB_OAUTH_PROVIDER,
  HttpGithubOauthProvider,
  type GithubOauthProvider
} from "./github-oauth.provider";
import {
  GOOGLE_OAUTH_PROVIDER,
  HttpGoogleOauthProvider,
  type GoogleOauthProvider
} from "./google-oauth.provider";
import {
  HttpOidcOauthProvider,
  OIDC_OAUTH_PROVIDER,
  type OidcOauthProvider
} from "./oidc-oauth.provider";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GITHUB_OAUTH_PROVIDER)
    private readonly githubOauthProvider: GithubOauthProvider = new HttpGithubOauthProvider(),
    @Inject(GOOGLE_OAUTH_PROVIDER)
    private readonly googleOauthProvider: GoogleOauthProvider = new HttpGoogleOauthProvider(),
    @Inject(OIDC_OAUTH_PROVIDER)
    private readonly oidcOauthProvider: OidcOauthProvider = new HttpOidcOauthProvider()
  ) {}

  async startOauthProvider(input: {
    provider: OauthProvider;
  }): Promise<{
    provider: "github" | "google" | "oidc";
    redirectUrl: string;
    state: string;
    stateCookieName: string;
    stateTtlSeconds: number;
  }> {
    const state = this.generateOauthState();
    const providerConfig = input.provider === "oidc"
      ? await this.resolveOidcOauthStartConfig({
        ...this.oidcOauthProvider.resolveStartConfig(),
        state
      })
      : this.resolveOauthStartConfig(input.provider, state);

    const url = new URL(providerConfig.authorizeUrl);
    for (const [key, value] of Object.entries(providerConfig.queryParams)) {
      url.searchParams.set(key, value);
    }

    return {
      provider: input.provider,
      redirectUrl: url.toString(),
      state,
      stateCookieName: providerConfig.stateCookieName,
      stateTtlSeconds: providerConfig.stateTtlSeconds
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

    return this.createSessionResultForUser({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role
    });
  }

  async completeOauthProviderCallback(input: {
    provider: OauthProvider;
    code: string;
    state: string;
    expectedState: string | null;
  }): Promise<{ identity: AuthIdentity; expiresAt: string }> {
    if (input.expectedState == null || input.expectedState !== input.state) {
      throw new UnauthorizedException("Invalid OAuth state.");
    }

    const providerIdentity = await this.exchangeProviderIdentity({
      provider: input.provider,
      code: input.code
    });
    const profileSnapshot = providerIdentity.profileSnapshot as Prisma.InputJsonValue;

    const normalizedEmail = typeof providerIdentity.email === "string" ? this.normalizeEmail(providerIdentity.email) : "";
    const now = new Date();

    const existingLink = await this.prisma.authIdentityLink.findUnique({
      where: {
        provider_subject: {
          provider: input.provider,
          subject: providerIdentity.subject
        }
      },
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            id: true,
            tenantId: true,
            role: true,
            status: true
          }
        }
      }
    });

    let user = existingLink?.user ?? null;
    if (user != null && user.status !== "active") {
      throw new UnauthorizedException("Linked account is inactive.");
    }

    if (user == null && normalizedEmail.length > 0) {
      user = await this.prisma.user.findUnique({
        where: {
          email: normalizedEmail
        },
        select: {
          id: true,
          tenantId: true,
          role: true,
          status: true
        }
      });

      if (user != null && user.status !== "active") {
        throw new UnauthorizedException("Account is inactive.");
      }
    }

    if (user == null) {
      const tenantId = this.resolveOauthDefaultTenantId();
      const tenant = await this.prisma.tenant.findUnique({
        where: {
          id: tenantId
        },
        select: {
          id: true
        }
      });

      if (tenant == null) {
        throw new ServiceUnavailableException("Default tenant is not available for OAuth login.");
      }

      const displayName = this.resolveOauthDisplayName(input.provider, providerIdentity.profileSnapshot, normalizedEmail);
      user = await this.prisma.user.create({
        data: {
          tenantId,
          name: displayName ?? `${input.provider}-${providerIdentity.subject}`,
          displayName,
          email: normalizedEmail.length > 0 ? normalizedEmail : null,
          status: "active"
        },
        select: {
          id: true,
          tenantId: true,
          role: true,
          status: true
        }
      });
    }

    if (existingLink == null) {
      await this.prisma.authIdentityLink.create({
        data: {
          userId: user.id,
          provider: input.provider,
          subject: providerIdentity.subject,
          emailSnapshot: normalizedEmail.length > 0 ? normalizedEmail : null,
          profileSnapshot,
          lastLoginAt: now
        }
      });
    } else {
      await this.prisma.authIdentityLink.update({
        where: {
          id: existingLink.id
        },
        data: {
          userId: user.id,
          emailSnapshot: normalizedEmail.length > 0 ? normalizedEmail : null,
          profileSnapshot,
          lastLoginAt: now
        }
      });
    }

    await this.ensureDefaultWorkspaceForUser({
      userId: user.id,
      tenantId: user.tenantId
    });

    return this.createSessionResultForUser({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      now
    });
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

  getAuthProviders(): {
    local: {
      enabled: true;
      defaultCredentials: {
        email: string;
        password: string;
      } | null;
    };
    oauth: Record<OauthProvider, {
      configured: boolean;
      requiredEnv: string[];
    }>;
  } {
    const isDevelopmentLike = process.env.NODE_ENV !== "production";
    const configuredLocalEmail = (process.env.AUTH_DEV_DEFAULT_USER_EMAIL ?? DEFAULT_DEV_LOGIN_EMAIL).trim();
    const configuredLocalPassword = (process.env.AUTH_DEV_DEFAULT_USER_PASSWORD ?? DEFAULT_DEV_LOGIN_PASSWORD).trim();

    return {
      local: {
        enabled: true,
        defaultCredentials:
          isDevelopmentLike && isAuthDevDefaultUserModeEnabled() && configuredLocalEmail.length > 0 && configuredLocalPassword.length > 0
            ? {
                email: configuredLocalEmail,
                password: configuredLocalPassword
              }
            : null
      },
      oauth: {
        github: {
          configured: this.hasRequiredEnvValues(["AUTH_GITHUB_CLIENT_ID", "AUTH_GITHUB_CLIENT_SECRET", "AUTH_GITHUB_REDIRECT_URI"]),
          requiredEnv: ["AUTH_GITHUB_CLIENT_ID", "AUTH_GITHUB_CLIENT_SECRET", "AUTH_GITHUB_REDIRECT_URI"]
        },
        google: {
          configured: this.hasRequiredEnvValues(["AUTH_GOOGLE_CLIENT_ID", "AUTH_GOOGLE_CLIENT_SECRET", "AUTH_GOOGLE_REDIRECT_URI"]),
          requiredEnv: ["AUTH_GOOGLE_CLIENT_ID", "AUTH_GOOGLE_CLIENT_SECRET", "AUTH_GOOGLE_REDIRECT_URI"]
        },
        oidc: {
          configured: this.hasRequiredEnvValues(["AUTH_OIDC_ISSUER", "AUTH_OIDC_CLIENT_ID", "AUTH_OIDC_CLIENT_SECRET", "AUTH_OIDC_REDIRECT_URI"]),
          requiredEnv: ["AUTH_OIDC_ISSUER", "AUTH_OIDC_CLIENT_ID", "AUTH_OIDC_CLIENT_SECRET", "AUTH_OIDC_REDIRECT_URI"]
        }
      }
    };
  }

  getMe(input: {
    authContext?: RequestAuthContext | null;
    loginProvenanceHint?: string | null;
  }): {
    identity: AuthIdentity | null;
    currentIdentity: AuthIdentity;
    loginProvenance: AuthMeLoginProvenance;
  } {
    const identity = input.authContext?.identity ?? null;

    return {
      identity,
      currentIdentity: resolveCurrentAuthIdentity({ identity }),
      loginProvenance: this.resolveLoginProvenance({
        authSource: identity?.authSource ?? null,
        loginProvenanceHint: input.loginProvenanceHint ?? null
      })
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

  private resolveLoginProvenance(input: {
    authSource: AuthIdentity["authSource"] | null;
    loginProvenanceHint: string | null;
  }): AuthMeLoginProvenance {
    if (input.loginProvenanceHint === "github" || input.loginProvenanceHint === "google" || input.loginProvenanceHint === "oidc") {
      return {
        type: "oauth_session",
        oauthProvider: input.loginProvenanceHint
      };
    }

    if (input.authSource === "github" || input.authSource === "google" || input.authSource === "oidc") {
      const oauthProvider = input.authSource as Extract<AuthMeLoginProvenance["oauthProvider"], string>;
      return {
        type: "oauth_session",
        oauthProvider
      };
    }

    return {
      type: "local_session",
      oauthProvider: null
    };
  }

  private resolveSessionTtlMs(): number {
    const rawTtlHours = (process.env.AUTH_SESSION_TTL_HOURS ?? `${DEFAULT_AUTH_SESSION_TTL_HOURS}`).trim();
    const parsed = Number.parseInt(rawTtlHours, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_AUTH_SESSION_TTL_HOURS * 60 * 60 * 1000;
    }

    return parsed * 60 * 60 * 1000;
  }

  private async createSessionResultForUser(input: {
    userId: string;
    tenantId: string;
    role: AuthIdentity["role"];
    now?: Date;
  }): Promise<{ identity: AuthIdentity; expiresAt: string }> {
    const now = input.now ?? new Date();
    const expiresAt = new Date(now.getTime() + this.resolveSessionTtlMs());
    const session = await this.prisma.authSession.create({
      data: {
        userId: input.userId,
        expiresAt,
        lastSeenAt: now
      },
      select: {
        id: true
      }
    });

    return {
      identity: {
        userId: input.userId,
        tenantId: input.tenantId,
        role: input.role,
        sessionId: session.id,
        authSource: "session"
      },
      expiresAt: expiresAt.toISOString()
    };
  }

  private async ensureDefaultWorkspaceForUser(input: {
    userId: string;
    tenantId: string;
  }) {
    if (
      this.prisma.knowledgeBase == null ||
      this.prisma.retrievalProfile == null ||
      this.prisma.assistant == null ||
      typeof this.prisma.knowledgeBase.findFirst !== "function" ||
      typeof this.prisma.knowledgeBase.create !== "function" ||
      typeof this.prisma.retrievalProfile.findFirst !== "function" ||
      typeof this.prisma.retrievalProfile.create !== "function" ||
      typeof this.prisma.assistant.findFirst !== "function" ||
      typeof this.prisma.assistant.create !== "function"
    ) {
      return;
    }

    const existingKnowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: {
        tenantId: input.tenantId,
        ownerId: input.userId
      },
      select: {
        id: true
      }
    });

    const knowledgeBase = existingKnowledgeBase ?? await this.prisma.knowledgeBase.create({
      data: {
        tenantId: input.tenantId,
        ownerId: input.userId,
        name: "Personal Knowledge Base",
        description: "Default knowledge base created for OAuth login.",
        status: "active"
      },
      select: {
        id: true
      }
    });

    const existingRetrievalProfile = await this.prisma.retrievalProfile.findFirst({
      where: {
        tenantId: input.tenantId,
        ownerId: input.userId
      },
      select: {
        id: true
      }
    });

    const retrievalProfile = existingRetrievalProfile ?? await this.prisma.retrievalProfile.create({
      data: {
        tenantId: input.tenantId,
        ownerId: input.userId,
        name: "Default Retrieval Profile",
        topK: 3,
        chunkWindow: 0,
        enableHybrid: false,
        enableRerank: false,
        scoreThreshold: 0
      },
      select: {
        id: true
      }
    });

    const existingAssistant = await this.prisma.assistant.findFirst({
      where: {
        tenantId: input.tenantId,
        kbId: knowledgeBase.id
      },
      select: {
        id: true
      }
    });

    if (existingAssistant != null) {
      return;
    }

    await this.prisma.assistant.create({
      data: {
        tenantId: input.tenantId,
        kbId: knowledgeBase.id,
        name: "Default Assistant",
        description: "Default assistant created for OAuth login.",
        systemPrompt: "Answer using the retrieved knowledge base content and cite the source snippets.",
        retrievalProfileId: retrievalProfile.id,
        status: "active"
      },
      select: {
        id: true
      }
    });
  }

  private resolveOauthDefaultTenantId(): string {
    const configured = (process.env.AUTH_DEFAULT_TENANT_ID ?? "").trim();
    return configured.length > 0 ? configured : DEFAULT_DEV_TENANT_ID;
  }

  private exchangeProviderIdentity(input: {
    provider: OauthProvider;
    code: string;
  }): Promise<{
    subject: string;
    email: string | null;
    profileSnapshot: Record<string, unknown>;
  }> {
    if (input.provider === "github") {
      return this.githubOauthProvider.exchangeCodeForIdentity({
        code: input.code
      });
    }

    if (input.provider === "google") {
      return this.googleOauthProvider.exchangeCodeForIdentity({
        code: input.code
      });
    }

    return this.oidcOauthProvider.exchangeCodeForIdentity({
      code: input.code
    });
  }

  private resolveOauthDisplayName(
    provider: OauthProvider,
    profileSnapshot: Record<string, unknown>,
    normalizedEmail: string
  ): string | null {
    if (provider === "github") {
      return this.resolveGithubDisplayName(profileSnapshot);
    }

    if (provider === "google") {
      return this.resolveGoogleDisplayName(profileSnapshot, normalizedEmail);
    }

    return this.resolveOidcDisplayName(profileSnapshot, normalizedEmail);
  }

  private resolveGithubDisplayName(profileSnapshot: Record<string, unknown>): string | null {
    const fromName = typeof profileSnapshot.name === "string" ? profileSnapshot.name.trim() : "";
    if (fromName.length > 0) {
      return fromName;
    }

    const fromLogin = typeof profileSnapshot.login === "string" ? profileSnapshot.login.trim() : "";
    return fromLogin.length > 0 ? fromLogin : null;
  }

  private resolveGoogleDisplayName(profileSnapshot: Record<string, unknown>, normalizedEmail: string): string | null {
    const fromName = typeof profileSnapshot.name === "string" ? profileSnapshot.name.trim() : "";
    if (fromName.length > 0) {
      return fromName;
    }

    const fromGivenFamily = [profileSnapshot.given_name, profileSnapshot.family_name]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0)
      .join(" ")
      .trim();
    if (fromGivenFamily.length > 0) {
      return fromGivenFamily;
    }

    if (normalizedEmail.length > 0) {
      const localPart = normalizedEmail.split("@")[0]?.trim() ?? "";
      return localPart.length > 0 ? localPart : null;
    }

    return null;
  }

  private resolveOidcDisplayName(profileSnapshot: Record<string, unknown>, normalizedEmail: string): string | null {
    const fromName = typeof profileSnapshot.name === "string" ? profileSnapshot.name.trim() : "";
    if (fromName.length > 0) {
      return fromName;
    }

    const fromPreferredUsername =
      typeof profileSnapshot.preferred_username === "string" ? profileSnapshot.preferred_username.trim() : "";
    if (fromPreferredUsername.length > 0) {
      return fromPreferredUsername;
    }

    const fromGivenFamily = [profileSnapshot.given_name, profileSnapshot.family_name]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0)
      .join(" ")
      .trim();
    if (fromGivenFamily.length > 0) {
      return fromGivenFamily;
    }

    if (normalizedEmail.length > 0) {
      const localPart = normalizedEmail.split("@")[0]?.trim() ?? "";
      return localPart.length > 0 ? localPart : null;
    }

    return null;
  }

  private resolveOauthStartConfig(provider: Exclude<OauthProvider, "oidc">, state: string): {
    authorizeUrl: string;
    queryParams: Record<string, string>;
    stateCookieName: string;
    stateTtlSeconds: number;
  } {
    if (provider === "github") {
      return this.resolveGithubOauthConfig(state);
    }

    return this.resolveGoogleOauthConfig(state);
  }

  private resolveGithubOauthConfig(state: string): {
    authorizeUrl: string;
    queryParams: Record<string, string>;
    stateCookieName: string;
    stateTtlSeconds: number;
  } {
    const clientId = (process.env.AUTH_GITHUB_CLIENT_ID ?? "").trim();
    const redirectUri = (process.env.AUTH_GITHUB_REDIRECT_URI ?? "").trim();

    if (clientId.length === 0 || redirectUri.length === 0) {
      throw new ServiceUnavailableException(
        "GitHub OAuth start is not configured. Required env: AUTH_GITHUB_CLIENT_ID, AUTH_GITHUB_REDIRECT_URI."
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
      authorizeUrl,
      queryParams: {
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state
      },
      stateCookieName,
      stateTtlSeconds
    };
  }

  private resolveGoogleOauthConfig(state: string): {
    authorizeUrl: string;
    queryParams: Record<string, string>;
    stateCookieName: string;
    stateTtlSeconds: number;
  } {
    const clientId = (process.env.AUTH_GOOGLE_CLIENT_ID ?? "").trim();
    const redirectUri = (process.env.AUTH_GOOGLE_REDIRECT_URI ?? "").trim();

    if (clientId.length === 0 || redirectUri.length === 0) {
      throw new ServiceUnavailableException(
        "Google OAuth start is not configured. Required env: AUTH_GOOGLE_CLIENT_ID, AUTH_GOOGLE_REDIRECT_URI."
      );
    }

    const authorizeUrl = (process.env.AUTH_GOOGLE_AUTHORIZE_URL ?? DEFAULT_GOOGLE_OAUTH_AUTHORIZE_URL).trim();
    const scope = (process.env.AUTH_GOOGLE_SCOPE ?? "openid email profile").trim() || "openid email profile";
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
      authorizeUrl,
      queryParams: {
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state,
        response_type: "code"
      },
      stateCookieName,
      stateTtlSeconds
    };
  }

  private async resolveOidcOauthStartConfig(input: {
    discoveryUrl: string;
    clientId: string;
    redirectUri: string;
    scope: string;
    stateCookieName: string;
    stateTtlSeconds: number;
    state: string;
  }): Promise<{
    authorizeUrl: string;
    queryParams: Record<string, string>;
    stateCookieName: string;
    stateTtlSeconds: number;
  }> {
    const discoveryResponse = await fetch(input.discoveryUrl);
    if (!discoveryResponse.ok) {
      throw new ServiceUnavailableException("OIDC OAuth start is not configured. Failed to resolve authorization endpoint.");
    }

    const discoveryPayload = (await discoveryResponse.json()) as {
      authorization_endpoint?: unknown;
    };
    const authorizationEndpoint =
      typeof discoveryPayload.authorization_endpoint === "string"
        ? discoveryPayload.authorization_endpoint.trim()
        : "";

    if (authorizationEndpoint.length === 0) {
      throw new ServiceUnavailableException(
        "OIDC OAuth start is not configured. Discovery metadata is missing authorization_endpoint."
      );
    }

    return {
      authorizeUrl: authorizationEndpoint,
      queryParams: {
        client_id: input.clientId,
        redirect_uri: input.redirectUri,
        scope: input.scope,
        state: input.state,
        response_type: "code"
      },
      stateCookieName: input.stateCookieName,
      stateTtlSeconds: input.stateTtlSeconds
    };
  }

  private generateOauthState(): string {
    return randomBytes(24).toString("base64url");
  }

  private hasRequiredEnvValues(keys: string[]): boolean {
    return keys.every(key => {
      const value = process.env[key];
      return typeof value === "string" && value.trim().length > 0;
    });
  }
}
