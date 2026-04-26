import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { compare } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../infra/database/prisma.service';
import { signAccessJwt, verifyAccessJwt } from './access-jwt';
import {
  resolveCurrentAuthIdentity,
  type AuthIdentity,
  type RequestAuthContext
} from './auth-identity.contract';
import {
  evaluateOwnerResourceAccess,
  type ResourceAccessPolicyInput
} from './resource-access-policy.contract';
import type { AuthMeLoginProvenance, OauthProvider } from './auth.schemas';
import {
  GITHUB_OAUTH_PROVIDER,
  HttpGithubOauthProvider,
  type GithubOauthProvider
} from './github-oauth.provider';
import {
  GOOGLE_OAUTH_PROVIDER,
  HttpGoogleOauthProvider,
  type GoogleOauthProvider
} from './google-oauth.provider';
import {
  HttpOidcOauthProvider,
  OIDC_OAUTH_PROVIDER,
  type OidcOauthProvider
} from './oidc-oauth.provider';
import { AuthRuntimeConfigService } from './auth-runtime-config';
import type { AuthUserSnapshot } from './auth-session.store';

type AuthWriteClient = Prisma.TransactionClient | PrismaService;
type SessionResult = {
  identity: AuthIdentity;
  user: AuthUserSnapshot;
  expiresAt: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
};

const DEFAULT_PRIMARY_KB_NAME = 'Default Knowledge Base';
const DEFAULT_PRIMARY_KB_DESCRIPTION =
  'Primary knowledge base for the default assistant.';
const DEFAULT_RETRIEVAL_PROFILE_NAME = 'Default Retrieval Profile';
const DEFAULT_ASSISTANT_TEMPLATE = {
  name: 'Default Assistant',
  description: 'Default assistant for the primary knowledge base.',
  systemPrompt:
    'Answer only from the retrieved knowledge base content. If the retrieved sources explicitly contain the answer, answer directly and cite the supporting snippets. Only say the information is insufficient when the retrieved sources still do not support a reliable answer.'
} as const;

type DefaultAssistantCandidate = {
  id: string;
  kbId: string;
  retrievalProfileId: string;
  status: 'active' | 'inactive';
  name?: string;
};

type DefaultAssistantSelectionPreference = {
  retrievalProfileId?: string;
};

type DefaultKnowledgeBaseCandidate = {
  id: string;
  status?: 'active' | 'inactive';
  name?: string;
};

type DefaultRetrievalProfileCandidate = {
  id: string;
  name?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(GITHUB_OAUTH_PROVIDER)
    private readonly githubOauthProvider: GithubOauthProvider = new HttpGithubOauthProvider(),
    @Inject(GOOGLE_OAUTH_PROVIDER)
    private readonly googleOauthProvider: GoogleOauthProvider = new HttpGoogleOauthProvider(),
    @Inject(OIDC_OAUTH_PROVIDER)
    private readonly oidcOauthProvider: OidcOauthProvider = new HttpOidcOauthProvider(),
    private readonly authRuntimeConfig: AuthRuntimeConfigService = new AuthRuntimeConfigService()
  ) {}

  async startOauthProvider(input: { provider: OauthProvider }): Promise<{
    provider: 'github' | 'google' | 'oidc';
    redirectUrl: string;
    state: string;
    stateCookieName: string;
    stateTtlSeconds: number;
  }> {
    const state = this.generateOauthState();
    const providerConfig =
      input.provider === 'oidc'
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

  async login(input: {
    email: string;
    password: string;
  }): Promise<SessionResult> {
    const email = this.normalizeEmail(input.email);
    if (email.length === 0 || input.password.length === 0) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        email
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        displayName: true,
        email: true,
        role: true,
        status: true,
        passwordHash: true
      }
    });

    if (
      user == null ||
      user.status !== 'active' ||
      typeof user.passwordHash !== 'string' ||
      user.passwordHash.length === 0
    ) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const passwordMatched = await compare(input.password, user.passwordHash);
    if (!passwordMatched) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.createSessionResultForUser({
      user: this.toAuthUserSnapshot(user),
      authSource: 'local'
    });
  }

  async completeOauthProviderCallback(input: {
    provider: OauthProvider;
    code: string;
    state: string;
    expectedState: string | null;
  }): Promise<SessionResult> {
    if (input.expectedState == null || input.expectedState !== input.state) {
      throw new UnauthorizedException('Invalid OAuth state.');
    }

    const providerIdentity = await this.exchangeProviderIdentity({
      provider: input.provider,
      code: input.code
    });
    const profileSnapshot =
      providerIdentity.profileSnapshot as Prisma.InputJsonValue;

    const normalizedEmail =
      typeof providerIdentity.email === 'string'
        ? this.normalizeEmail(providerIdentity.email)
        : '';
    const now = new Date();

    return this.runAuthWriteTransaction(async (prisma) => {
      const existingLink = await prisma.authIdentityLink.findUnique({
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
              name: true,
              displayName: true,
              email: true,
              role: true,
              status: true
            }
          }
        }
      });

      let user = existingLink?.user ?? null;
      if (user != null && user.status !== 'active') {
        throw new UnauthorizedException('Linked account is inactive.');
      }

      if (user == null && normalizedEmail.length > 0) {
        user = await prisma.user.findUnique({
          where: {
            email: normalizedEmail
          },
          select: {
            id: true,
            tenantId: true,
            name: true,
            displayName: true,
            email: true,
            role: true,
            status: true
          }
        });

        if (user != null && user.status !== 'active') {
          throw new UnauthorizedException('Account is inactive.');
        }
      }

      if (user == null) {
        const tenantId = this.resolveOauthDefaultTenantId();
        const tenant = await prisma.tenant.findUnique({
          where: {
            id: tenantId
          },
          select: {
            id: true
          }
        });

        if (tenant == null) {
          throw new ServiceUnavailableException(
            'Default tenant is not available for OAuth login.'
          );
        }

        const displayName = this.resolveOauthDisplayName(
          input.provider,
          providerIdentity.profileSnapshot,
          normalizedEmail
        );
        user = await prisma.user.create({
          data: {
            tenantId,
            name:
              displayName ?? `${input.provider}-${providerIdentity.subject}`,
            displayName,
            email: normalizedEmail.length > 0 ? normalizedEmail : null,
            status: 'active'
          },
          select: {
            id: true,
            tenantId: true,
            name: true,
            displayName: true,
            email: true,
            role: true,
            status: true
          }
        });
      }

      if (existingLink == null) {
        await prisma.authIdentityLink.create({
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
        await prisma.authIdentityLink.update({
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

      await this.ensureDefaultWorkspaceForUser(
        {
          userId: user.id,
          tenantId: user.tenantId
        },
        prisma
      );

      return this.createSessionResultForUser({
        user: this.toAuthUserSnapshot(user),
        authSource: input.provider,
        now
      });
    });
  }

  private runAuthWriteTransaction<T>(
    callback: (prisma: AuthWriteClient) => Promise<T>
  ): Promise<T> {
    if (typeof this.prisma.$transaction !== 'function') {
      return callback(this.prisma);
    }

    return this.prisma.$transaction(async (prisma) =>
      callback(prisma as AuthWriteClient)
    );
  }

  async logout(): Promise<{ ok: true }> {
    return { ok: true };
  }

  async refreshAccessToken(input: { refreshToken?: string | null }): Promise<{
    identity: AuthIdentity;
    user: AuthUserSnapshot;
    accessToken: string;
    accessTokenExpiresAt: string;
    refreshToken: string;
    expiresAt: string;
  }> {
    const refreshToken =
      typeof input.refreshToken === 'string' ? input.refreshToken.trim() : '';
    if (refreshToken.length === 0) {
      throw new UnauthorizedException('Refresh token is missing.');
    }

    const payload = this.verifyRefreshToken(refreshToken);
    if (payload == null) {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        displayName: true,
        email: true,
        role: true,
        status: true
      }
    });

    if (user == null || user.status !== 'active') {
      throw new UnauthorizedException('Account is unavailable.');
    }

    const userSnapshot = this.toAuthUserSnapshot(user);
    const identity = this.buildJwtIdentity({
      user: userSnapshot,
      authSource: this.normalizeJwtAuthSource(payload.authSource)
    });
    const accessToken = this.issueAccessToken(identity);
    const nextRefreshToken = this.issueRefreshToken(identity);
    return {
      identity,
      user: userSnapshot,
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt,
      refreshToken: nextRefreshToken.token,
      expiresAt: nextRefreshToken.expiresAt
    };
  }

  getAuthProviders(): {
    local: {
      enabled: true;
      defaultCredentials: {
        email: string;
        password: string;
      } | null;
    };
    oauth: Record<
      OauthProvider,
      {
        configured: boolean;
        requiredEnv: string[];
      }
    >;
  } {
    const config = this.authRuntimeConfig.getConfig();

    return {
      local: {
        enabled: true,
        defaultCredentials:
          config.isDevelopmentLike &&
          config.localDevCredentials.enabled &&
          config.localDevCredentials.email.length > 0 &&
          config.localDevCredentials.password.length > 0
            ? {
                email: config.localDevCredentials.email,
                password: config.localDevCredentials.password
              }
            : null
      },
      oauth: {
        github: {
          configured:
            config.github.clientId.length > 0 &&
            config.github.clientSecret.length > 0 &&
            config.github.redirectUri.length > 0,
          requiredEnv: [
            'AUTH_GITHUB_CLIENT_ID',
            'AUTH_GITHUB_CLIENT_SECRET',
            'AUTH_GITHUB_REDIRECT_URI'
          ]
        },
        google: {
          configured:
            config.google.clientId.length > 0 &&
            config.google.clientSecret.length > 0 &&
            config.google.redirectUri.length > 0,
          requiredEnv: [
            'AUTH_GOOGLE_CLIENT_ID',
            'AUTH_GOOGLE_CLIENT_SECRET',
            'AUTH_GOOGLE_REDIRECT_URI'
          ]
        },
        oidc: {
          configured:
            config.oidc.issuer.length > 0 &&
            config.oidc.clientId.length > 0 &&
            config.oidc.clientSecret.length > 0 &&
            config.oidc.redirectUri.length > 0,
          requiredEnv: [
            'AUTH_OIDC_ISSUER',
            'AUTH_OIDC_CLIENT_ID',
            'AUTH_OIDC_CLIENT_SECRET',
            'AUTH_OIDC_REDIRECT_URI'
          ]
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
    action: ResourceAccessPolicyInput['action'];
    resource: ResourceAccessPolicyInput['resource'];
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
    authSource: AuthIdentity['authSource'] | null;
    loginProvenanceHint: string | null;
  }): AuthMeLoginProvenance {
    if (
      input.loginProvenanceHint === 'github' ||
      input.loginProvenanceHint === 'google' ||
      input.loginProvenanceHint === 'oidc'
    ) {
      return {
        type: 'oauth_session',
        oauthProvider: input.loginProvenanceHint
      };
    }

    if (
      input.authSource === 'github' ||
      input.authSource === 'google' ||
      input.authSource === 'oidc'
    ) {
      const oauthProvider = input.authSource as Extract<
        AuthMeLoginProvenance['oauthProvider'],
        string
      >;
      return {
        type: 'oauth_session',
        oauthProvider
      };
    }

    return {
      type: 'local_session',
      oauthProvider: null
    };
  }

  private resolveSessionTtlMs(): number {
    return this.authRuntimeConfig.getConfig().sessionTtlHours * 60 * 60 * 1000;
  }

  private resolveAccessJwtTtlMs(): number {
    return this.authRuntimeConfig.getConfig().accessJwtTtlMinutes * 60 * 1000;
  }

  private async createSessionResultForUser(input: {
    user: AuthUserSnapshot;
    authSource?: AuthIdentity['authSource'];
    now?: Date;
  }): Promise<SessionResult> {
    const now = input.now ?? new Date();
    const identity = this.buildJwtIdentity({
      user: input.user,
      authSource: input.authSource ?? 'local'
    });
    const accessToken = this.issueAccessToken(identity, now);
    const refreshToken = this.issueRefreshToken(identity, now);

    return {
      identity,
      user: input.user,
      expiresAt: refreshToken.expiresAt,
      accessToken: accessToken.token,
      accessTokenExpiresAt: accessToken.expiresAt,
      refreshToken: refreshToken.token
    };
  }

  private toAuthUserSnapshot(user: {
    id: string;
    tenantId: string;
    name: string;
    displayName: string | null;
    email: string | null;
    role: AuthIdentity['role'];
  }): AuthUserSnapshot {
    return {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      name: user.name,
      displayName: user.displayName,
      email: user.email
    };
  }

  private issueAccessToken(
    identity: AuthIdentity,
    now = new Date()
  ): {
    token: string;
    expiresAt: string;
  } {
    const config = this.authRuntimeConfig.getConfig();
    if (config.accessJwtSecret.length === 0) {
      throw new ServiceUnavailableException(
        'AUTH_ACCESS_JWT_SECRET is not configured.'
      );
    }

    const expiresAt = new Date(now.getTime() + this.resolveAccessJwtTtlMs());
    return {
      token: signAccessJwt({
        secret: config.accessJwtSecret,
        userId: identity.userId,
        tenantId: identity.tenantId,
        role: identity.role,
        authSource: identity.authSource,
        issuedAtSeconds: Math.floor(now.getTime() / 1000),
        expiresAtSeconds: Math.floor(expiresAt.getTime() / 1000),
        tokenType: 'access'
      }),
      expiresAt: expiresAt.toISOString()
    };
  }

  private issueRefreshToken(identity: AuthIdentity, now = new Date()) {
    const config = this.authRuntimeConfig.getConfig();
    const expiresAt = new Date(now.getTime() + this.resolveSessionTtlMs());
    return {
      token: signAccessJwt({
        secret: config.accessJwtSecret,
        userId: identity.userId,
        tenantId: identity.tenantId,
        role: identity.role,
        authSource: identity.authSource,
        issuedAtSeconds: Math.floor(now.getTime() / 1000),
        expiresAtSeconds: Math.floor(expiresAt.getTime() / 1000),
        tokenType: 'refresh'
      }),
      expiresAt: expiresAt.toISOString()
    };
  }

  private verifyRefreshToken(token: string) {
    const config = this.authRuntimeConfig.getConfig();
    if (config.accessJwtSecret.length === 0) {
      return null;
    }

    return verifyAccessJwt({
      token,
      secret: config.accessJwtSecret,
      expectedType: 'refresh'
    });
  }

  private buildJwtIdentity(input: {
    user: AuthUserSnapshot;
    authSource: AuthIdentity['authSource'];
  }): AuthIdentity {
    return {
      userId: input.user.id,
      tenantId: input.user.tenantId,
      role: input.user.role,
      sessionId: null,
      authSource: input.authSource
    };
  }

  private normalizeJwtAuthSource(
    authSource: string
  ): AuthIdentity['authSource'] {
    if (
      authSource === 'github' ||
      authSource === 'google' ||
      authSource === 'oidc' ||
      authSource === 'local'
    ) {
      return authSource;
    }

    return 'local';
  }

  private async ensureDefaultWorkspaceForUser(
    input: {
      userId: string;
      tenantId: string;
    },
    prisma: AuthWriteClient
  ) {
    if (
      prisma.knowledgeBase == null ||
      prisma.retrievalProfile == null ||
      prisma.assistant == null ||
      typeof prisma.knowledgeBase.findFirst !== 'function' ||
      typeof prisma.knowledgeBase.create !== 'function' ||
      typeof prisma.retrievalProfile.findFirst !== 'function' ||
      typeof prisma.retrievalProfile.create !== 'function' ||
      typeof prisma.assistant.create !== 'function'
    ) {
      return;
    }

    const existingKnowledgeBase =
      typeof prisma.knowledgeBase.findMany === 'function'
        ? ((
            await prisma.knowledgeBase.findMany({
              where: {
                tenantId: input.tenantId,
                ownerId: input.userId
              },
              select: {
                id: true,
                status: true,
                name: true
              }
            })
          )
            .slice()
            .sort(compareCanonicalPrimaryKnowledgeBaseCandidate)[0] ?? null)
        : await prisma.knowledgeBase.findFirst({
            where: {
              tenantId: input.tenantId,
              ownerId: input.userId
            },
            select: {
              id: true
            }
          });

    const knowledgeBase =
      existingKnowledgeBase ??
      (await prisma.knowledgeBase.create({
        data: {
          tenantId: input.tenantId,
          ownerId: input.userId,
          name: DEFAULT_PRIMARY_KB_NAME,
          description: DEFAULT_PRIMARY_KB_DESCRIPTION,
          status: 'active'
        },
        select: {
          id: true
        }
      }));

    const existingRetrievalProfile =
      typeof prisma.retrievalProfile.findMany === 'function'
        ? ((
            await prisma.retrievalProfile.findMany({
              where: {
                tenantId: input.tenantId,
                ownerId: input.userId
              },
              select: {
                id: true,
                name: true
              }
            })
          )
            .slice()
            .sort(compareCanonicalDefaultRetrievalProfileCandidate)[0] ?? null)
        : await prisma.retrievalProfile.findFirst({
            where: {
              tenantId: input.tenantId,
              ownerId: input.userId
            },
            select: {
              id: true
            }
          });

    const retrievalProfile =
      existingRetrievalProfile ??
      (await prisma.retrievalProfile.create({
        data: {
          tenantId: input.tenantId,
          ownerId: input.userId,
          name: DEFAULT_RETRIEVAL_PROFILE_NAME,
          topK: 3,
          chunkWindow: 0,
          enableHybrid: false,
          enableRerank: false,
          scoreThreshold: 0
        },
        select: {
          id: true
        }
      }));

    const existingAssistantForPrimaryKb =
      await this.findCanonicalAssistantCandidate(
        {
          tenantId: input.tenantId,
          kbId: knowledgeBase.id
        },
        prisma,
        {
          retrievalProfileId: retrievalProfile.id
        }
      );

    const existingAssistantForOwner =
      await this.findCanonicalAssistantCandidate(
        {
          tenantId: input.tenantId,
          knowledgeBase: {
            ownerId: input.userId
          }
        },
        prisma,
        {
          retrievalProfileId: retrievalProfile.id
        }
      );

    const existingAssistant = selectCanonicalDefaultAssistantForRepair({
      assistantForPrimaryKnowledgeBase: existingAssistantForPrimaryKb,
      assistantForOwner: existingAssistantForOwner
    });

    if (existingAssistant == null) {
      await prisma.assistant.create({
        data: {
          tenantId: input.tenantId,
          kbId: knowledgeBase.id,
          name: DEFAULT_ASSISTANT_TEMPLATE.name,
          description: DEFAULT_ASSISTANT_TEMPLATE.description,
          systemPrompt: DEFAULT_ASSISTANT_TEMPLATE.systemPrompt,
          retrievalProfileId: retrievalProfile.id,
          status: 'active'
        },
        select: {
          id: true
        }
      });
      return;
    }

    if (
      existingAssistant.kbId === knowledgeBase.id &&
      existingAssistant.retrievalProfileId === retrievalProfile.id &&
      existingAssistant.status === 'active'
    ) {
      return;
    }

    if (typeof prisma.assistant.update !== 'function') {
      return;
    }

    await prisma.assistant.update({
      where: {
        id: existingAssistant.id
      },
      data: {
        kbId: knowledgeBase.id,
        retrievalProfileId: retrievalProfile.id,
        status: 'active'
      },
      select: {
        id: true
      }
    });
  }

  private async findCanonicalAssistantCandidate(
    where: Prisma.AssistantWhereInput,
    prisma: AuthWriteClient,
    preference?: DefaultAssistantSelectionPreference
  ): Promise<DefaultAssistantCandidate | null> {
    if (typeof prisma.assistant.findMany === 'function') {
      const candidates = await prisma.assistant.findMany({
        where,
        select: {
          id: true,
          kbId: true,
          retrievalProfileId: true,
          status: true,
          name: true
        }
      });

      if (candidates.length === 0) {
        return null;
      }

      return candidates
        .slice()
        .sort((left, right) =>
          compareCanonicalDefaultAssistantCandidate(left, right, preference)
        )[0];
    }

    if (typeof prisma.assistant.findFirst !== 'function') {
      return null;
    }

    const canonicalDefaultNamedPreferredCandidate =
      typeof preference?.retrievalProfileId === 'string'
        ? await prisma.assistant.findFirst({
            where: {
              AND: [
                where,
                {
                  name: DEFAULT_ASSISTANT_TEMPLATE.name
                },
                {
                  retrievalProfileId: preference.retrievalProfileId
                }
              ]
            },
            orderBy: {
              id: 'asc'
            },
            select: {
              id: true,
              kbId: true,
              retrievalProfileId: true,
              status: true
            }
          })
        : null;

    if (canonicalDefaultNamedPreferredCandidate != null) {
      return canonicalDefaultNamedPreferredCandidate;
    }

    const defaultNamedFallbackCandidate = await prisma.assistant.findFirst({
      where: {
        AND: [
          where,
          {
            name: DEFAULT_ASSISTANT_TEMPLATE.name
          }
        ]
      },
      orderBy: {
        id: 'asc'
      },
      select: {
        id: true,
        kbId: true,
        retrievalProfileId: true,
        status: true
      }
    });

    if (defaultNamedFallbackCandidate != null) {
      return defaultNamedFallbackCandidate;
    }

    const fallbackCandidate = await prisma.assistant.findFirst({
      where,
      orderBy: {
        id: 'asc'
      },
      select: {
        id: true,
        kbId: true,
        retrievalProfileId: true,
        status: true
      }
    });

    return fallbackCandidate ?? null;
  }

  private resolveOauthDefaultTenantId(): string {
    return this.authRuntimeConfig.getConfig().defaultTenantId;
  }

  private exchangeProviderIdentity(input: {
    provider: OauthProvider;
    code: string;
  }): Promise<{
    subject: string;
    email: string | null;
    profileSnapshot: Record<string, unknown>;
  }> {
    if (input.provider === 'github') {
      return this.githubOauthProvider.exchangeCodeForIdentity({
        code: input.code
      });
    }

    if (input.provider === 'google') {
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
    if (provider === 'github') {
      return this.resolveGithubDisplayName(profileSnapshot);
    }

    if (provider === 'google') {
      return this.resolveGoogleDisplayName(profileSnapshot, normalizedEmail);
    }

    return this.resolveOidcDisplayName(profileSnapshot, normalizedEmail);
  }

  private resolveGithubDisplayName(
    profileSnapshot: Record<string, unknown>
  ): string | null {
    const fromName =
      typeof profileSnapshot.name === 'string'
        ? profileSnapshot.name.trim()
        : '';
    if (fromName.length > 0) {
      return fromName;
    }

    const fromLogin =
      typeof profileSnapshot.login === 'string'
        ? profileSnapshot.login.trim()
        : '';
    return fromLogin.length > 0 ? fromLogin : null;
  }

  private resolveGoogleDisplayName(
    profileSnapshot: Record<string, unknown>,
    normalizedEmail: string
  ): string | null {
    const fromName =
      typeof profileSnapshot.name === 'string'
        ? profileSnapshot.name.trim()
        : '';
    if (fromName.length > 0) {
      return fromName;
    }

    const fromGivenFamily = [
      profileSnapshot.given_name,
      profileSnapshot.family_name
    ]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0)
      .join(' ')
      .trim();
    if (fromGivenFamily.length > 0) {
      return fromGivenFamily;
    }

    if (normalizedEmail.length > 0) {
      const localPart = normalizedEmail.split('@')[0]?.trim() ?? '';
      return localPart.length > 0 ? localPart : null;
    }

    return null;
  }

  private resolveOidcDisplayName(
    profileSnapshot: Record<string, unknown>,
    normalizedEmail: string
  ): string | null {
    const fromName =
      typeof profileSnapshot.name === 'string'
        ? profileSnapshot.name.trim()
        : '';
    if (fromName.length > 0) {
      return fromName;
    }

    const fromPreferredUsername =
      typeof profileSnapshot.preferred_username === 'string'
        ? profileSnapshot.preferred_username.trim()
        : '';
    if (fromPreferredUsername.length > 0) {
      return fromPreferredUsername;
    }

    const fromGivenFamily = [
      profileSnapshot.given_name,
      profileSnapshot.family_name
    ]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value) => value.length > 0)
      .join(' ')
      .trim();
    if (fromGivenFamily.length > 0) {
      return fromGivenFamily;
    }

    if (normalizedEmail.length > 0) {
      const localPart = normalizedEmail.split('@')[0]?.trim() ?? '';
      return localPart.length > 0 ? localPart : null;
    }

    return null;
  }

  private resolveOauthStartConfig(
    provider: Exclude<OauthProvider, 'oidc'>,
    state: string
  ): {
    authorizeUrl: string;
    queryParams: Record<string, string>;
    stateCookieName: string;
    stateTtlSeconds: number;
  } {
    if (provider === 'github') {
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
    const config = this.authRuntimeConfig.getConfig();
    const clientId = config.github.clientId;
    const redirectUri = config.github.redirectUri;

    if (clientId.length === 0 || redirectUri.length === 0) {
      throw new ServiceUnavailableException(
        'GitHub OAuth start is not configured. Required env: AUTH_GITHUB_CLIENT_ID, AUTH_GITHUB_REDIRECT_URI.'
      );
    }

    return {
      authorizeUrl: config.github.authorizeUrl,
      queryParams: {
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: config.github.scope,
        state
      },
      stateCookieName: config.oauthStateCookieName,
      stateTtlSeconds: config.oauthStateTtlSeconds
    };
  }

  private resolveGoogleOauthConfig(state: string): {
    authorizeUrl: string;
    queryParams: Record<string, string>;
    stateCookieName: string;
    stateTtlSeconds: number;
  } {
    const config = this.authRuntimeConfig.getConfig();
    const clientId = config.google.clientId;
    const redirectUri = config.google.redirectUri;

    if (clientId.length === 0 || redirectUri.length === 0) {
      throw new ServiceUnavailableException(
        'Google OAuth start is not configured. Required env: AUTH_GOOGLE_CLIENT_ID, AUTH_GOOGLE_REDIRECT_URI.'
      );
    }

    return {
      authorizeUrl: config.google.authorizeUrl,
      queryParams: {
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: config.google.scope,
        state,
        response_type: 'code'
      },
      stateCookieName: config.oauthStateCookieName,
      stateTtlSeconds: config.oauthStateTtlSeconds
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
      throw new ServiceUnavailableException(
        'OIDC OAuth start is not configured. Failed to resolve authorization endpoint.'
      );
    }

    const discoveryPayload = (await discoveryResponse.json()) as {
      authorization_endpoint?: unknown;
    };
    const authorizationEndpoint =
      typeof discoveryPayload.authorization_endpoint === 'string'
        ? discoveryPayload.authorization_endpoint.trim()
        : '';

    if (authorizationEndpoint.length === 0) {
      throw new ServiceUnavailableException(
        'OIDC OAuth start is not configured. Discovery metadata is missing authorization_endpoint.'
      );
    }

    return {
      authorizeUrl: authorizationEndpoint,
      queryParams: {
        client_id: input.clientId,
        redirect_uri: input.redirectUri,
        scope: input.scope,
        state: input.state,
        response_type: 'code'
      },
      stateCookieName: input.stateCookieName,
      stateTtlSeconds: input.stateTtlSeconds
    };
  }

  private generateOauthState(): string {
    return randomBytes(24).toString('base64url');
  }
}

function compareCanonicalDefaultAssistantCandidate(
  left: DefaultAssistantCandidate,
  right: DefaultAssistantCandidate,
  preference?: DefaultAssistantSelectionPreference
) {
  const scoreDifference =
    scoreCanonicalDefaultAssistantCandidate(right, preference) -
    scoreCanonicalDefaultAssistantCandidate(left, preference);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return left.id.localeCompare(right.id);
}

function selectCanonicalDefaultAssistantForRepair(input: {
  assistantForPrimaryKnowledgeBase: DefaultAssistantCandidate | null;
  assistantForOwner: DefaultAssistantCandidate | null;
}) {
  if (isDefaultAssistantName(input.assistantForPrimaryKnowledgeBase?.name)) {
    return input.assistantForPrimaryKnowledgeBase;
  }

  if (isDefaultAssistantName(input.assistantForOwner?.name)) {
    return input.assistantForOwner;
  }

  return (
    input.assistantForPrimaryKnowledgeBase ?? input.assistantForOwner ?? null
  );
}

function compareCanonicalPrimaryKnowledgeBaseCandidate(
  left: DefaultKnowledgeBaseCandidate,
  right: DefaultKnowledgeBaseCandidate
) {
  const scoreDifference =
    scoreCanonicalPrimaryKnowledgeBaseCandidate(right) -
    scoreCanonicalPrimaryKnowledgeBaseCandidate(left);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return left.id.localeCompare(right.id);
}

function compareCanonicalDefaultRetrievalProfileCandidate(
  left: DefaultRetrievalProfileCandidate,
  right: DefaultRetrievalProfileCandidate
) {
  const scoreDifference =
    scoreCanonicalDefaultRetrievalProfileCandidate(right) -
    scoreCanonicalDefaultRetrievalProfileCandidate(left);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return left.id.localeCompare(right.id);
}

function scoreCanonicalDefaultAssistantCandidate(
  assistant: DefaultAssistantCandidate,
  preference?: DefaultAssistantSelectionPreference
) {
  let score = 0;

  if (isDefaultAssistantName(assistant.name)) {
    score += 100;
  }

  if (assistant.status === 'active') {
    score += 10;
  }

  if (
    typeof preference?.retrievalProfileId === 'string' &&
    assistant.retrievalProfileId === preference.retrievalProfileId
  ) {
    score += 50;
  }

  return score;
}

function scoreCanonicalPrimaryKnowledgeBaseCandidate(
  knowledgeBase: DefaultKnowledgeBaseCandidate
) {
  let score = 0;

  if (isDefaultPrimaryKnowledgeBaseName(knowledgeBase.name)) {
    score += 100;
  }

  if (knowledgeBase.status === 'active') {
    score += 10;
  }

  return score;
}

function scoreCanonicalDefaultRetrievalProfileCandidate(
  retrievalProfile: DefaultRetrievalProfileCandidate
) {
  let score = 0;

  if (isDefaultRetrievalProfileName(retrievalProfile.name)) {
    score += 100;
  }

  return score;
}

function isDefaultAssistantName(name: string | null | undefined) {
  return (
    typeof name === 'string' &&
    normalizeCanonicalDefaultName(name) ===
      normalizeCanonicalDefaultName(DEFAULT_ASSISTANT_TEMPLATE.name)
  );
}

function isDefaultPrimaryKnowledgeBaseName(name: string | null | undefined) {
  return (
    typeof name === 'string' &&
    normalizeCanonicalDefaultName(name) ===
      normalizeCanonicalDefaultName(DEFAULT_PRIMARY_KB_NAME)
  );
}

function isDefaultRetrievalProfileName(name: string | null | undefined) {
  return (
    typeof name === 'string' &&
    normalizeCanonicalDefaultName(name) ===
      normalizeCanonicalDefaultName(DEFAULT_RETRIEVAL_PROFILE_NAME)
  );
}

function normalizeCanonicalDefaultName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
