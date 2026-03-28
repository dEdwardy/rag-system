import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/database/prisma.service";
import type { AuthIdentity } from "./auth-identity.contract";
import type { AuthIdentityProvider, AuthProviderRequest } from "./auth-provider.contract";
import { DEFAULT_AUTH_SESSION_COOKIE_NAME } from "./auth.constants";

@Injectable()
export class SessionCookieAuthProvider implements AuthIdentityProvider {
  constructor(private readonly prisma: PrismaService) {}

  async resolveIdentity(input: { request: AuthProviderRequest }): Promise<AuthIdentity | null> {
    const sessionId = this.readSessionId(input.request.headers);
    if (sessionId == null) {
      return null;
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
            status: true
          }
        }
      }
    });

    if (session == null) {
      return null;
    }

    if (session.revokedAt != null || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    if (session.user.status !== "active") {
      return null;
    }

    return {
      userId: session.user.id,
      tenantId: session.user.tenantId,
      sessionId,
      authSource: "session"
    };
  }

  private readSessionId(headers?: AuthProviderRequest["headers"]): string | null {
    const rawCookieHeader = this.readHeaderString(headers, "cookie");
    if (rawCookieHeader == null) {
      return null;
    }

    const cookieName = (process.env.AUTH_SESSION_COOKIE_NAME ?? DEFAULT_AUTH_SESSION_COOKIE_NAME).trim();
    if (!cookieName) {
      return null;
    }

    const pairs = rawCookieHeader.split(";");
    for (const pair of pairs) {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = pair.slice(0, separatorIndex).trim();
      if (key !== cookieName) {
        continue;
      }

      const value = pair.slice(separatorIndex + 1).trim();
      if (!value) {
        return null;
      }

      try {
        const decoded = decodeURIComponent(value);
        return decoded.length > 0 ? decoded : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  private readHeaderString(headers: AuthProviderRequest["headers"], name: string): string | null {
    const rawValue = headers?.[name];
    if (typeof rawValue === "string") {
      const trimmed = rawValue.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (Array.isArray(rawValue)) {
      const joined = rawValue.join(",").trim();
      return joined.length > 0 ? joined : null;
    }

    return null;
  }
}
