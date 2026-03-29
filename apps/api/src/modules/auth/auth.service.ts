import { Injectable, UnauthorizedException } from "@nestjs/common";
import { compare } from "bcryptjs";
import { PrismaService } from "../../infra/database/prisma.service";
import {
  DEFAULT_AUTH_SESSION_TTL_HOURS
} from "./auth.constants";
import {
  resolveCurrentAuthIdentity,
  type AuthIdentity,
  type RequestAuthContext
} from "./auth-identity.contract";
import { evaluateOwnerResourceAccess, type ResourceAccessPolicyInput } from "./resource-access-policy.contract";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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
}
