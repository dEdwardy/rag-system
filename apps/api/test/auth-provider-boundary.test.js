const assert = require("node:assert/strict");
const { test } = require("node:test");

const { AuthContextMiddleware } = require("../src/modules/auth/auth-context.middleware.ts");
const { resolveRequestAuthContext } = require("../src/modules/auth/auth-identity.contract.ts");
const { SessionCookieAuthProvider } = require("../src/modules/auth/session-cookie-auth.provider.ts");

test("SessionCookieAuthProvider returns null when session cookie is missing", () => {
  const provider = new SessionCookieAuthProvider();

  const identity = provider.resolveIdentity({
    request: {
      headers: {
        "x-rag-user-id": "user-1",
        "x-rag-tenant-id": "tenant-1"
      }
    }
  });

  assert.equal(identity, null);
});

test("SessionCookieAuthProvider resolves identity from session-cookie boundary inputs", () => {
  const provider = new SessionCookieAuthProvider();

  const identity = provider.resolveIdentity({
    request: {
      headers: {
        cookie: "other=ignored; rag_session=session-123",
        "x-rag-user-id": "user-123",
        "x-rag-tenant-id": "tenant-123"
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
