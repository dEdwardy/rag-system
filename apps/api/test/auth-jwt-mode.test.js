const assert = require("node:assert/strict");

const { AuthController } = require("../src/modules/auth/auth.controller.ts");
const { AccessJwtAuthProvider } = require("../src/modules/auth/access-jwt-auth.provider.ts");
const { signAccessJwt } = require("../src/modules/auth/access-jwt.ts");

test("AuthController login sets access and refresh JWT cookies without session cookie", async () => {
  const authService = {
    async login() {
      return {
        identity: {
          userId: "user-1",
          tenantId: "tenant-1",
          role: "owner",
          sessionId: null,
          authSource: "local"
        },
        user: {
          id: "user-1",
          tenantId: "tenant-1",
          role: "owner",
          name: "User 1",
          displayName: "User 1",
          email: "user-1@example.com"
        },
        expiresAt: "2030-01-01T00:00:00.000Z",
        accessToken: "access-token",
        accessTokenExpiresAt: "2030-01-01T00:15:00.000Z",
        refreshToken: "refresh-token"
      };
    }
  };
  const controller = new AuthController(authService, createRuntimeConfigService());
  const response = createResponseRecorder();

  await controller.login({ email: "user-1@example.com", password: "pw" }, response);

  const cookies = response.headers["Set-Cookie"];
  assert.equal(cookies.length, 3);
  assert.ok(cookies.some(cookie => cookie.startsWith("rag_access_token=access-token;")));
  assert.ok(cookies.some(cookie => cookie.startsWith("rag_refresh_token=refresh-token;")));
  assert.ok(cookies.every(cookie => !cookie.startsWith("rag_session=")));
});

test("AuthController refresh reissues both JWT cookies from refresh token cookie", async () => {
  const refreshCalls = [];
  const authService = {
    async refreshAccessToken(input) {
      refreshCalls.push(input);
      return {
        identity: {
          userId: "user-1",
          tenantId: "tenant-1",
          role: "owner",
          sessionId: null,
          authSource: "local"
        },
        user: {
          id: "user-1",
          tenantId: "tenant-1",
          role: "owner",
          name: "User 1",
          displayName: "User 1",
          email: "user-1@example.com"
        },
        accessToken: "next-access",
        accessTokenExpiresAt: "2030-01-01T00:15:00.000Z",
        refreshToken: "next-refresh",
        expiresAt: "2030-01-02T00:00:00.000Z"
      };
    }
  };
  const controller = new AuthController(authService, createRuntimeConfigService());
  const response = createResponseRecorder();

  await controller.refresh({ headers: { cookie: "rag_refresh_token=refresh-cookie-token" } }, response);

  assert.deepEqual(refreshCalls, [{ refreshToken: "refresh-cookie-token" }]);
  const cookies = response.headers["Set-Cookie"];
  assert.equal(cookies.length, 2);
  assert.ok(cookies.some(cookie => cookie.startsWith("rag_access_token=next-access;")));
  assert.ok(cookies.some(cookie => cookie.startsWith("rag_refresh_token=next-refresh;")));
});

test("AccessJwtAuthProvider resolves JWT identity with null sessionId and authSource", async () => {
  const token = signAccessJwt({
    secret: "test-secret",
    userId: "user-1",
    tenantId: "tenant-1",
    role: "owner",
    authSource: "github",
    issuedAtSeconds: 1,
    expiresAtSeconds: Math.floor(Date.now() / 1000) + 3600,
    tokenType: "access"
  });
  const provider = new AccessJwtAuthProvider(createRuntimeConfigService({ accessJwtSecret: "test-secret" }));

  const identity = await provider.resolveIdentity({
    request: {
      headers: {
        cookie: `rag_access_token=${token}`
      }
    }
  });

  assert.deepEqual(identity, {
    userId: "user-1",
    tenantId: "tenant-1",
    role: "owner",
    sessionId: null,
    authSource: "github"
  });
});

function createRuntimeConfigService(overrides = {}) {
  return {
    getConfig() {
      return {
        sessionCookieName: "rag_session",
        accessTokenCookieName: "rag_access_token",
        refreshTokenCookieName: "rag_refresh_token",
        oauthStateCookieName: "rag_oauth_state",
        loginProvenanceCookieName: "rag_login_provenance",
        oauthSuccessRedirectUrl: "http://localhost:5173",
        cookieSecure: false,
        cookieSameSite: "Lax",
        accessJwtSecret: "test-secret",
        ...overrides
      };
    }
  };
}

function createResponseRecorder() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    }
  };
}
