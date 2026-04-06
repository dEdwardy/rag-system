import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/database/prisma.service";
import type { AuthIdentity } from "./auth-identity.contract";
import { readNamedCookie } from "./auth-cookie.utils";
import type { AuthIdentityProvider, AuthProviderRequest } from "./auth-provider.contract";
import { AuthRuntimeConfigService } from "./auth-runtime-config";

const SESSION_LAST_SEEN_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const SESSION_IDENTITY_CACHE_TTL_MS = 10_000;

type CachedSessionIdentity = {
  identity: AuthIdentity;
  expiresAtMs: number;
  cachedAtMs: number;
};

@Injectable()
export class SessionCookieAuthProvider implements AuthIdentityProvider {
  private readonly identityCache = new Map<string, CachedSessionIdentity>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly authRuntimeConfig: AuthRuntimeConfigService = new AuthRuntimeConfigService()
  ) {}

  async resolveIdentity(input: { request: AuthProviderRequest }): Promise<AuthIdentity | null> {
    const sessionId = this.readSessionId(input.request.headers);
    if (sessionId == null) {
      return null;
    }

    return this.resolveSessionIdentityById(sessionId, {
      updateLastSeenAt: true
    });
  }

  async resolveSessionIdentityById(
    sessionId: string,
    options: {
      updateLastSeenAt: boolean;
    } = {
      updateLastSeenAt: true
    }
  ): Promise<AuthIdentity | null> {
    const cachedIdentity = this.readCachedIdentity(sessionId);
    if (cachedIdentity != null) {
      return cachedIdentity;
    }

    const session = await this.prisma.authSession.findUnique({
      where: {
        id: sessionId
      },
      include: {
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

    if (session == null) {
      return null;
    }

    if (session.revokedAt != null || session.expiresAt.getTime() <= Date.now()) {
      this.identityCache.delete(session.id);
      await this.markSessionRevoked(session.id, session.revokedAt);
      return null;
    }

    if (session.user.status !== "active") {
      this.identityCache.delete(session.id);
      await this.markSessionRevoked(session.id, session.revokedAt);
      return null;
    }

    const shouldRefreshLastSeenAt =
      options.updateLastSeenAt &&
      (session.lastSeenAt == null || Date.now() - session.lastSeenAt.getTime() >= SESSION_LAST_SEEN_UPDATE_INTERVAL_MS);

    if (shouldRefreshLastSeenAt) {
      await this.prisma.authSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null
        },
        data: {
          lastSeenAt: new Date()
        }
      });
    }

    const identity = {
      userId: session.user.id,
      tenantId: session.user.tenantId,
      role: session.user.role,
      sessionId,
      authSource: "session"
    };

    this.identityCache.set(sessionId, {
      identity,
      expiresAtMs: session.expiresAt.getTime(),
      cachedAtMs: Date.now()
    });

    return identity;
  }

  private readSessionId(headers?: AuthProviderRequest["headers"]): string | null {
    const cookieName = this.authRuntimeConfig.getConfig().sessionCookieName;
    if (!cookieName) {
      return null;
    }

    return readNamedCookie(headers, cookieName);
  }

  private async markSessionRevoked(sessionId: string, revokedAt: Date | null): Promise<void> {
    this.identityCache.delete(sessionId);

    if (revokedAt != null) {
      return;
    }

    await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  private readCachedIdentity(sessionId: string): AuthIdentity | null {
    const cachedEntry = this.identityCache.get(sessionId);
    if (cachedEntry == null) {
      return null;
    }

    const now = Date.now();
    if (cachedEntry.expiresAtMs <= now || now - cachedEntry.cachedAtMs >= SESSION_IDENTITY_CACHE_TTL_MS) {
      this.identityCache.delete(sessionId);
      return null;
    }

    return cachedEntry.identity;
  }
}
