import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { AUTH_RUNTIME_CONFIG, type AuthRuntimeConfig } from "./auth-runtime-config";
import type { AuthIdentity } from "./auth-identity.contract";

export type AuthUserSnapshot = {
  id: string;
  email: string | null;
  name: string;
  displayName: string | null;
  role: AuthIdentity["role"];
  tenantId: string;
};

export type StoredAuthSession = {
  id: string;
  user: AuthUserSnapshot;
  expiresAtMs: number;
  lastSeenAtMs: number | null;
};

export type CreateAuthSessionInput = {
  user: AuthUserSnapshot;
  now: Date;
  ttlMs: number;
};

export interface AuthSessionStore {
  createSession(input: CreateAuthSessionInput): Promise<StoredAuthSession>;
  getSession(sessionId: string): Promise<StoredAuthSession | null>;
  touchSession(sessionId: string, lastSeenAt: Date): Promise<void>;
  revokeSession(sessionId: string): Promise<void>;
}

export const AUTH_SESSION_STORE = Symbol("AUTH_SESSION_STORE");

type RedisSessionClient = {
  isOpen?: boolean;
  connect?: () => Promise<void>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options?: { PX?: number }) => Promise<unknown>;
  del: (key: string) => Promise<number>;
};

@Injectable()
export class DatabaseAuthSessionStore implements AuthSessionStore {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(input: CreateAuthSessionInput) {
    const expiresAt = new Date(input.now.getTime() + input.ttlMs);
    const session = await this.prisma.authSession.create({
      data: {
        userId: input.user.id,
        expiresAt,
        lastSeenAt: input.now
      },
      select: {
        id: true
      }
    });

    return {
      id: session.id,
      user: input.user,
      expiresAtMs: expiresAt.getTime(),
      lastSeenAtMs: input.now.getTime()
    };
  }

  async getSession(sessionId: string) {
    const session = await this.prisma.authSession.findUnique({
      where: {
        id: sessionId
      },
      include: {
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

    if (session == null || session.revokedAt != null || session.expiresAt.getTime() <= Date.now() || session.user.status !== "active") {
      return null;
    }

    return {
      id: session.id,
      user: {
        id: session.user.id,
        tenantId: session.user.tenantId,
        name: session.user.name,
        displayName: session.user.displayName,
        email: session.user.email,
        role: session.user.role
      },
      expiresAtMs: session.expiresAt.getTime(),
      lastSeenAtMs: session.lastSeenAt?.getTime() ?? null
    };
  }

  async touchSession(sessionId: string, lastSeenAt: Date) {
    await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null
      },
      data: {
        lastSeenAt
      }
    });
  }

  async revokeSession(sessionId: string) {
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
}

@Injectable()
export class RedisAuthSessionStore implements AuthSessionStore {
  private clientPromise: Promise<RedisSessionClient> | null = null;

  constructor(
    @Inject(AUTH_RUNTIME_CONFIG) private readonly authRuntimeConfig: AuthRuntimeConfig,
    private readonly clientFactory?: () => Promise<RedisSessionClient> | RedisSessionClient
  ) {}

  async createSession(input: CreateAuthSessionInput) {
    const id = randomUUID();
    const session: StoredAuthSession = {
      id,
      user: input.user,
      expiresAtMs: input.now.getTime() + input.ttlMs,
      lastSeenAtMs: input.now.getTime()
    };
    await this.writeSession(session);
    return session;
  }

  async getSession(sessionId: string) {
    const client = await this.getClient();
    const payload = await client.get(this.buildSessionKey(sessionId));
    if (!payload) {
      return null;
    }

    try {
      const session = JSON.parse(payload) as StoredAuthSession;
      if (session.expiresAtMs <= Date.now()) {
        await client.del(this.buildSessionKey(sessionId));
        return null;
      }

      return session;
    } catch {
      await client.del(this.buildSessionKey(sessionId));
      return null;
    }
  }

  async touchSession(sessionId: string, lastSeenAt: Date) {
    const session = await this.getSession(sessionId);
    if (!session) {
      return;
    }

    session.lastSeenAtMs = lastSeenAt.getTime();
    await this.writeSession(session);
  }

  async revokeSession(sessionId: string) {
    const client = await this.getClient();
    await client.del(this.buildSessionKey(sessionId));
  }

  private async writeSession(session: StoredAuthSession) {
    const client = await this.getClient();
    const ttlMs = Math.max(1, session.expiresAtMs - Date.now());
    await client.set(this.buildSessionKey(session.id), JSON.stringify(session), { PX: ttlMs });
  }

  private async getClient() {
    if (!this.clientPromise) {
      this.clientPromise = this.createClient();
    }

    return this.clientPromise;
  }

  private async createClient(): Promise<RedisSessionClient> {
    if (this.clientFactory) {
      const client = await this.clientFactory();
      if (client.connect && client.isOpen !== true) {
        await client.connect();
      }
      return client;
    }

    const redisUrl = this.authRuntimeConfig.redisUrl;
    if (!redisUrl) {
      throw new Error("REDIS_URL is required when AUTH_SESSION_STORE_PROVIDER=redis.");
    }

    const redisModule = await import("redis");
    const client = redisModule.createClient({ url: redisUrl }) as RedisSessionClient;
    if (client.connect && client.isOpen !== true) {
      await client.connect();
    }
    return client;
  }

  private buildSessionKey(sessionId: string) {
    return `${this.authRuntimeConfig.sessionStoreKeyPrefix}:session:${sessionId}`;
  }
}

export function isAuthSessionStore(candidate: unknown): candidate is AuthSessionStore {
  return typeof candidate === "object"
    && candidate !== null
    && typeof (candidate as AuthSessionStore).createSession === "function"
    && typeof (candidate as AuthSessionStore).getSession === "function"
    && typeof (candidate as AuthSessionStore).touchSession === "function"
    && typeof (candidate as AuthSessionStore).revokeSession === "function";
}

export function createDatabaseAuthSessionStoreFromPrisma(prisma: PrismaService | Prisma.TransactionClient) {
  return {
    createSession: async (input: CreateAuthSessionInput) => {
      const expiresAt = new Date(input.now.getTime() + input.ttlMs);
      const session = await prisma.authSession.create({
        data: {
          userId: input.user.id,
          expiresAt,
          lastSeenAt: input.now
        },
        select: {
          id: true
        }
      });

      return {
        id: session.id,
        user: input.user,
        expiresAtMs: expiresAt.getTime(),
        lastSeenAtMs: input.now.getTime()
      } satisfies StoredAuthSession;
    },
    getSession: async (sessionId: string) => {
      const session = await prisma.authSession.findUnique({
        where: {
          id: sessionId
        },
        include: {
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

      if (session == null || session.revokedAt != null || session.expiresAt.getTime() <= Date.now() || session.user.status !== "active") {
        return null;
      }

      return {
        id: session.id,
        user: {
          id: session.user.id,
          tenantId: session.user.tenantId,
          name: session.user.name,
          displayName: session.user.displayName,
          email: session.user.email,
          role: session.user.role
        },
        expiresAtMs: session.expiresAt.getTime(),
        lastSeenAtMs: session.lastSeenAt?.getTime() ?? null
      } satisfies StoredAuthSession;
    },
    touchSession: async (sessionId: string, lastSeenAt: Date) => {
      await prisma.authSession.updateMany({
        where: {
          id: sessionId,
          revokedAt: null
        },
        data: {
          lastSeenAt
        }
      });
    },
    revokeSession: async (sessionId: string) => {
      await prisma.authSession.updateMany({
        where: {
          id: sessionId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });
    }
  } satisfies AuthSessionStore;
}
