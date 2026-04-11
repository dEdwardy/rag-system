const assert = require("node:assert/strict");
const test = require("node:test");
const { hashSync } = require("bcryptjs");

const { AuthService } = require("../src/modules/auth/auth.service.ts");
const { SessionCookieAuthProvider } = require("../src/modules/auth/session-cookie-auth.provider.ts");

function createInMemorySessionStore() {
  const sessions = new Map();

  return {
    sessions,
    async createSession(input) {
      const session = {
        id: "session-store-1",
        user: input.user,
        expiresAtMs: input.now.getTime() + input.ttlMs,
        lastSeenAtMs: input.now.getTime()
      };
      sessions.set(session.id, session);
      return session;
    },
    async getSession(sessionId) {
      return sessions.get(sessionId) ?? null;
    },
    async touchSession(sessionId, lastSeenAt) {
      const session = sessions.get(sessionId);
      if (session) {
        session.lastSeenAtMs = lastSeenAt.getTime();
      }
    },
    async revokeSession(sessionId) {
      sessions.delete(sessionId);
    }
  };
}

test("SessionCookieAuthProvider resolves identity from session store without prisma authSession lookup", async () => {
  const sessionStore = createInMemorySessionStore();
  sessionStore.sessions.set("session-redis-1", {
    id: "session-redis-1",
    user: {
      id: "user-1",
      tenantId: "tenant-1",
      role: "owner",
      name: "User 1",
      displayName: null,
      email: "user1@example.com"
    },
    expiresAtMs: Date.now() + 60_000,
    lastSeenAtMs: null
  });

  const provider = new SessionCookieAuthProvider(sessionStore);
  const identity = await provider.resolveIdentity({
    request: {
      headers: {
        cookie: "rag_session=session-redis-1"
      }
    }
  });

  assert.deepEqual(identity, {
    userId: "user-1",
    tenantId: "tenant-1",
    role: "owner",
    sessionId: "session-redis-1",
    authSource: "session"
  });
});

test("AuthService uses injected session store for login refresh and logout", async () => {
  const loginEmail = "default-user@example.com";
  const loginPassword = "local-password-1";
  const loginPasswordHash = hashSync(loginPassword, 4);
  const sessionStore = createInMemorySessionStore();

  const authService = new AuthService(
    {
      user: {
        findUnique: async ({ where }) => {
          if (where.email !== loginEmail) {
            return null;
          }

          return {
            id: "default-user",
            tenantId: "tenant-1",
            name: "Default User",
            displayName: "Default User",
            email: loginEmail,
            role: "member",
            status: "active",
            passwordHash: loginPasswordHash
          };
        }
      }
    },
    undefined,
    undefined,
    undefined,
    {
      getConfig: () => ({
        sessionTtlHours: 168,
        accessJwtTtlMinutes: 15,
        accessJwtSecret: "test-secret",
        sessionCookieName: "rag_session",
        accessTokenCookieName: "rag_access_token",
        oauthStateCookieName: "rag_oauth_state",
        loginProvenanceCookieName: "rag_login_provenance",
        oauthStateTtlSeconds: 300,
        oauthSuccessRedirectUrl: "http://localhost:5173",
        cookieSecure: false,
        cookieSameSite: "Lax",
        defaultTenantId: "default-tenant",
        isDevelopmentLike: true,
        localDevCredentials: {
          enabled: true,
          email: loginEmail,
          password: loginPassword
        },
        github: { clientId: "", clientSecret: "", redirectUri: "", authorizeUrl: "", tokenUrl: "", userUrl: "", scope: "" },
        google: { clientId: "", clientSecret: "", redirectUri: "", authorizeUrl: "", tokenUrl: "", userUrl: "", scope: "" },
        oidc: { issuer: "", discoveryUrl: "", clientId: "", clientSecret: "", redirectUri: "", scope: "openid" },
        rateLimits: {
          login: { windowMs: 60000, maxAttempts: 5 },
          oauth_start: { windowMs: 60000, maxAttempts: 10 },
          oauth_callback: { windowMs: 60000, maxAttempts: 10 },
          refresh: { windowMs: 60000, maxAttempts: 30 }
        },
        sessionStoreProvider: "redis",
        redisUrl: "redis://127.0.0.1:6379",
        sessionStoreKeyPrefix: "rag-auth"
      })
    },
    new SessionCookieAuthProvider(sessionStore),
    sessionStore
  );

  const login = await authService.login({
    email: loginEmail,
    password: loginPassword
  });

  assert.equal(login.identity.sessionId, "session-store-1");
  const refresh = await authService.refreshAccessToken({
    sessionId: "session-store-1"
  });
  assert.equal(refresh.identity.sessionId, "session-store-1");

  await authService.logout({ sessionId: "session-store-1" });
  assert.equal(await sessionStore.getSession("session-store-1"), null);
});
