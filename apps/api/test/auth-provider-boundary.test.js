const assert = require("node:assert/strict");
const { test } = require("node:test");
require("reflect-metadata");
const { hashSync } = require("bcryptjs");

const { AUTH_OAUTH_PROVIDER_ROUTE_SHAPES, AuthController } = require("../src/modules/auth/auth.controller.ts");
const { AuthContextMiddleware } = require("../src/modules/auth/auth-context.middleware.ts");
const {
  AUTH_ACL_ROUTE_HOOK_KEY,
  AUTH_ROUTE_POLICY_KEY,
  DocumentPermissionHook,
  ResourcePermissionHook
} = require("../src/modules/auth/auth-route-policy.ts");
const { AuthRoutePolicyGuard } = require("../src/modules/auth/auth-route-policy.guard.ts");
const {
  resolveCurrentAuthIdentity,
  resolveRequestAuthContext
} = require("../src/modules/auth/auth-identity.contract.ts");
const { AuthService } = require("../src/modules/auth/auth.service.ts");
const { oauthProviderParamSchema } = require("../src/modules/auth/auth.schemas.ts");
const { SessionCookieAuthProvider } = require("../src/modules/auth/session-cookie-auth.provider.ts");
const { HealthController } = require("../src/common/health.controller.ts");
const { AssistantsController } = require("../src/modules/assistants/assistants.controller.ts");
const { AuditController } = require("../src/modules/audit/audit.controller.ts");
const { ConversationsController } = require("../src/modules/conversations/conversations.controller.ts");
const { DocumentsController } = require("../src/modules/documents/documents.controller.ts");
const { KnowledgeBasesController } = require("../src/modules/knowledge-bases/knowledge-bases.controller.ts");
const { RetrievalProfilesController } = require("../src/modules/retrieval-profiles/retrieval-profiles.controller.ts");
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
  const touchedSessions = [];
  const provider = new SessionCookieAuthProvider({
    authSession: {
      findUnique: async ({ where }) => ({
        id: where.id,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: "user-123",
          tenantId: "tenant-123",
          role: "owner",
          status: "active"
        }
      }),
      updateMany: async ({ where, data }) => {
        touchedSessions.push({ where, data });
        return { count: 1 };
      }
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
    role: "owner",
    sessionId: "session-123",
    authSource: "session"
  });
  assert.equal(touchedSessions.length, 1);
  assert.deepEqual(touchedSessions[0].where, {
    id: "session-123",
    revokedAt: null
  });
  assert.ok(touchedSessions[0].data.lastSeenAt instanceof Date);
});

test("SessionCookieAuthProvider decodes encoded session cookie value", async () => {
  const observedSessionIds = [];
  const touchedSessions = [];
  const provider = new SessionCookieAuthProvider({
    authSession: {
      findUnique: async ({ where }) => {
        observedSessionIds.push(where.id);
        return {
          id: where.id,
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            id: "user-encoded",
            tenantId: "tenant-encoded",
            role: "member",
            status: "active"
          }
        };
      },
      updateMany: async ({ where, data }) => {
        touchedSessions.push({ where, data });
        return { count: 1 };
      }
    }
  });

  const identity = await provider.resolveIdentity({
    request: {
      headers: {
        cookie: "rag_session=session%2F123"
      }
    }
  });

  assert.deepEqual(observedSessionIds, ["session/123"]);
  assert.deepEqual(identity, {
    userId: "user-encoded",
    tenantId: "tenant-encoded",
    role: "member",
    sessionId: "session/123",
    authSource: "session"
  });
  assert.equal(touchedSessions.length, 1);
  assert.ok(touchedSessions[0].data.lastSeenAt instanceof Date);
});

test("SessionCookieAuthProvider revokes expired sessions and returns null", async () => {
  const revokedCalls = [];
  const provider = new SessionCookieAuthProvider({
    authSession: {
      findUnique: async ({ where }) => ({
        id: where.id,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
        user: {
          id: "user-expired",
          tenantId: "tenant-expired",
          role: "owner",
          status: "active"
        }
      }),
      updateMany: async ({ where, data }) => {
        revokedCalls.push({ where, data });
        return { count: 1 };
      }
    }
  });

  const identity = await provider.resolveIdentity({
    request: {
      headers: {
        cookie: "rag_session=expired-session"
      }
    }
  });

  assert.equal(identity, null);
  assert.equal(revokedCalls.length, 1);
  assert.deepEqual(revokedCalls[0].where, {
    id: "expired-session",
    revokedAt: null
  });
  assert.ok(revokedCalls[0].data.revokedAt instanceof Date);
});

test("AuthContextMiddleware injects request authContext via provider boundary", async () => {
  const middleware = new AuthContextMiddleware({
    resolveIdentity: () => ({
      userId: "user-42",
      tenantId: "tenant-42",
      role: "owner",
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
      role: "owner",
      sessionId: "session-42",
      authSource: "session"
    },
    currentIdentity: {
      userId: "user-42",
      tenantId: "tenant-42",
      role: "owner",
      sessionId: "session-42",
      authSource: "session"
    }
  });
});

test("AuthContextMiddleware injects default dev identity when unauthenticated and dev mode is enabled", async () => {
  const previous = process.env.AUTH_DEV_DEFAULT_USER_MODE;
  process.env.AUTH_DEV_DEFAULT_USER_MODE = "true";

  try {
    const middleware = new AuthContextMiddleware({
      resolveIdentity: () => null
    });

    const request = {
      headers: {
        cookie: "other=1"
      }
    };

    await middleware.use(request, {}, () => {});

    assert.deepEqual(request.authContext, {
      identity: {
        userId: "default-user",
        tenantId: "default-tenant",
        role: "owner",
        sessionId: null,
        authSource: "dev_seed"
      },
      currentIdentity: {
        userId: "default-user",
        tenantId: "default-tenant",
        role: "owner",
        sessionId: null,
        authSource: "dev_seed"
      }
    });
  } finally {
    if (previous == null) {
      delete process.env.AUTH_DEV_DEFAULT_USER_MODE;
    } else {
      process.env.AUTH_DEV_DEFAULT_USER_MODE = previous;
    }
  }
});

test("AuthContextMiddleware keeps identity null when unauthenticated and dev mode is disabled", async () => {
  const previous = process.env.AUTH_DEV_DEFAULT_USER_MODE;
  process.env.AUTH_DEV_DEFAULT_USER_MODE = "false";

  try {
    const middleware = new AuthContextMiddleware({
      resolveIdentity: () => null
    });

    const request = {
      headers: {
        cookie: "other=1"
      }
    };

    await middleware.use(request, {}, () => {});

    assert.deepEqual(request.authContext, {
      identity: null,
      currentIdentity: {
        userId: "default-user",
        tenantId: "default-tenant",
        role: "owner",
        sessionId: null,
        authSource: "dev_seed"
      }
    });
  } finally {
    if (previous == null) {
      delete process.env.AUTH_DEV_DEFAULT_USER_MODE;
    } else {
      process.env.AUTH_DEV_DEFAULT_USER_MODE = previous;
    }
  }
});

test("resolveRequestAuthContext returns stable default current identity when request is unauthenticated", () => {
  const resolved = resolveRequestAuthContext({ authContext: undefined });

  assert.deepEqual(resolved, {
    identity: {
      userId: "default-user",
      tenantId: "default-tenant",
      role: "owner",
      sessionId: null,
      authSource: "dev_seed"
    }
  });
});

test("resolveCurrentAuthIdentity keeps reserved authSource values for phase-2 provider skeleton", () => {
  const reservedAuthSources = ["local", "github", "google", "oidc", "session", "dev_seed"];

  for (const authSource of reservedAuthSources) {
    const resolved = resolveCurrentAuthIdentity({
      identity: {
        userId: `user-${authSource}`,
        tenantId: `tenant-${authSource}`,
        role: "owner",
        sessionId: null,
        authSource
      }
    });

    assert.equal(resolved.authSource, authSource);
  }
});

test("oauth provider schema boundary accepts only planned providers", () => {
  const plannedProviders = ["github", "google", "oidc"];

  for (const provider of plannedProviders) {
    assert.deepEqual(oauthProviderParamSchema.parse({ provider }), { provider });
  }

  assert.throws(
    () => oauthProviderParamSchema.parse({ provider: "local" }),
    /invalid|expected/i,
    "local is an authSource but not an oauth provider route param"
  );
});

test("AuthController reserves oauth provider route shapes without implementing callbacks", () => {
  assert.deepEqual(AUTH_OAUTH_PROVIDER_ROUTE_SHAPES, {
    start: "/auth/oauth/:provider/start",
    callback: "/auth/oauth/:provider/callback"
  });
});

test("AuthService startOauthProvider resolves GitHub start redirect with CSRF state", () => {
  const previousClientId = process.env.AUTH_GITHUB_CLIENT_ID;
  const previousRedirectUri = process.env.AUTH_GITHUB_REDIRECT_URI;
  const previousScope = process.env.AUTH_GITHUB_SCOPE;

  process.env.AUTH_GITHUB_CLIENT_ID = "github-client-id";
  process.env.AUTH_GITHUB_REDIRECT_URI = "http://localhost:3000/auth/oauth/github/callback";
  process.env.AUTH_GITHUB_SCOPE = "read:user user:email";

  try {
    const authService = new AuthService({});
    const result = authService.startOauthProvider({ provider: "github" });
    const redirectUrl = new URL(result.redirectUrl);

    assert.equal(result.provider, "github");
    assert.equal(result.stateCookieName, "rag_oauth_state");
    assert.ok(result.state.length > 0);
    assert.equal(result.stateTtlSeconds, 600);
    assert.equal(redirectUrl.origin + redirectUrl.pathname, "https://github.com/login/oauth/authorize");
    assert.equal(redirectUrl.searchParams.get("client_id"), "github-client-id");
    assert.equal(redirectUrl.searchParams.get("redirect_uri"), "http://localhost:3000/auth/oauth/github/callback");
    assert.equal(redirectUrl.searchParams.get("scope"), "read:user user:email");
    assert.equal(redirectUrl.searchParams.get("state"), result.state);
  } finally {
    if (previousClientId == null) {
      delete process.env.AUTH_GITHUB_CLIENT_ID;
    } else {
      process.env.AUTH_GITHUB_CLIENT_ID = previousClientId;
    }

    if (previousRedirectUri == null) {
      delete process.env.AUTH_GITHUB_REDIRECT_URI;
    } else {
      process.env.AUTH_GITHUB_REDIRECT_URI = previousRedirectUri;
    }

    if (previousScope == null) {
      delete process.env.AUTH_GITHUB_SCOPE;
    } else {
      process.env.AUTH_GITHUB_SCOPE = previousScope;
    }
  }
});

test("AuthService startOauthProvider fails clearly when GitHub OAuth config is missing", () => {
  const previousClientId = process.env.AUTH_GITHUB_CLIENT_ID;
  const previousRedirectUri = process.env.AUTH_GITHUB_REDIRECT_URI;

  delete process.env.AUTH_GITHUB_CLIENT_ID;
  delete process.env.AUTH_GITHUB_REDIRECT_URI;

  try {
    const authService = new AuthService({});
    assert.throws(
      () => authService.startOauthProvider({ provider: "github" }),
      /GitHub OAuth is not configured/i
    );
  } finally {
    if (previousClientId == null) {
      delete process.env.AUTH_GITHUB_CLIENT_ID;
    } else {
      process.env.AUTH_GITHUB_CLIENT_ID = previousClientId;
    }

    if (previousRedirectUri == null) {
      delete process.env.AUTH_GITHUB_REDIRECT_URI;
    } else {
      process.env.AUTH_GITHUB_REDIRECT_URI = previousRedirectUri;
    }
  }
});

test("AuthService startOauthProvider keeps google and oidc unimplemented", () => {
  const authService = new AuthService({});

  assert.throws(() => authService.startOauthProvider({ provider: "google" }), /not implemented/i);
  assert.throws(() => authService.startOauthProvider({ provider: "oidc" }), /not implemented/i);
});

test("AuthController oauthProviderStart sets state cookie and redirects to GitHub", () => {
  const previousClientId = process.env.AUTH_GITHUB_CLIENT_ID;
  const previousRedirectUri = process.env.AUTH_GITHUB_REDIRECT_URI;

  process.env.AUTH_GITHUB_CLIENT_ID = "github-client-id";
  process.env.AUTH_GITHUB_REDIRECT_URI = "http://localhost:3000/auth/oauth/github/callback";

  try {
    const cookies = [];
    const redirects = [];
    const controller = new AuthController(new AuthService({}));

    controller.oauthProviderStart(
      {
        provider: "github"
      },
      {
        setHeader: (name, value) => {
          if (name === "Set-Cookie") {
            cookies.push(value);
          }
        },
        redirect: (statusCode, url) => {
          redirects.push({ statusCode, url });
        }
      }
    );

    assert.equal(cookies.length, 1);
    assert.match(cookies[0], /^rag_oauth_state=/);
    assert.match(cookies[0], /HttpOnly/);
    assert.match(cookies[0], /SameSite=Lax/);
    assert.match(cookies[0], /Max-Age=600/);
    assert.equal(redirects.length, 1);
    assert.equal(redirects[0].statusCode, 302);
    assert.match(redirects[0].url, /^https:\/\/github\.com\/login\/oauth\/authorize\?/);
    assert.match(redirects[0].url, /client_id=github-client-id/);
    assert.match(redirects[0].url, /state=/);
  } finally {
    if (previousClientId == null) {
      delete process.env.AUTH_GITHUB_CLIENT_ID;
    } else {
      process.env.AUTH_GITHUB_CLIENT_ID = previousClientId;
    }

    if (previousRedirectUri == null) {
      delete process.env.AUTH_GITHUB_REDIRECT_URI;
    } else {
      process.env.AUTH_GITHUB_REDIRECT_URI = previousRedirectUri;
    }
  }
});

test("AuthService completeOauthProviderCallback reuses local user by email, creates identity link, and creates session", async () => {
  const calls = {
    linkLookup: null,
    userLookup: null,
    linkCreate: null,
    sessionCreate: null
  };

  const authService = new AuthService(
    {
      authIdentityLink: {
        findUnique: async ({ where }) => {
          calls.linkLookup = where;
          return null;
        },
        create: async ({ data }) => {
          calls.linkCreate = data;
          return { id: "link-1" };
        }
      },
      user: {
        findUnique: async ({ where }) => {
          calls.userLookup = where;
          return {
            id: "user-existing",
            tenantId: "tenant-1",
            role: "member",
            status: "active"
          };
        }
      },
      authSession: {
        create: async ({ data }) => {
          calls.sessionCreate = data;
          return { id: "session-github-1" };
        }
      }
    },
    {
      exchangeCodeForIdentity: async ({ code }) => {
        assert.equal(code, "github-code-123");
        return {
          subject: "github-subject-123",
          email: "existing@example.com",
          profileSnapshot: {
            id: 123,
            login: "existing-user"
          }
        };
      }
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: "github",
    code: "github-code-123",
    state: "state-1",
    expectedState: "state-1"
  });

  assert.equal(result.identity.userId, "user-existing");
  assert.equal(result.identity.tenantId, "tenant-1");
  assert.equal(result.identity.sessionId, "session-github-1");
  assert.equal(result.identity.authSource, "session");
  assert.deepEqual(calls.linkLookup, {
    provider_subject: {
      provider: "github",
      subject: "github-subject-123"
    }
  });
  assert.deepEqual(calls.userLookup, { email: "existing@example.com" });
  assert.equal(calls.linkCreate.userId, "user-existing");
  assert.equal(calls.linkCreate.provider, "github");
  assert.equal(calls.linkCreate.subject, "github-subject-123");
  assert.equal(calls.linkCreate.emailSnapshot, "existing@example.com");
  assert.ok(calls.linkCreate.lastLoginAt instanceof Date);
  assert.equal(calls.sessionCreate.userId, "user-existing");
  assert.ok(calls.sessionCreate.lastSeenAt instanceof Date);
});

test("AuthController oauthProviderCallback validates state cookie and writes oauth/session cookies", async () => {
  const cookies = [];
  const callbackCalls = [];
  const controller = new AuthController({
    completeOauthProviderCallback: async (input) => {
      callbackCalls.push(input);
      return {
        identity: {
          userId: "user-1",
          tenantId: "tenant-1",
          role: "owner",
          sessionId: "session-1",
          authSource: "session"
        },
        expiresAt: "2030-01-01T00:00:00.000Z"
      };
    }
  });

  const result = await controller.oauthProviderCallback(
    {
      provider: "github"
    },
    {
      code: "callback-code-1",
      state: "state-cookie-1"
    },
    {
      headers: {
        cookie: "other=1; rag_oauth_state=state-cookie-1"
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

  assert.equal(result.identity.sessionId, "session-1");
  assert.deepEqual(callbackCalls, [
    {
      provider: "github",
      code: "callback-code-1",
      state: "state-cookie-1",
      expectedState: "state-cookie-1"
    }
  ]);
  assert.equal(cookies.length, 1);
  assert.ok(Array.isArray(cookies[0]));
  assert.match(cookies[0][0], /^rag_oauth_state=;/);
  assert.match(cookies[0][1], /^rag_session=session-1/);
});

test("AuthService completeOauthProviderCallback rejects mismatched state", async () => {
  const authService = new AuthService({}, {
    exchangeCodeForIdentity: async () => {
      throw new Error("should not exchange when state is invalid");
    }
  });

  await assert.rejects(
    () =>
      authService.completeOauthProviderCallback({
        provider: "github",
        code: "callback-code-2",
        state: "state-a",
        expectedState: "state-b"
      }),
    /Invalid OAuth state/
  );
});

test("AuthService login creates session identity and logout revokes session", async () => {
  const loginEmail = "default-user@example.com";
  const loginPassword = "local-password-1";
  const loginPasswordHash = hashSync(loginPassword, 4);
  const calls = {
    userLookup: null,
    created: null,
    revoked: null
  };
  const authService = new AuthService({
    user: {
      findUnique: async ({ where }) => {
        calls.userLookup = where;
        return {
          id: "default-user",
          tenantId: "tenant-1",
          role: "member",
          status: "active",
          passwordHash: loginPasswordHash
        };
      }
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

  const login = await authService.login({
    email: loginEmail,
    password: loginPassword
  });
  assert.equal(login.identity.sessionId, "session-1");
  assert.equal(login.identity.userId, "default-user");
  assert.equal(login.identity.tenantId, "tenant-1");
  assert.equal(login.identity.authSource, "session");
  assert.equal(login.identity.role, "member");
  assert.ok(typeof login.expiresAt === "string");
  assert.deepEqual(calls.userLookup, { email: loginEmail });
  assert.equal(calls.created.userId, "default-user");

  const logout = await authService.logout({ sessionId: "session-1" });
  assert.deepEqual(logout, { ok: true });
  assert.equal(calls.revoked.where.id, "session-1");
  assert.equal(calls.revoked.where.revokedAt, null);
  assert.ok(calls.revoked.data.revokedAt instanceof Date);
});

test("AuthService login rejects invalid email/password edges", async () => {
  const loginPasswordHash = hashSync("local-password-1", 4);
  const authService = new AuthService({
    user: {
      findUnique: async ({ where }) => {
        if (where.email === "inactive-user@example.com") {
          return {
            id: "user-inactive",
            tenantId: "tenant-1",
            role: "member",
            status: "inactive",
            passwordHash: loginPasswordHash
          };
        }

        if (where.email === "active-user@example.com") {
          return {
            id: "user-active",
            tenantId: "tenant-1",
            role: "member",
            status: "active",
            passwordHash: loginPasswordHash
          };
        }

        return null;
      }
    },
    authSession: {
      create: async () => {
        throw new Error("should not create session for failed login");
      }
    }
  });

  await assert.rejects(
    () =>
      authService.login({
        email: "active-user@example.com",
        password: "wrong-password"
      }),
    /Invalid email or password/,
    "wrong password should fail"
  );

  await assert.rejects(
    () =>
      authService.login({
        email: "missing-user@example.com",
        password: "local-password-1"
      }),
    /Invalid email or password/,
    "missing user should fail"
  );

  await assert.rejects(
    () =>
      authService.login({
        email: "inactive-user@example.com",
        password: "local-password-1"
      }),
    /Invalid email or password/,
    "inactive user should fail"
  );
});

test("AuthService checkPermission evaluates owner-only resource access for current identity", () => {
  const authService = new AuthService({});

  const allowed = authService.checkPermission({
    authContext: {
      identity: {
        userId: "user-1",
        tenantId: "tenant-1",
        role: "owner",
        sessionId: "session-1",
        authSource: "session"
      },
      currentIdentity: {
        userId: "user-1",
        tenantId: "tenant-1",
        role: "owner",
        sessionId: "session-1",
        authSource: "session"
      }
    },
    action: "read",
    resource: {
      kind: "document",
      resourceId: "doc-1",
      tenantId: "tenant-1",
      ownerId: "user-1"
    }
  });

  assert.equal(allowed.decision.allowed, true);
  assert.equal(allowed.decision.reason, "owner_match");
  assert.equal(allowed.decision.policy, "owner_only_v1");

  const denied = authService.checkPermission({
    authContext: {
      identity: {
        userId: "user-1",
        tenantId: "tenant-1",
        role: "owner",
        sessionId: "session-1",
        authSource: "session"
      },
      currentIdentity: {
        userId: "user-1",
        tenantId: "tenant-1",
        role: "owner",
        sessionId: "session-1",
        authSource: "session"
      }
    },
    action: "write",
    resource: {
      kind: "assistant",
      resourceId: "assistant-1",
      tenantId: "tenant-1",
      ownerId: "other-user"
    }
  });

  assert.equal(denied.decision.allowed, false);
  assert.equal(denied.decision.reason, "owner_mismatch");
  assert.equal(denied.decision.policy, "owner_only_v1");
});

test("AuthController sets and clears session cookie around login and logout", async () => {
  const cookies = [];
  const loginCalls = [];
  const controller = new AuthController({
    login: async (input) => {
      loginCalls.push(input);
      return {
        identity: {
          userId: "default-user",
          tenantId: "default-tenant",
          role: "owner",
          sessionId: "session-xyz",
          authSource: "session"
        },
        expiresAt: "2030-01-01T00:00:00.000Z"
      };
    },
    logout: async () => ({ ok: true }),
    getMe: () => ({ identity: null, currentIdentity: null })
  });

  const loginResult = await controller.login({
    email: "default-user@example.com",
    password: "local-password-1"
  }, {
    setHeader: (name, value) => {
      if (name === "Set-Cookie") {
        cookies.push(value);
      }
    }
  });

  assert.equal(loginResult.identity.sessionId, "session-xyz");
  assert.deepEqual(loginCalls, [{ email: "default-user@example.com", password: "local-password-1" }]);
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
            role: "owner",
            sessionId: "session-1",
            authSource: "session"
          }
        }
      })
    })
  });

  assert.equal(allowed, true);
});

test("AuthRoutePolicyGuard invokes ACL guard hook when authenticated route carries ACL hook metadata", () => {
  const observed = [];
  const guard = new AuthRoutePolicyGuard(
    {
      getAllAndOverride: (metadataKey) => {
        if (metadataKey === AUTH_ROUTE_POLICY_KEY) {
          return "authenticated";
        }

        if (metadataKey === AUTH_ACL_ROUTE_HOOK_KEY) {
          return {
            action: "write",
            target: "document"
          };
        }

        return undefined;
      }
    },
    (input) => observed.push(input)
  );

  const request = {
    authContext: {
      identity: {
        userId: "user-1",
        tenantId: "tenant-1",
        role: "owner",
        sessionId: "session-1",
        authSource: "session"
      }
    }
  };

  const allowed = guard.canActivate({
    getHandler: () => "handler",
    getClass: () => "controller",
    switchToHttp: () => ({
      getRequest: () => request
    })
  });

  assert.equal(allowed, true);
  assert.equal(observed.length, 1);
  assert.equal(observed[0].request, request);
  assert.deepEqual(observed[0].aclHook, {
    action: "write",
    target: "document"
  });
});

test("DocumentPermissionHook and ResourcePermissionHook reserve ACL attachment metadata", () => {
  class HookedController {
    readDocument() {}
    writeResource() {}
  }

  const readDescriptor = Object.getOwnPropertyDescriptor(HookedController.prototype, "readDocument");
  const writeDescriptor = Object.getOwnPropertyDescriptor(HookedController.prototype, "writeResource");

  DocumentPermissionHook("read")(HookedController.prototype, "readDocument", readDescriptor);
  ResourcePermissionHook("write")(HookedController.prototype, "writeResource", writeDescriptor);

  assert.deepEqual(
    Reflect.getMetadata(AUTH_ACL_ROUTE_HOOK_KEY, HookedController.prototype.readDocument),
    {
      action: "read",
      target: "document"
    }
  );
  assert.deepEqual(
    Reflect.getMetadata(AUTH_ACL_ROUTE_HOOK_KEY, HookedController.prototype.writeResource),
    {
      action: "write",
      target: "resource"
    }
  );
});

test("owner-scoped business controllers are marked authenticated while auth and health remain public", () => {
  const businessControllers = [
    KnowledgeBasesController,
    DocumentsController,
    AuditController,
    AssistantsController,
    ConversationsController,
    RetrievalProfilesController,
    TracesController
  ];

  for (const controller of businessControllers) {
    assert.equal(Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, controller), "authenticated");
  }

  assert.equal(Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, AuthController), "public");
  assert.equal(Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, AuthController.prototype.me), "authenticated");
  assert.equal(Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, AuthController.prototype.checkPermission), "authenticated");
  assert.equal(Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, HealthController), "public");
});
