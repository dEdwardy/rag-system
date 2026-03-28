const assert = require("node:assert/strict");
const { test } = require("node:test");
require("reflect-metadata");

const { AuthController } = require("../src/modules/auth/auth.controller.ts");
const { AuthContextMiddleware } = require("../src/modules/auth/auth-context.middleware.ts");
const { AUTH_ROUTE_POLICY_KEY } = require("../src/modules/auth/auth-route-policy.ts");
const { AuthRoutePolicyGuard } = require("../src/modules/auth/auth-route-policy.guard.ts");
const { resolveRequestAuthContext } = require("../src/modules/auth/auth-identity.contract.ts");
const { AuthService } = require("../src/modules/auth/auth.service.ts");
const { SessionCookieAuthProvider } = require("../src/modules/auth/session-cookie-auth.provider.ts");
const { HealthController } = require("../src/common/health.controller.ts");
const { AssistantsController } = require("../src/modules/assistants/assistants.controller.ts");
const { ConversationsController } = require("../src/modules/conversations/conversations.controller.ts");
const { DocumentsController } = require("../src/modules/documents/documents.controller.ts");
const { KnowledgeBasesController } = require("../src/modules/knowledge-bases/knowledge-bases.controller.ts");
const { TracesController } = require("../src/modules/traces/traces.controller.ts");

test("SessionCookieAuthProvider returns null when session cookie is missing", async () => {
  const provider = new SessionCookieAuthProvider({
    authSession: {
      findUnique: async () => {
        throw new Error("should not query without session cookie");
      }
    }
  });

  const identity = await provider.resolveIdentity({
    request: {
      headers: {
        cookie: "other=1"
      }
    }
  });

  assert.equal(identity, null);
});

test("SessionCookieAuthProvider resolves identity from persisted session", async () => {
  const provider = new SessionCookieAuthProvider({
    authSession: {
      findUnique: async ({ where }) => ({
        id: where.id,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: "user-123",
          tenantId: "tenant-123",
          status: "active"
        }
      })
    }
  });

  const identity = await provider.resolveIdentity({
    request: {
      headers: {
        cookie: "other=ignored; rag_session=session-123"
      }
    }
  });

  assert.deepEqual(identity, {
    userId: "user-123",
    tenantId: "tenant-123",
    sessionId: "session-123",
    authSource: "session"
  });
});

test("AuthContextMiddleware injects request authContext via provider boundary", async () => {
  const middleware = new AuthContextMiddleware({
    resolveIdentity: () => ({
      userId: "user-42",
      tenantId: "tenant-42",
      sessionId: "session-42",
      authSource: "session"
    })
  });

  const request = {
    headers: {
      cookie: "rag_session=session-42"
    }
  };
  let nextCalled = false;

  await middleware.use(request, {}, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(request.authContext, {
    identity: {
      userId: "user-42",
      tenantId: "tenant-42",
      sessionId: "session-42",
      authSource: "session"
    },
    currentIdentity: {
      userId: "user-42",
      tenantId: "tenant-42",
      sessionId: "session-42",
      authSource: "session"
    }
  });
});

test("resolveRequestAuthContext returns stable default current identity when request is unauthenticated", () => {
  const resolved = resolveRequestAuthContext({ authContext: undefined });

  assert.deepEqual(resolved, {
    identity: {
      userId: "default-user",
      tenantId: "default-tenant",
      sessionId: null,
      authSource: "dev_seed"
    }
  });
});

test("AuthService login creates session identity and logout revokes session", async () => {
  const calls = {
    created: null,
    revoked: null
  };
  const authService = new AuthService({
    user: {
      findUnique: async ({ where }) => ({
        id: where.id,
        tenantId: "tenant-1",
        status: "active"
      })
    },
    authSession: {
      create: async ({ data }) => {
        calls.created = data;
        return { id: "session-1" };
      },
      updateMany: async ({ where, data }) => {
        calls.revoked = { where, data };
        return { count: 1 };
      }
    }
  });

  const login = await authService.login({ userId: "default-user" });
  assert.equal(login.identity.sessionId, "session-1");
  assert.equal(login.identity.userId, "default-user");
  assert.equal(login.identity.tenantId, "tenant-1");
  assert.equal(login.identity.authSource, "session");
  assert.ok(typeof login.expiresAt === "string");
  assert.equal(calls.created.userId, "default-user");

  const logout = await authService.logout({ sessionId: "session-1" });
  assert.deepEqual(logout, { ok: true });
  assert.equal(calls.revoked.where.id, "session-1");
  assert.equal(calls.revoked.where.revokedAt, null);
  assert.ok(calls.revoked.data.revokedAt instanceof Date);
});

test("AuthController sets and clears session cookie around login and logout", async () => {
  const cookies = [];
  const controller = new AuthController({
    login: async () => ({
      identity: {
        userId: "default-user",
        tenantId: "default-tenant",
        sessionId: "session-xyz",
        authSource: "session"
      },
      expiresAt: "2030-01-01T00:00:00.000Z"
    }),
    logout: async () => ({ ok: true }),
    getMe: () => ({ identity: null, currentIdentity: null })
  });

  const loginResult = await controller.login({}, {
    setHeader: (name, value) => {
      if (name === "Set-Cookie") {
        cookies.push(value);
      }
    }
  });

  assert.equal(loginResult.identity.sessionId, "session-xyz");
  assert.match(cookies[0], /rag_session=session-xyz/);

  const logoutResult = await controller.logout(
    {
      authContext: {
        identity: {
          sessionId: "session-xyz"
        }
      }
    },
    {
      setHeader: (name, value) => {
        if (name === "Set-Cookie") {
          cookies.push(value);
        }
      }
    }
  );

  assert.deepEqual(logoutResult, { ok: true });
  assert.match(cookies[1], /rag_session=;/);
  assert.match(cookies[1], /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
});

test("AuthRoutePolicyGuard allows public routes without identity", () => {
  const guard = new AuthRoutePolicyGuard({
    getAllAndOverride: () => "public"
  });

  const allowed = guard.canActivate({
    getHandler: () => "handler",
    getClass: () => "controller",
    switchToHttp: () => ({
      getRequest: () => ({ authContext: { identity: null } })
    })
  });

  assert.equal(allowed, true);
});

test("AuthRoutePolicyGuard rejects authenticated routes without session identity", () => {
  const guard = new AuthRoutePolicyGuard({
    getAllAndOverride: () => "authenticated"
  });

  assert.throws(
    () =>
      guard.canActivate({
        getHandler: () => "handler",
        getClass: () => "controller",
        switchToHttp: () => ({
          getRequest: () => ({ authContext: { identity: null } })
        })
      }),
    /Authentication required/
  );
});

test("AuthRoutePolicyGuard allows authenticated routes with session identity", () => {
  const guard = new AuthRoutePolicyGuard({
    getAllAndOverride: () => "authenticated"
  });

  const allowed = guard.canActivate({
    getHandler: () => "handler",
    getClass: () => "controller",
    switchToHttp: () => ({
      getRequest: () => ({
        authContext: {
          identity: {
            userId: "user-1",
            tenantId: "tenant-1",
            sessionId: "session-1",
            authSource: "session"
          }
        }
      })
    })
  });

  assert.equal(allowed, true);
});

test("owner-scoped business controllers are marked authenticated while auth and health remain public", () => {
  const businessControllers = [
    KnowledgeBasesController,
    DocumentsController,
    AssistantsController,
    ConversationsController,
    TracesController
  ];

  for (const controller of businessControllers) {
    assert.equal(Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, controller), "authenticated");
  }

  assert.equal(Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, AuthController), "public");
  assert.equal(Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, AuthController.prototype.me), "authenticated");
  assert.equal(Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, HealthController), "public");
});
