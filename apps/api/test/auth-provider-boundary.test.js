import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'vitest';
import 'reflect-metadata';

const require = createRequire(import.meta.url);
const { hashSync } = require('bcryptjs');

const {
  AUTH_OAUTH_PROVIDER_ROUTE_SHAPES,
  AuthController
} = require('../src/modules/auth/auth.controller.ts');
const {
  AuthContextMiddleware
} = require('../src/modules/auth/auth-context.middleware.ts');
const {
  AUTH_ACL_ROUTE_HOOK_KEY,
  AUTH_ROUTE_POLICY_KEY,
  DocumentPermissionHook,
  ResourcePermissionHook
} = require('../src/modules/auth/auth-route-policy.ts');
const {
  AUTH_RATE_LIMIT_KEY
} = require('../src/modules/auth/auth-rate-limit.decorator.ts');
const {
  AuthRateLimitGuard
} = require('../src/modules/auth/auth-rate-limit.guard.ts');
const {
  AuthRoutePolicyGuard
} = require('../src/modules/auth/auth-route-policy.guard.ts');
const {
  resolveCurrentAuthIdentity,
  resolveRequestAuthContext
} = require('../src/modules/auth/auth-identity.contract.ts');
const { AuthService } = require('../src/modules/auth/auth.service.ts');
const {
  AccessJwtAuthProvider
} = require('../src/modules/auth/access-jwt-auth.provider.ts');
const {
  CompositeAuthProvider
} = require('../src/modules/auth/composite-auth.provider.ts');
const { signAccessJwt } = require('../src/modules/auth/access-jwt.ts');
const {
  oauthProviderParamSchema
} = require('../src/modules/auth/auth.schemas.ts');
const {
  HttpGithubOauthProvider
} = require('../src/modules/auth/github-oauth.provider.ts');
const {
  HttpGoogleOauthProvider
} = require('../src/modules/auth/google-oauth.provider.ts');
const {
  HttpOidcOauthProvider
} = require('../src/modules/auth/oidc-oauth.provider.ts');
const { HealthController } = require('../src/common/health.controller.ts');
const {
  AssistantsController
} = require('../src/modules/assistants/assistants.controller.ts');
const { AuditController } = require('../src/modules/audit/audit.controller.ts');
const {
  ConversationsController
} = require('../src/modules/conversations/conversations.controller.ts');
const {
  DocumentsController
} = require('../src/modules/documents/documents.controller.ts');
const {
  KnowledgeBasesController
} = require('../src/modules/knowledge-bases/knowledge-bases.controller.ts');
const {
  RetrievalProfilesController
} = require('../src/modules/retrieval-profiles/retrieval-profiles.controller.ts');
const {
  TracesController
} = require('../src/modules/traces/traces.controller.ts');

function createTransactionalPrismaMock(prisma) {
  return {
    ...prisma,
    async $transaction(callback) {
      return callback(this);
    }
  };
}

test('AccessJwtAuthProvider resolves identity from access token cookie without session lookup', async () => {
  const provider = new AccessJwtAuthProvider({
    getConfig: () => ({
      accessJwtSecret: 'test-secret',
      accessTokenCookieName: 'rag_access_token'
    })
  });

  const token = signAccessJwt({
    secret: 'test-secret',
    userId: 'user-jwt-1',
    tenantId: 'tenant-jwt-1',
    role: 'owner',
    authSource: 'github',
    issuedAtSeconds: Math.floor(Date.now() / 1000),
    expiresAtSeconds: Math.floor(Date.now() / 1000) + 60,
    tokenType: 'access'
  });

  const identity = await provider.resolveIdentity({
    request: {
      headers: {
        cookie: `other=1; rag_access_token=${encodeURIComponent(token)}`
      }
    }
  });

  assert.deepEqual(identity, {
    userId: 'user-jwt-1',
    tenantId: 'tenant-jwt-1',
    role: 'owner',
    sessionId: null,
    authSource: 'github'
  });
});

test('CompositeAuthProvider delegates to JWT auth provider', async () => {
  const provider = new CompositeAuthProvider({
    resolveIdentity: async () => ({
      userId: 'user-jwt-first',
      tenantId: 'tenant-jwt-first',
      role: 'member',
      sessionId: null,
      authSource: 'local'
    })
  });

  const identity = await provider.resolveIdentity({
    request: { headers: { cookie: 'rag_access_token=token-1' } }
  });
  assert.equal(identity.userId, 'user-jwt-first');
});

test('AuthContextMiddleware injects request authContext via provider boundary', async () => {
  const middleware = new AuthContextMiddleware({
    resolveIdentity: () => ({
      userId: 'user-42',
      tenantId: 'tenant-42',
      role: 'owner',
      sessionId: 'session-42',
      authSource: 'session'
    })
  });

  const request = {
    headers: {
      cookie: 'rag_session=session-42'
    }
  };
  let nextCalled = false;

  await middleware.use(request, {}, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(request.authContext, {
    identity: {
      userId: 'user-42',
      tenantId: 'tenant-42',
      role: 'owner',
      sessionId: 'session-42',
      authSource: 'session'
    },
    currentIdentity: {
      userId: 'user-42',
      tenantId: 'tenant-42',
      role: 'owner',
      sessionId: 'session-42',
      authSource: 'session'
    }
  });
});

test('AuthContextMiddleware injects default dev identity when unauthenticated and dev mode is enabled', async () => {
  const previous = process.env.AUTH_DEV_DEFAULT_USER_MODE;
  process.env.AUTH_DEV_DEFAULT_USER_MODE = 'true';

  try {
    const middleware = new AuthContextMiddleware({
      resolveIdentity: () => null
    });

    const request = {
      headers: {
        cookie: 'other=1'
      }
    };

    await middleware.use(request, {}, () => {});

    assert.deepEqual(request.authContext, {
      identity: {
        userId: 'default-user',
        tenantId: 'default-tenant',
        role: 'owner',
        sessionId: null,
        authSource: 'dev_seed'
      },
      currentIdentity: {
        userId: 'default-user',
        tenantId: 'default-tenant',
        role: 'owner',
        sessionId: null,
        authSource: 'dev_seed'
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

test('AuthContextMiddleware keeps identity null when unauthenticated and dev mode is disabled', async () => {
  const previous = process.env.AUTH_DEV_DEFAULT_USER_MODE;
  process.env.AUTH_DEV_DEFAULT_USER_MODE = 'false';

  try {
    const middleware = new AuthContextMiddleware({
      resolveIdentity: () => null
    });

    const request = {
      headers: {
        cookie: 'other=1'
      }
    };

    await middleware.use(request, {}, () => {});

    assert.deepEqual(request.authContext, {
      identity: null,
      currentIdentity: {
        userId: 'default-user',
        tenantId: 'default-tenant',
        role: 'owner',
        sessionId: null,
        authSource: 'dev_seed'
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

test('resolveRequestAuthContext returns stable default current identity when request is unauthenticated', () => {
  const resolved = resolveRequestAuthContext({ authContext: undefined });

  assert.deepEqual(resolved, {
    identity: {
      userId: 'default-user',
      tenantId: 'default-tenant',
      role: 'owner',
      sessionId: null,
      authSource: 'dev_seed'
    }
  });
});

test('resolveCurrentAuthIdentity keeps reserved authSource values for phase-2 provider skeleton', () => {
  const reservedAuthSources = [
    'local',
    'github',
    'google',
    'oidc',
    'session',
    'dev_seed'
  ];

  for (const authSource of reservedAuthSources) {
    const resolved = resolveCurrentAuthIdentity({
      identity: {
        userId: `user-${authSource}`,
        tenantId: `tenant-${authSource}`,
        role: 'owner',
        sessionId: null,
        authSource
      }
    });

    assert.equal(resolved.authSource, authSource);
  }
});

test('oauth provider schema boundary accepts only planned providers', () => {
  const plannedProviders = ['github', 'google', 'oidc'];

  for (const provider of plannedProviders) {
    assert.deepEqual(oauthProviderParamSchema.parse({ provider }), {
      provider
    });
  }

  assert.throws(
    () => oauthProviderParamSchema.parse({ provider: 'local' }),
    /invalid|expected/i,
    'local is an authSource but not an oauth provider route param'
  );
});

test('AuthController reserves oauth provider route shapes without implementing callbacks', () => {
  assert.deepEqual(AUTH_OAUTH_PROVIDER_ROUTE_SHAPES, {
    start: '/auth/oauth/:provider/start',
    callback: '/auth/oauth/:provider/callback'
  });
});

test('AuthService startOauthProvider resolves GitHub start redirect with CSRF state', async () => {
  const previousClientId = process.env.AUTH_GITHUB_CLIENT_ID;
  const previousRedirectUri = process.env.AUTH_GITHUB_REDIRECT_URI;
  const previousScope = process.env.AUTH_GITHUB_SCOPE;

  process.env.AUTH_GITHUB_CLIENT_ID = 'github-client-id';
  process.env.AUTH_GITHUB_REDIRECT_URI =
    'http://localhost:3000/auth/oauth/github/callback';
  process.env.AUTH_GITHUB_SCOPE = 'read:user user:email';

  try {
    const authService = new AuthService({});
    const result = await authService.startOauthProvider({ provider: 'github' });
    const redirectUrl = new URL(result.redirectUrl);

    assert.equal(result.provider, 'github');
    assert.equal(result.stateCookieName, 'rag_oauth_state');
    assert.ok(result.state.length > 0);
    assert.equal(result.stateTtlSeconds, 600);
    assert.equal(
      redirectUrl.origin + redirectUrl.pathname,
      'https://github.com/login/oauth/authorize'
    );
    assert.equal(redirectUrl.searchParams.get('client_id'), 'github-client-id');
    assert.equal(
      redirectUrl.searchParams.get('redirect_uri'),
      'http://localhost:3000/auth/oauth/github/callback'
    );
    assert.equal(redirectUrl.searchParams.get('scope'), 'read:user user:email');
    assert.equal(redirectUrl.searchParams.get('state'), result.state);
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

test('AuthService startOauthProvider fails clearly when GitHub OAuth config is missing', async () => {
  const previousClientId = process.env.AUTH_GITHUB_CLIENT_ID;
  const previousRedirectUri = process.env.AUTH_GITHUB_REDIRECT_URI;

  delete process.env.AUTH_GITHUB_CLIENT_ID;
  delete process.env.AUTH_GITHUB_REDIRECT_URI;

  try {
    const authService = new AuthService({});
    await assert.rejects(
      () => authService.startOauthProvider({ provider: 'github' }),
      /GitHub OAuth start is not configured\. Required env:/i
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

test('AuthService startOauthProvider resolves OIDC redirect via discovery authorization endpoint', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      authorization_endpoint: 'https://accounts.example.com/authorize'
    })
  });

  const authService = new AuthService({}, undefined, undefined, {
    resolveStartConfig: () => ({
      issuer: 'https://accounts.example.com',
      discoveryUrl:
        'https://accounts.example.com/.well-known/openid-configuration',
      clientId: 'oidc-client-id',
      redirectUri: 'http://localhost:3000/auth/oauth/oidc/callback',
      scope: 'openid email profile',
      stateCookieName: 'rag_oauth_state',
      stateTtlSeconds: 600
    })
  });

  try {
    const result = await authService.startOauthProvider({ provider: 'oidc' });
    const redirectUrl = new URL(result.redirectUrl);

    assert.equal(result.provider, 'oidc');
    assert.equal(result.stateCookieName, 'rag_oauth_state');
    assert.ok(result.state.length > 0);
    assert.equal(result.stateTtlSeconds, 600);
    assert.equal(
      redirectUrl.origin + redirectUrl.pathname,
      'https://accounts.example.com/authorize'
    );
    assert.equal(redirectUrl.searchParams.get('client_id'), 'oidc-client-id');
    assert.equal(
      redirectUrl.searchParams.get('redirect_uri'),
      'http://localhost:3000/auth/oauth/oidc/callback'
    );
    assert.equal(redirectUrl.searchParams.get('scope'), 'openid email profile');
    assert.equal(redirectUrl.searchParams.get('response_type'), 'code');
    assert.equal(redirectUrl.searchParams.get('state'), result.state);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('AuthService startOauthProvider fails clearly when OIDC OAuth config is missing', async () => {
  const previousIssuer = process.env.AUTH_OIDC_ISSUER;
  const previousClientId = process.env.AUTH_OIDC_CLIENT_ID;
  const previousRedirectUri = process.env.AUTH_OIDC_REDIRECT_URI;

  delete process.env.AUTH_OIDC_ISSUER;
  delete process.env.AUTH_OIDC_CLIENT_ID;
  delete process.env.AUTH_OIDC_REDIRECT_URI;

  try {
    const authService = new AuthService({});
    await assert.rejects(
      () => authService.startOauthProvider({ provider: 'oidc' }),
      /OIDC OAuth config is not configured\. Required env: AUTH_OIDC_ISSUER\./i
    );
  } finally {
    if (previousIssuer == null) {
      delete process.env.AUTH_OIDC_ISSUER;
    } else {
      process.env.AUTH_OIDC_ISSUER = previousIssuer;
    }

    if (previousClientId == null) {
      delete process.env.AUTH_OIDC_CLIENT_ID;
    } else {
      process.env.AUTH_OIDC_CLIENT_ID = previousClientId;
    }

    if (previousRedirectUri == null) {
      delete process.env.AUTH_OIDC_REDIRECT_URI;
    } else {
      process.env.AUTH_OIDC_REDIRECT_URI = previousRedirectUri;
    }
  }
});

test('AuthService startOauthProvider resolves Google start redirect with CSRF state', async () => {
  const previousClientId = process.env.AUTH_GOOGLE_CLIENT_ID;
  const previousRedirectUri = process.env.AUTH_GOOGLE_REDIRECT_URI;
  const previousScope = process.env.AUTH_GOOGLE_SCOPE;

  process.env.AUTH_GOOGLE_CLIENT_ID = 'google-client-id';
  process.env.AUTH_GOOGLE_REDIRECT_URI =
    'http://localhost:3000/auth/oauth/google/callback';
  process.env.AUTH_GOOGLE_SCOPE = 'openid email profile';

  try {
    const authService = new AuthService({});
    const result = await authService.startOauthProvider({ provider: 'google' });
    const redirectUrl = new URL(result.redirectUrl);

    assert.equal(result.provider, 'google');
    assert.equal(result.stateCookieName, 'rag_oauth_state');
    assert.ok(result.state.length > 0);
    assert.equal(result.stateTtlSeconds, 600);
    assert.equal(
      redirectUrl.origin + redirectUrl.pathname,
      'https://accounts.google.com/o/oauth2/v2/auth'
    );
    assert.equal(redirectUrl.searchParams.get('client_id'), 'google-client-id');
    assert.equal(
      redirectUrl.searchParams.get('redirect_uri'),
      'http://localhost:3000/auth/oauth/google/callback'
    );
    assert.equal(redirectUrl.searchParams.get('scope'), 'openid email profile');
    assert.equal(redirectUrl.searchParams.get('response_type'), 'code');
    assert.equal(redirectUrl.searchParams.get('state'), result.state);
  } finally {
    if (previousClientId == null) {
      delete process.env.AUTH_GOOGLE_CLIENT_ID;
    } else {
      process.env.AUTH_GOOGLE_CLIENT_ID = previousClientId;
    }

    if (previousRedirectUri == null) {
      delete process.env.AUTH_GOOGLE_REDIRECT_URI;
    } else {
      process.env.AUTH_GOOGLE_REDIRECT_URI = previousRedirectUri;
    }

    if (previousScope == null) {
      delete process.env.AUTH_GOOGLE_SCOPE;
    } else {
      process.env.AUTH_GOOGLE_SCOPE = previousScope;
    }
  }
});

test('AuthService startOauthProvider fails clearly when Google OAuth config is missing', async () => {
  const previousClientId = process.env.AUTH_GOOGLE_CLIENT_ID;
  const previousRedirectUri = process.env.AUTH_GOOGLE_REDIRECT_URI;

  delete process.env.AUTH_GOOGLE_CLIENT_ID;
  delete process.env.AUTH_GOOGLE_REDIRECT_URI;

  try {
    const authService = new AuthService({});
    await assert.rejects(
      () => authService.startOauthProvider({ provider: 'google' }),
      /Google OAuth start is not configured\. Required env:/i
    );
  } finally {
    if (previousClientId == null) {
      delete process.env.AUTH_GOOGLE_CLIENT_ID;
    } else {
      process.env.AUTH_GOOGLE_CLIENT_ID = previousClientId;
    }

    if (previousRedirectUri == null) {
      delete process.env.AUTH_GOOGLE_REDIRECT_URI;
    } else {
      process.env.AUTH_GOOGLE_REDIRECT_URI = previousRedirectUri;
    }
  }
});

test('OAuth provider callback config failures use the same readability boundary shape', async () => {
  const previousGithubClientId = process.env.AUTH_GITHUB_CLIENT_ID;
  const previousGithubClientSecret = process.env.AUTH_GITHUB_CLIENT_SECRET;
  const previousGithubRedirectUri = process.env.AUTH_GITHUB_REDIRECT_URI;
  const previousGoogleClientId = process.env.AUTH_GOOGLE_CLIENT_ID;
  const previousGoogleClientSecret = process.env.AUTH_GOOGLE_CLIENT_SECRET;
  const previousGoogleRedirectUri = process.env.AUTH_GOOGLE_REDIRECT_URI;

  delete process.env.AUTH_GITHUB_CLIENT_ID;
  delete process.env.AUTH_GITHUB_CLIENT_SECRET;
  delete process.env.AUTH_GITHUB_REDIRECT_URI;
  delete process.env.AUTH_GOOGLE_CLIENT_ID;
  delete process.env.AUTH_GOOGLE_CLIENT_SECRET;
  delete process.env.AUTH_GOOGLE_REDIRECT_URI;

  try {
    const githubProvider = new HttpGithubOauthProvider();
    const googleProvider = new HttpGoogleOauthProvider();

    await assert.rejects(
      () => githubProvider.exchangeCodeForIdentity({ code: 'github-code' }),
      /GitHub OAuth callback is not configured\. Required env:/i
    );
    await assert.rejects(
      () => googleProvider.exchangeCodeForIdentity({ code: 'google-code' }),
      /Google OAuth callback is not configured\. Required env:/i
    );
  } finally {
    if (previousGithubClientId == null) {
      delete process.env.AUTH_GITHUB_CLIENT_ID;
    } else {
      process.env.AUTH_GITHUB_CLIENT_ID = previousGithubClientId;
    }

    if (previousGithubClientSecret == null) {
      delete process.env.AUTH_GITHUB_CLIENT_SECRET;
    } else {
      process.env.AUTH_GITHUB_CLIENT_SECRET = previousGithubClientSecret;
    }

    if (previousGithubRedirectUri == null) {
      delete process.env.AUTH_GITHUB_REDIRECT_URI;
    } else {
      process.env.AUTH_GITHUB_REDIRECT_URI = previousGithubRedirectUri;
    }

    if (previousGoogleClientId == null) {
      delete process.env.AUTH_GOOGLE_CLIENT_ID;
    } else {
      process.env.AUTH_GOOGLE_CLIENT_ID = previousGoogleClientId;
    }

    if (previousGoogleClientSecret == null) {
      delete process.env.AUTH_GOOGLE_CLIENT_SECRET;
    } else {
      process.env.AUTH_GOOGLE_CLIENT_SECRET = previousGoogleClientSecret;
    }

    if (previousGoogleRedirectUri == null) {
      delete process.env.AUTH_GOOGLE_REDIRECT_URI;
    } else {
      process.env.AUTH_GOOGLE_REDIRECT_URI = previousGoogleRedirectUri;
    }
  }
});

test('OIDC provider config boundary resolves start and callback config for reserved oidc slot', () => {
  const previousIssuer = process.env.AUTH_OIDC_ISSUER;
  const previousClientId = process.env.AUTH_OIDC_CLIENT_ID;
  const previousClientSecret = process.env.AUTH_OIDC_CLIENT_SECRET;
  const previousRedirectUri = process.env.AUTH_OIDC_REDIRECT_URI;
  const previousScope = process.env.AUTH_OIDC_SCOPE;

  process.env.AUTH_OIDC_ISSUER = 'https://accounts.example.com/';
  process.env.AUTH_OIDC_CLIENT_ID = 'oidc-client-id';
  process.env.AUTH_OIDC_CLIENT_SECRET = 'oidc-client-secret';
  process.env.AUTH_OIDC_REDIRECT_URI =
    'http://localhost:3000/auth/oauth/oidc/callback';
  process.env.AUTH_OIDC_SCOPE = 'openid profile email';

  try {
    const oidcProvider = new HttpOidcOauthProvider();
    const startConfig = oidcProvider.resolveStartConfig();
    const callbackConfig = oidcProvider.resolveCallbackConfig();

    assert.equal(startConfig.issuer, 'https://accounts.example.com');
    assert.equal(
      startConfig.discoveryUrl,
      'https://accounts.example.com/.well-known/openid-configuration'
    );
    assert.equal(startConfig.clientId, 'oidc-client-id');
    assert.equal(
      startConfig.redirectUri,
      'http://localhost:3000/auth/oauth/oidc/callback'
    );
    assert.equal(startConfig.scope, 'openid profile email');
    assert.equal(startConfig.stateCookieName, 'rag_oauth_state');
    assert.equal(startConfig.stateTtlSeconds, 600);

    assert.equal(callbackConfig.issuer, 'https://accounts.example.com');
    assert.equal(
      callbackConfig.discoveryUrl,
      'https://accounts.example.com/.well-known/openid-configuration'
    );
    assert.equal(callbackConfig.clientId, 'oidc-client-id');
    assert.equal(callbackConfig.clientSecret, 'oidc-client-secret');
    assert.equal(
      callbackConfig.redirectUri,
      'http://localhost:3000/auth/oauth/oidc/callback'
    );
  } finally {
    if (previousIssuer == null) {
      delete process.env.AUTH_OIDC_ISSUER;
    } else {
      process.env.AUTH_OIDC_ISSUER = previousIssuer;
    }

    if (previousClientId == null) {
      delete process.env.AUTH_OIDC_CLIENT_ID;
    } else {
      process.env.AUTH_OIDC_CLIENT_ID = previousClientId;
    }

    if (previousClientSecret == null) {
      delete process.env.AUTH_OIDC_CLIENT_SECRET;
    } else {
      process.env.AUTH_OIDC_CLIENT_SECRET = previousClientSecret;
    }

    if (previousRedirectUri == null) {
      delete process.env.AUTH_OIDC_REDIRECT_URI;
    } else {
      process.env.AUTH_OIDC_REDIRECT_URI = previousRedirectUri;
    }

    if (previousScope == null) {
      delete process.env.AUTH_OIDC_SCOPE;
    } else {
      process.env.AUTH_OIDC_SCOPE = previousScope;
    }
  }
});

test('OIDC provider config boundary fails clearly when required env is missing', () => {
  const previousIssuer = process.env.AUTH_OIDC_ISSUER;
  const previousClientId = process.env.AUTH_OIDC_CLIENT_ID;
  const previousClientSecret = process.env.AUTH_OIDC_CLIENT_SECRET;
  const previousRedirectUri = process.env.AUTH_OIDC_REDIRECT_URI;

  delete process.env.AUTH_OIDC_ISSUER;
  delete process.env.AUTH_OIDC_CLIENT_ID;
  delete process.env.AUTH_OIDC_CLIENT_SECRET;
  delete process.env.AUTH_OIDC_REDIRECT_URI;

  try {
    const oidcProvider = new HttpOidcOauthProvider();

    assert.throws(
      () => oidcProvider.resolveStartConfig(),
      /OIDC OAuth config is not configured\. Required env: AUTH_OIDC_ISSUER\./i
    );

    process.env.AUTH_OIDC_ISSUER = 'https://accounts.example.com';

    assert.throws(
      () => oidcProvider.resolveStartConfig(),
      /OIDC OAuth start is not configured\. Required env: AUTH_OIDC_ISSUER, AUTH_OIDC_CLIENT_ID, AUTH_OIDC_REDIRECT_URI\./i
    );
    assert.throws(
      () => oidcProvider.resolveCallbackConfig(),
      /OIDC OAuth callback is not configured\. Required env: AUTH_OIDC_ISSUER, AUTH_OIDC_CLIENT_ID, AUTH_OIDC_CLIENT_SECRET, AUTH_OIDC_REDIRECT_URI\./i
    );
  } finally {
    if (previousIssuer == null) {
      delete process.env.AUTH_OIDC_ISSUER;
    } else {
      process.env.AUTH_OIDC_ISSUER = previousIssuer;
    }

    if (previousClientId == null) {
      delete process.env.AUTH_OIDC_CLIENT_ID;
    } else {
      process.env.AUTH_OIDC_CLIENT_ID = previousClientId;
    }

    if (previousClientSecret == null) {
      delete process.env.AUTH_OIDC_CLIENT_SECRET;
    } else {
      process.env.AUTH_OIDC_CLIENT_SECRET = previousClientSecret;
    }

    if (previousRedirectUri == null) {
      delete process.env.AUTH_OIDC_REDIRECT_URI;
    } else {
      process.env.AUTH_OIDC_REDIRECT_URI = previousRedirectUri;
    }
  }
});

test('OIDC provider exchanges callback code and resolves identity from discovery metadata', async () => {
  const previousIssuer = process.env.AUTH_OIDC_ISSUER;
  const previousClientId = process.env.AUTH_OIDC_CLIENT_ID;
  const previousClientSecret = process.env.AUTH_OIDC_CLIENT_SECRET;
  const previousRedirectUri = process.env.AUTH_OIDC_REDIRECT_URI;
  const previousFetch = globalThis.fetch;

  process.env.AUTH_OIDC_ISSUER = 'https://accounts.example.com';
  process.env.AUTH_OIDC_CLIENT_ID = 'oidc-client-id';
  process.env.AUTH_OIDC_CLIENT_SECRET = 'oidc-client-secret';
  process.env.AUTH_OIDC_REDIRECT_URI =
    'http://localhost:3000/auth/oauth/oidc/callback';

  const observedRequests = [];
  globalThis.fetch = async (url, options = {}) => {
    observedRequests.push({ url, options });
    const normalizedUrl = typeof url === 'string' ? url : url.toString();

    if (normalizedUrl.endsWith('/.well-known/openid-configuration')) {
      return {
        ok: true,
        json: async () => ({
          token_endpoint: 'https://accounts.example.com/oauth/token',
          userinfo_endpoint: 'https://accounts.example.com/oauth/userinfo'
        })
      };
    }

    if (normalizedUrl === 'https://accounts.example.com/oauth/token') {
      assert.equal(options.method, 'POST');
      assert.match(options.body, /grant_type=authorization_code/);
      return {
        ok: true,
        json: async () => ({
          access_token: 'oidc-access-token'
        })
      };
    }

    if (normalizedUrl === 'https://accounts.example.com/oauth/userinfo') {
      assert.equal(options.headers.Authorization, 'Bearer oidc-access-token');
      return {
        ok: true,
        json: async () => ({
          sub: 'oidc-subject-abc',
          email: 'oidc-user@example.com',
          name: 'OIDC User'
        })
      };
    }

    throw new Error(`Unexpected fetch URL: ${normalizedUrl}`);
  };

  try {
    const oidcProvider = new HttpOidcOauthProvider();
    const identity = await oidcProvider.exchangeCodeForIdentity({
      code: 'oidc-code-123'
    });

    assert.deepEqual(identity, {
      subject: 'oidc-subject-abc',
      email: 'oidc-user@example.com',
      profileSnapshot: {
        sub: 'oidc-subject-abc',
        email: 'oidc-user@example.com',
        name: 'OIDC User'
      }
    });
    assert.equal(observedRequests.length, 3);
  } finally {
    globalThis.fetch = previousFetch;

    if (previousIssuer == null) {
      delete process.env.AUTH_OIDC_ISSUER;
    } else {
      process.env.AUTH_OIDC_ISSUER = previousIssuer;
    }

    if (previousClientId == null) {
      delete process.env.AUTH_OIDC_CLIENT_ID;
    } else {
      process.env.AUTH_OIDC_CLIENT_ID = previousClientId;
    }

    if (previousClientSecret == null) {
      delete process.env.AUTH_OIDC_CLIENT_SECRET;
    } else {
      process.env.AUTH_OIDC_CLIENT_SECRET = previousClientSecret;
    }

    if (previousRedirectUri == null) {
      delete process.env.AUTH_OIDC_REDIRECT_URI;
    } else {
      process.env.AUTH_OIDC_REDIRECT_URI = previousRedirectUri;
    }
  }
});

test('AuthController oauthProviderStart sets state cookie and redirects to GitHub', async () => {
  const previousClientId = process.env.AUTH_GITHUB_CLIENT_ID;
  const previousRedirectUri = process.env.AUTH_GITHUB_REDIRECT_URI;

  process.env.AUTH_GITHUB_CLIENT_ID = 'github-client-id';
  process.env.AUTH_GITHUB_REDIRECT_URI =
    'http://localhost:3000/auth/oauth/github/callback';

  try {
    const cookies = [];
    const redirects = [];
    const controller = new AuthController(new AuthService({}));

    await controller.oauthProviderStart(
      {
        provider: 'github'
      },
      {
        setHeader: (name, value) => {
          if (name === 'Set-Cookie') {
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
    assert.match(
      redirects[0].url,
      /^https:\/\/github\.com\/login\/oauth\/authorize\?/
    );
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

test('AuthController oauthProviderStart sets state cookie and redirects to Google', async () => {
  const previousClientId = process.env.AUTH_GOOGLE_CLIENT_ID;
  const previousRedirectUri = process.env.AUTH_GOOGLE_REDIRECT_URI;

  process.env.AUTH_GOOGLE_CLIENT_ID = 'google-client-id';
  process.env.AUTH_GOOGLE_REDIRECT_URI =
    'http://localhost:3000/auth/oauth/google/callback';

  try {
    const cookies = [];
    const redirects = [];
    const controller = new AuthController(new AuthService({}));

    await controller.oauthProviderStart(
      {
        provider: 'google'
      },
      {
        setHeader: (name, value) => {
          if (name === 'Set-Cookie') {
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
    assert.match(
      redirects[0].url,
      /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/
    );
    assert.match(redirects[0].url, /client_id=google-client-id/);
    assert.match(redirects[0].url, /response_type=code/);
    assert.match(redirects[0].url, /state=/);
  } finally {
    if (previousClientId == null) {
      delete process.env.AUTH_GOOGLE_CLIENT_ID;
    } else {
      process.env.AUTH_GOOGLE_CLIENT_ID = previousClientId;
    }

    if (previousRedirectUri == null) {
      delete process.env.AUTH_GOOGLE_REDIRECT_URI;
    } else {
      process.env.AUTH_GOOGLE_REDIRECT_URI = previousRedirectUri;
    }
  }
});

test('AuthController oauthProviderStart sets state cookie and redirects to OIDC', async () => {
  const cookies = [];
  const redirects = [];
  const controller = new AuthController(
    new AuthService({}, undefined, undefined, {
      resolveStartConfig: () => ({
        issuer: 'https://accounts.example.com',
        discoveryUrl:
          'https://accounts.example.com/.well-known/openid-configuration',
        clientId: 'oidc-client-id',
        redirectUri: 'http://localhost:3000/auth/oauth/oidc/callback',
        scope: 'openid email profile',
        stateCookieName: 'rag_oauth_state',
        stateTtlSeconds: 600
      }),
      exchangeCodeForIdentity: async () => {
        throw new Error(
          'oidc callback provider should not be used for start test'
        );
      }
    })
  );

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      authorization_endpoint: 'https://accounts.example.com/authorize'
    })
  });

  try {
    await controller.oauthProviderStart(
      {
        provider: 'oidc'
      },
      {
        setHeader: (name, value) => {
          if (name === 'Set-Cookie') {
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
    assert.match(
      redirects[0].url,
      /^https:\/\/accounts\.example\.com\/authorize\?/
    );
    assert.match(redirects[0].url, /client_id=oidc-client-id/);
    assert.match(redirects[0].url, /response_type=code/);
    assert.match(redirects[0].url, /state=/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('AuthService completeOauthProviderCallback reuses local user by email and returns JWT identity', async () => {
  const calls = {
    linkLookup: null,
    userLookup: null,
    linkCreate: null
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async ({ where }) => {
          calls.linkLookup = where;
          return null;
        },
        create: async ({ data }) => {
          calls.linkCreate = data;
          return { id: 'link-1' };
        }
      },
      user: {
        findUnique: async ({ where }) => {
          calls.userLookup = where;
          return {
            id: 'user-existing',
            tenantId: 'tenant-1',
            role: 'member',
            status: 'active'
          };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async ({ code }) => {
        assert.equal(code, 'github-code-123');
        return {
          subject: 'github-subject-123',
          email: 'existing@example.com',
          profileSnapshot: {
            id: 123,
            login: 'existing-user'
          }
        };
      }
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'github',
    code: 'github-code-123',
    state: 'state-1',
    expectedState: 'state-1'
  });

  assert.equal(result.identity.userId, 'user-existing');
  assert.equal(result.identity.tenantId, 'tenant-1');
  assert.equal(result.identity.sessionId, null);
  assert.equal(result.identity.authSource, 'github');
  assert.deepEqual(calls.linkLookup, {
    provider_subject: {
      provider: 'github',
      subject: 'github-subject-123'
    }
  });
  assert.deepEqual(calls.userLookup, { email: 'existing@example.com' });
  assert.equal(calls.linkCreate.userId, 'user-existing');
  assert.equal(calls.linkCreate.provider, 'github');
  assert.equal(calls.linkCreate.subject, 'github-subject-123');
  assert.equal(calls.linkCreate.emailSnapshot, 'existing@example.com');
  assert.ok(calls.linkCreate.lastLoginAt instanceof Date);
  assert.ok(typeof result.accessToken === 'string');
  assert.ok(typeof result.refreshToken === 'string');
});

test('AuthService completeOauthProviderCallback supports Google with the same identity-link JWT pattern', async () => {
  const calls = {
    linkLookup: null,
    userLookup: null,
    linkCreate: null
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async ({ where }) => {
          calls.linkLookup = where;
          return null;
        },
        create: async ({ data }) => {
          calls.linkCreate = data;
          return { id: 'link-google-1' };
        }
      },
      user: {
        findUnique: async ({ where }) => {
          calls.userLookup = where;
          return {
            id: 'user-google-existing',
            tenantId: 'tenant-google-1',
            role: 'owner',
            status: 'active'
          };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async () => {
        throw new Error(
          'github provider should not be used for google callback'
        );
      }
    },
    {
      exchangeCodeForIdentity: async ({ code }) => {
        assert.equal(code, 'google-code-123');
        return {
          subject: 'google-subject-123',
          email: 'google-existing@example.com',
          profileSnapshot: {
            sub: 'google-subject-123',
            name: 'Google Existing User'
          }
        };
      }
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'google',
    code: 'google-code-123',
    state: 'state-google-1',
    expectedState: 'state-google-1'
  });

  assert.equal(result.identity.userId, 'user-google-existing');
  assert.equal(result.identity.tenantId, 'tenant-google-1');
  assert.equal(result.identity.sessionId, null);
  assert.equal(result.identity.authSource, 'google');
  assert.deepEqual(calls.linkLookup, {
    provider_subject: {
      provider: 'google',
      subject: 'google-subject-123'
    }
  });
  assert.deepEqual(calls.userLookup, { email: 'google-existing@example.com' });
  assert.equal(calls.linkCreate.userId, 'user-google-existing');
  assert.equal(calls.linkCreate.provider, 'google');
  assert.equal(calls.linkCreate.subject, 'google-subject-123');
  assert.equal(calls.linkCreate.emailSnapshot, 'google-existing@example.com');
  assert.ok(calls.linkCreate.lastLoginAt instanceof Date);
  assert.ok(typeof result.accessToken === 'string');
  assert.ok(typeof result.refreshToken === 'string');
});

test('AuthService completeOauthProviderCallback supports OIDC with the same identity-link JWT pattern', async () => {
  const calls = {
    linkLookup: null,
    userLookup: null,
    linkCreate: null
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async ({ where }) => {
          calls.linkLookup = where;
          return null;
        },
        create: async ({ data }) => {
          calls.linkCreate = data;
          return { id: 'link-oidc-1' };
        }
      },
      user: {
        findUnique: async ({ where }) => {
          calls.userLookup = where;
          return {
            id: 'user-oidc-existing',
            tenantId: 'tenant-oidc-1',
            role: 'member',
            status: 'active'
          };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async () => {
        throw new Error('github provider should not be used for oidc callback');
      }
    },
    {
      exchangeCodeForIdentity: async () => {
        throw new Error('google provider should not be used for oidc callback');
      }
    },
    {
      exchangeCodeForIdentity: async ({ code }) => {
        assert.equal(code, 'oidc-code-123');
        return {
          subject: 'oidc-subject-123',
          email: 'oidc-existing@example.com',
          profileSnapshot: {
            sub: 'oidc-subject-123',
            name: 'OIDC Existing User'
          }
        };
      }
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'oidc',
    code: 'oidc-code-123',
    state: 'state-oidc-1',
    expectedState: 'state-oidc-1'
  });

  assert.equal(result.identity.userId, 'user-oidc-existing');
  assert.equal(result.identity.tenantId, 'tenant-oidc-1');
  assert.equal(result.identity.sessionId, null);
  assert.equal(result.identity.authSource, 'oidc');
  assert.deepEqual(calls.linkLookup, {
    provider_subject: {
      provider: 'oidc',
      subject: 'oidc-subject-123'
    }
  });
  assert.deepEqual(calls.userLookup, { email: 'oidc-existing@example.com' });
  assert.equal(calls.linkCreate.userId, 'user-oidc-existing');
  assert.equal(calls.linkCreate.provider, 'oidc');
  assert.equal(calls.linkCreate.subject, 'oidc-subject-123');
  assert.equal(calls.linkCreate.emailSnapshot, 'oidc-existing@example.com');
  assert.ok(calls.linkCreate.lastLoginAt instanceof Date);
  assert.ok(typeof result.accessToken === 'string');
  assert.ok(typeof result.refreshToken === 'string');
});

test('AuthService completeOauthProviderCallback provisions a default workspace for a newly created OAuth user', async () => {
  const calls = {
    tenantLookup: null,
    userCreate: null,
    linkCreate: null,
    knowledgeBaseLookup: null,
    knowledgeBaseCreate: null,
    retrievalProfileLookup: null,
    retrievalProfileCreate: null,
    assistantLookup: null,
    assistantCreate: null
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async () => null,
        create: async ({ data }) => {
          calls.linkCreate = data;
          return { id: 'link-oauth-new-1' };
        }
      },
      user: {
        findUnique: async () => null,
        create: async ({ data }) => {
          calls.userCreate = data;
          return {
            id: 'user-oauth-new-1',
            tenantId: 'default-tenant',
            role: 'owner',
            status: 'active'
          };
        }
      },
      tenant: {
        findUnique: async ({ where }) => {
          calls.tenantLookup = where;
          return { id: 'default-tenant' };
        }
      },
      knowledgeBase: {
        findFirst: async ({ where }) => {
          calls.knowledgeBaseLookup = where;
          return null;
        },
        create: async ({ data }) => {
          calls.knowledgeBaseCreate = data;
          return { id: 'kb-oauth-new-1' };
        }
      },
      retrievalProfile: {
        findFirst: async ({ where }) => {
          calls.retrievalProfileLookup = where;
          return null;
        },
        create: async ({ data }) => {
          calls.retrievalProfileCreate = data;
          return { id: 'rp-oauth-new-1' };
        }
      },
      assistant: {
        findFirst: async ({ where }) => {
          calls.assistantLookup = where;
          return null;
        },
        create: async ({ data }) => {
          calls.assistantCreate = data;
          return { id: 'assistant-oauth-new-1' };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async ({ code }) => {
        assert.equal(code, 'github-code-new-1');
        return {
          subject: 'github-subject-new-1',
          email: 'oauth-new@example.com',
          profileSnapshot: {
            id: 999,
            login: 'oauth-new-user',
            name: 'OAuth New User'
          }
        };
      }
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'github',
    code: 'github-code-new-1',
    state: 'state-oauth-new-1',
    expectedState: 'state-oauth-new-1'
  });

  assert.equal(result.identity.userId, 'user-oauth-new-1');
  assert.equal(result.identity.tenantId, 'default-tenant');
  assert.equal(result.identity.sessionId, null);
  assert.equal(result.identity.authSource, 'github');
  assert.deepEqual(calls.tenantLookup, { id: 'default-tenant' });
  assert.equal(calls.userCreate.tenantId, 'default-tenant');
  assert.equal(calls.userCreate.email, 'oauth-new@example.com');
  assert.equal(calls.linkCreate.userId, 'user-oauth-new-1');
  assert.deepEqual(calls.knowledgeBaseLookup, {
    tenantId: 'default-tenant',
    ownerId: 'user-oauth-new-1'
  });
  assert.equal(calls.knowledgeBaseCreate.ownerId, 'user-oauth-new-1');
  assert.deepEqual(calls.retrievalProfileLookup, {
    tenantId: 'default-tenant',
    ownerId: 'user-oauth-new-1'
  });
  assert.equal(calls.retrievalProfileCreate.ownerId, 'user-oauth-new-1');
  assert.deepEqual(calls.assistantLookup, {
    tenantId: 'default-tenant',
    kbId: 'kb-oauth-new-1'
  });
  assert.equal(calls.assistantCreate.kbId, 'kb-oauth-new-1');
  assert.equal(calls.knowledgeBaseCreate.name, 'Default Knowledge Base');
  assert.equal(
    calls.knowledgeBaseCreate.description,
    'Primary knowledge base for the default assistant.'
  );
  assert.equal(calls.retrievalProfileCreate.name, 'Default Retrieval Profile');
  assert.equal(calls.assistantCreate.name, 'Default Assistant');
  assert.equal(
    calls.assistantCreate.description,
    'Default assistant for the primary knowledge base.'
  );
  assert.equal(calls.assistantCreate.retrievalProfileId, 'rp-oauth-new-1');
  assert.ok(typeof result.accessToken === 'string');
  assert.ok(typeof result.refreshToken === 'string');
});

test('AuthService completeOauthProviderCallback repairs the default assistant when the primary knowledge base is already provisioned', async () => {
  const calls = {
    assistantLookup: null,
    assistantUpdate: null
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async () => null,
        create: async () => ({ id: 'link-oauth-repair-1' })
      },
      user: {
        findUnique: async () => null,
        create: async () => ({
          id: 'user-oauth-repair-1',
          tenantId: 'default-tenant',
          role: 'owner',
          status: 'active'
        })
      },
      tenant: {
        findUnique: async () => ({ id: 'default-tenant' })
      },
      knowledgeBase: {
        findFirst: async () => ({ id: 'kb-oauth-repair-1' }),
        create: async () => {
          throw new Error(
            'knowledge base should not be created when one already exists'
          );
        }
      },
      retrievalProfile: {
        findFirst: async () => ({ id: 'rp-oauth-repair-1' }),
        create: async () => {
          throw new Error(
            'retrieval profile should not be created when one already exists'
          );
        }
      },
      assistant: {
        findFirst: async ({ where }) => {
          calls.assistantLookup = where;
          return {
            id: 'assistant-oauth-repair-1',
            kbId: 'kb-stale-1',
            retrievalProfileId: 'rp-stale-1',
            status: 'inactive'
          };
        },
        create: async () => {
          throw new Error(
            'assistant should not be created when the default assistant can be repaired'
          );
        },
        update: async ({ where, data }) => {
          calls.assistantUpdate = { where, data };
          return { id: 'assistant-oauth-repair-1' };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async () => ({
        subject: 'github-subject-repair-1',
        email: 'oauth-repair@example.com',
        profileSnapshot: {
          id: 1999,
          login: 'oauth-repair-user',
          name: 'OAuth Repair User'
        }
      })
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'github',
    code: 'github-code-repair-1',
    state: 'state-oauth-repair-1',
    expectedState: 'state-oauth-repair-1'
  });

  assert.equal(result.identity.userId, 'user-oauth-repair-1');
  assert.deepEqual(calls.assistantLookup, {
    AND: [
      {
        tenantId: 'default-tenant',
        kbId: 'kb-oauth-repair-1'
      },
      {
        name: 'Default Assistant'
      }
    ]
  });
  assert.deepEqual(calls.assistantUpdate, {
    where: {
      id: 'assistant-oauth-repair-1'
    },
    data: {
      kbId: 'kb-oauth-repair-1',
      retrievalProfileId: 'rp-oauth-repair-1',
      status: 'active'
    }
  });
});

test('AuthService completeOauthProviderCallback repairs a stale owner assistant when no assistant is bound to the primary knowledge base', async () => {
  const calls = {
    assistantLookups: [],
    assistantUpdate: null
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async () => null,
        create: async () => ({ id: 'link-oauth-repair-owner-fallback-1' })
      },
      user: {
        findUnique: async () => null,
        create: async () => ({
          id: 'user-oauth-repair-owner-fallback-1',
          tenantId: 'default-tenant',
          role: 'owner',
          status: 'active'
        })
      },
      tenant: {
        findUnique: async () => ({ id: 'default-tenant' })
      },
      knowledgeBase: {
        findFirst: async () => ({ id: 'kb-oauth-repair-owner-fallback-1' }),
        create: async () => {
          throw new Error(
            'knowledge base should not be created when one already exists'
          );
        }
      },
      retrievalProfile: {
        findFirst: async () => ({ id: 'rp-oauth-repair-owner-fallback-1' }),
        create: async () => {
          throw new Error(
            'retrieval profile should not be created when one already exists'
          );
        }
      },
      assistant: {
        findFirst: async ({ where }) => {
          calls.assistantLookups.push(where);
          const kbScopedLookup =
            where.kbId === 'kb-oauth-repair-owner-fallback-1' ||
            where.AND?.some(
              (entry) => entry?.kbId === 'kb-oauth-repair-owner-fallback-1'
            );
          if (kbScopedLookup) {
            return null;
          }

          return {
            id: 'assistant-oauth-repair-owner-fallback-1',
            kbId: 'kb-stale-owner-1',
            retrievalProfileId: 'rp-stale-owner-1',
            status: 'inactive'
          };
        },
        create: async () => {
          throw new Error(
            'assistant should not be created when an owner assistant can be repaired'
          );
        },
        update: async ({ where, data }) => {
          calls.assistantUpdate = { where, data };
          return { id: 'assistant-oauth-repair-owner-fallback-1' };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async () => ({
        subject: 'github-subject-repair-owner-fallback-1',
        email: 'oauth-repair-owner-fallback@example.com',
        profileSnapshot: {
          id: 2999,
          login: 'oauth-repair-owner-fallback-user',
          name: 'OAuth Repair Owner Fallback User'
        }
      })
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'github',
    code: 'github-code-repair-owner-fallback-1',
    state: 'state-oauth-repair-owner-fallback-1',
    expectedState: 'state-oauth-repair-owner-fallback-1'
  });

  assert.equal(result.identity.userId, 'user-oauth-repair-owner-fallback-1');
  assert.deepEqual(calls.assistantLookups, [
    {
      AND: [
        {
          tenantId: 'default-tenant',
          kbId: 'kb-oauth-repair-owner-fallback-1'
        },
        {
          name: 'Default Assistant'
        }
      ]
    },
    {
      tenantId: 'default-tenant',
      kbId: 'kb-oauth-repair-owner-fallback-1'
    },
    {
      AND: [
        {
          tenantId: 'default-tenant',
          knowledgeBase: {
            ownerId: 'user-oauth-repair-owner-fallback-1'
          }
        },
        {
          name: 'Default Assistant'
        }
      ]
    }
  ]);
  assert.deepEqual(calls.assistantUpdate, {
    where: {
      id: 'assistant-oauth-repair-owner-fallback-1'
    },
    data: {
      kbId: 'kb-oauth-repair-owner-fallback-1',
      retrievalProfileId: 'rp-oauth-repair-owner-fallback-1',
      status: 'active'
    }
  });
});

test('AuthService completeOauthProviderCallback deterministically repairs the canonical default assistant first when fallback assistant lookup uses findFirst', async () => {
  const calls = {
    assistantFindFirstArgs: [],
    assistantUpdate: null
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async () => null,
        create: async () => ({ id: 'link-oauth-repair-findfirst-1' })
      },
      user: {
        findUnique: async () => null,
        create: async () => ({
          id: 'user-oauth-repair-findfirst-1',
          tenantId: 'default-tenant',
          role: 'owner',
          status: 'active'
        })
      },
      tenant: {
        findUnique: async () => ({ id: 'default-tenant' })
      },
      knowledgeBase: {
        findFirst: async () => ({ id: 'kb-oauth-repair-findfirst-1' }),
        create: async () => {
          throw new Error(
            'knowledge base should not be created when one already exists'
          );
        }
      },
      retrievalProfile: {
        findFirst: async () => ({ id: 'rp-oauth-repair-findfirst-1' }),
        create: async () => {
          throw new Error(
            'retrieval profile should not be created when one already exists'
          );
        }
      },
      assistant: {
        findFirst: async (args) => {
          calls.assistantFindFirstArgs.push(args);
          if (args.where?.AND?.[1]?.name === 'Default Assistant') {
            return {
              id: 'assistant-default-findfirst-1',
              kbId: 'kb-stale-findfirst-1',
              retrievalProfileId: 'rp-stale-findfirst-1',
              status: 'inactive'
            };
          }

          return {
            id: 'assistant-secondary-findfirst-1',
            kbId: 'kb-stale-findfirst-1',
            retrievalProfileId: 'rp-secondary-findfirst-1',
            status: 'active'
          };
        },
        create: async () => {
          throw new Error(
            'assistant should not be created when canonical repair is possible'
          );
        },
        update: async ({ where, data }) => {
          calls.assistantUpdate = { where, data };
          return { id: 'assistant-default-findfirst-1' };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async () => ({
        subject: 'github-subject-repair-findfirst-1',
        email: 'oauth-repair-findfirst@example.com',
        profileSnapshot: {
          id: 3099,
          login: 'oauth-repair-findfirst-user',
          name: 'OAuth Repair FindFirst User'
        }
      })
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'github',
    code: 'github-code-repair-findfirst-1',
    state: 'state-oauth-repair-findfirst-1',
    expectedState: 'state-oauth-repair-findfirst-1'
  });

  assert.equal(result.identity.userId, 'user-oauth-repair-findfirst-1');
  assert.ok(calls.assistantFindFirstArgs.length >= 1);
  assert.deepEqual(calls.assistantUpdate, {
    where: {
      id: 'assistant-default-findfirst-1'
    },
    data: {
      kbId: 'kb-oauth-repair-findfirst-1',
      retrievalProfileId: 'rp-oauth-repair-findfirst-1',
      status: 'active'
    }
  });
});

test('AuthService completeOauthProviderCallback repairs the canonical default assistant first when duplicates exist on the primary knowledge base', async () => {
  const calls = {
    assistantFindManyWhere: null,
    assistantUpdate: null
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async () => null,
        create: async () => ({ id: 'link-oauth-repair-canonical-1' })
      },
      user: {
        findUnique: async () => null,
        create: async () => ({
          id: 'user-oauth-repair-canonical-1',
          tenantId: 'default-tenant',
          role: 'owner',
          status: 'active'
        })
      },
      tenant: {
        findUnique: async () => ({ id: 'default-tenant' })
      },
      knowledgeBase: {
        findFirst: async () => ({ id: 'kb-oauth-repair-canonical-1' }),
        create: async () => {
          throw new Error('knowledge base should not be created');
        }
      },
      retrievalProfile: {
        findFirst: async () => ({ id: 'rp-oauth-repair-canonical-1' }),
        create: async () => {
          throw new Error('retrieval profile should not be created');
        }
      },
      assistant: {
        findMany: async ({ where }) => {
          calls.assistantFindManyWhere = where;
          return [
            {
              id: 'assistant-secondary-1',
              kbId: 'kb-oauth-repair-canonical-1',
              retrievalProfileId: 'rp-secondary-1',
              status: 'active',
              name: 'Research Assistant'
            },
            {
              id: 'assistant-default-1',
              kbId: 'kb-oauth-repair-canonical-1',
              retrievalProfileId: 'rp-stale-default-1',
              status: 'inactive',
              name: 'Default Assistant'
            }
          ];
        },
        create: async () => {
          throw new Error(
            'assistant should not be created when repair is possible'
          );
        },
        update: async ({ where, data }) => {
          calls.assistantUpdate = { where, data };
          return { id: 'assistant-default-1' };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async () => ({
        subject: 'github-subject-repair-canonical-1',
        email: 'oauth-repair-canonical@example.com',
        profileSnapshot: {
          id: 3999,
          login: 'oauth-repair-canonical-user',
          name: 'OAuth Repair Canonical User'
        }
      })
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'github',
    code: 'github-code-repair-canonical-1',
    state: 'state-oauth-repair-canonical-1',
    expectedState: 'state-oauth-repair-canonical-1'
  });

  assert.equal(result.identity.userId, 'user-oauth-repair-canonical-1');
  assert.deepEqual(calls.assistantFindManyWhere, {
    tenantId: 'default-tenant',
    kbId: 'kb-oauth-repair-canonical-1'
  });
  assert.deepEqual(calls.assistantUpdate, {
    where: {
      id: 'assistant-default-1'
    },
    data: {
      kbId: 'kb-oauth-repair-canonical-1',
      retrievalProfileId: 'rp-oauth-repair-canonical-1',
      status: 'active'
    }
  });
});

test('AuthService completeOauthProviderCallback repairs the canonical default assistant first when stale naming includes casing/whitespace drift', async () => {
  const calls = {
    assistantUpdate: null
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async () => null,
        create: async () => ({ id: 'link-oauth-repair-canonical-name-drift-1' })
      },
      user: {
        findUnique: async () => null,
        create: async () => ({
          id: 'user-oauth-repair-canonical-name-drift-1',
          tenantId: 'default-tenant',
          role: 'owner',
          status: 'active'
        })
      },
      tenant: {
        findUnique: async () => ({ id: 'default-tenant' })
      },
      knowledgeBase: {
        findFirst: async () => ({
          id: 'kb-oauth-repair-canonical-name-drift-1'
        }),
        create: async () => {
          throw new Error('knowledge base should not be created');
        }
      },
      retrievalProfile: {
        findFirst: async () => ({
          id: 'rp-oauth-repair-canonical-name-drift-1'
        }),
        create: async () => {
          throw new Error('retrieval profile should not be created');
        }
      },
      assistant: {
        findMany: async () => [
          {
            id: 'assistant-secondary-1',
            kbId: 'kb-oauth-repair-canonical-name-drift-1',
            retrievalProfileId: 'rp-secondary-1',
            status: 'active',
            name: 'Research Assistant'
          },
          {
            id: 'assistant-default-name-drift-1',
            kbId: 'kb-oauth-repair-canonical-name-drift-1',
            retrievalProfileId: 'rp-stale-default-1',
            status: 'inactive',
            name: ' default assistant '
          }
        ],
        create: async () => {
          throw new Error(
            'assistant should not be created when canonical repair is possible'
          );
        },
        update: async ({ where, data }) => {
          calls.assistantUpdate = { where, data };
          return { id: 'assistant-default-name-drift-1' };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async () => ({
        subject: 'github-subject-repair-canonical-name-drift-1',
        email: 'oauth-repair-canonical-name-drift@example.com',
        profileSnapshot: {
          id: 4999,
          login: 'oauth-repair-canonical-name-drift-user',
          name: 'OAuth Repair Canonical Name Drift User'
        }
      })
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'github',
    code: 'github-code-repair-canonical-name-drift-1',
    state: 'state-oauth-repair-canonical-name-drift-1',
    expectedState: 'state-oauth-repair-canonical-name-drift-1'
  });

  assert.equal(
    result.identity.userId,
    'user-oauth-repair-canonical-name-drift-1'
  );
  assert.deepEqual(calls.assistantUpdate, {
    where: {
      id: 'assistant-default-name-drift-1'
    },
    data: {
      kbId: 'kb-oauth-repair-canonical-name-drift-1',
      retrievalProfileId: 'rp-oauth-repair-canonical-name-drift-1',
      status: 'active'
    }
  });
});

test('AuthService completeOauthProviderCallback repairs the canonical default assistant first when stale naming has internal whitespace drift', async () => {
  const calls = {
    assistantUpdate: null
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async () => null,
        create: async () => ({
          id: 'link-oauth-repair-canonical-internal-whitespace-1'
        })
      },
      user: {
        findUnique: async () => null,
        create: async () => ({
          id: 'user-oauth-repair-canonical-internal-whitespace-1',
          tenantId: 'default-tenant',
          role: 'owner',
          status: 'active'
        })
      },
      tenant: {
        findUnique: async () => ({ id: 'default-tenant' })
      },
      knowledgeBase: {
        findFirst: async () => ({
          id: 'kb-oauth-repair-canonical-internal-whitespace-1'
        }),
        create: async () => {
          throw new Error('knowledge base should not be created');
        }
      },
      retrievalProfile: {
        findFirst: async () => ({
          id: 'rp-oauth-repair-canonical-internal-whitespace-1'
        }),
        create: async () => {
          throw new Error('retrieval profile should not be created');
        }
      },
      assistant: {
        findMany: async () => [
          {
            id: 'assistant-secondary-1',
            kbId: 'kb-oauth-repair-canonical-internal-whitespace-1',
            retrievalProfileId: 'rp-secondary-1',
            status: 'active',
            name: 'Research Assistant'
          },
          {
            id: 'assistant-default-internal-whitespace-1',
            kbId: 'kb-oauth-repair-canonical-internal-whitespace-1',
            retrievalProfileId: 'rp-stale-default-1',
            status: 'inactive',
            name: 'Default   Assistant'
          }
        ],
        create: async () => {
          throw new Error(
            'assistant should not be created when canonical repair is possible'
          );
        },
        update: async ({ where, data }) => {
          calls.assistantUpdate = { where, data };
          return { id: 'assistant-default-internal-whitespace-1' };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async () => ({
        subject: 'github-subject-repair-canonical-internal-whitespace-1',
        email: 'oauth-repair-canonical-internal-whitespace@example.com',
        profileSnapshot: {
          id: 5099,
          login: 'oauth-repair-canonical-internal-whitespace-user',
          name: 'OAuth Repair Canonical Internal Whitespace User'
        }
      })
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'github',
    code: 'github-code-repair-canonical-internal-whitespace-1',
    state: 'state-oauth-repair-canonical-internal-whitespace-1',
    expectedState: 'state-oauth-repair-canonical-internal-whitespace-1'
  });

  assert.equal(
    result.identity.userId,
    'user-oauth-repair-canonical-internal-whitespace-1'
  );
  assert.deepEqual(calls.assistantUpdate, {
    where: {
      id: 'assistant-default-internal-whitespace-1'
    },
    data: {
      kbId: 'kb-oauth-repair-canonical-internal-whitespace-1',
      retrievalProfileId: 'rp-oauth-repair-canonical-internal-whitespace-1',
      status: 'active'
    }
  });
});

test('AuthService completeOauthProviderCallback binds the canonical default assistant to the canonical primary knowledge base and retrieval profile when owner-scoped duplicates exist', async () => {
  const calls = {
    assistantFindManyWhere: null,
    assistantUpdate: null,
    knowledgeBaseFindManyWhere: null,
    retrievalProfileFindManyWhere: null
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async () => null,
        create: async () => ({ id: 'link-oauth-repair-primary-binding-1' })
      },
      user: {
        findUnique: async () => null,
        create: async () => ({
          id: 'user-oauth-repair-primary-binding-1',
          tenantId: 'default-tenant',
          role: 'owner',
          status: 'active'
        })
      },
      tenant: {
        findUnique: async () => ({ id: 'default-tenant' })
      },
      knowledgeBase: {
        findMany: async ({ where }) => {
          calls.knowledgeBaseFindManyWhere = where;
          return [
            {
              id: 'kb-z-secondary',
              name: 'Secondary Knowledge Base',
              status: 'active'
            },
            {
              id: 'kb-a-default',
              name: ' default knowledge base ',
              status: 'inactive'
            }
          ];
        },
        findFirst: async () => {
          throw new Error('knowledge base should use canonical findMany path');
        },
        create: async () => {
          throw new Error('knowledge base should not be created');
        }
      },
      retrievalProfile: {
        findMany: async ({ where }) => {
          calls.retrievalProfileFindManyWhere = where;
          return [
            {
              id: 'rp-z-secondary',
              name: 'Secondary Retrieval Profile'
            },
            {
              id: 'rp-a-default',
              name: ' default retrieval profile '
            }
          ];
        },
        findFirst: async () => {
          throw new Error(
            'retrieval profile should use canonical findMany path'
          );
        },
        create: async () => {
          throw new Error('retrieval profile should not be created');
        }
      },
      assistant: {
        findMany: async ({ where }) => {
          calls.assistantFindManyWhere = where;
          return [
            {
              id: 'assistant-secondary-1',
              kbId: 'kb-a-default',
              retrievalProfileId: 'rp-z-secondary',
              status: 'active',
              name: 'Research Assistant'
            },
            {
              id: 'assistant-default-1',
              kbId: 'kb-z-secondary',
              retrievalProfileId: 'rp-z-secondary',
              status: 'inactive',
              name: 'Default Assistant'
            }
          ];
        },
        create: async () => {
          throw new Error(
            'assistant should not be created when canonical repair is possible'
          );
        },
        update: async ({ where, data }) => {
          calls.assistantUpdate = { where, data };
          return { id: 'assistant-default-1' };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async () => ({
        subject: 'github-subject-repair-primary-binding-1',
        email: 'oauth-repair-primary-binding@example.com',
        profileSnapshot: {
          id: 5999,
          login: 'oauth-repair-primary-binding-user',
          name: 'OAuth Repair Primary Binding User'
        }
      })
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'github',
    code: 'github-code-repair-primary-binding-1',
    state: 'state-oauth-repair-primary-binding-1',
    expectedState: 'state-oauth-repair-primary-binding-1'
  });

  assert.equal(result.identity.userId, 'user-oauth-repair-primary-binding-1');
  assert.deepEqual(calls.knowledgeBaseFindManyWhere, {
    tenantId: 'default-tenant',
    ownerId: 'user-oauth-repair-primary-binding-1'
  });
  assert.deepEqual(calls.retrievalProfileFindManyWhere, {
    tenantId: 'default-tenant',
    ownerId: 'user-oauth-repair-primary-binding-1'
  });
  assert.deepEqual(calls.assistantFindManyWhere, {
    tenantId: 'default-tenant',
    kbId: 'kb-a-default'
  });
  assert.deepEqual(calls.assistantUpdate, {
    where: {
      id: 'assistant-default-1'
    },
    data: {
      kbId: 'kb-a-default',
      retrievalProfileId: 'rp-a-default',
      status: 'active'
    }
  });
});

test('AuthService completeOauthProviderCallback keeps the already bound canonical default assistant for the primary knowledge base when duplicate defaults exist', async () => {
  const calls = {
    assistantUpdate: null
  };

  const authService = new AuthService(
    createTransactionalPrismaMock({
      authIdentityLink: {
        findUnique: async () => null,
        create: async () => ({ id: 'link-oauth-repair-existing-binding-1' })
      },
      user: {
        findUnique: async () => null,
        create: async () => ({
          id: 'user-oauth-repair-existing-binding-1',
          tenantId: 'default-tenant',
          role: 'owner',
          status: 'active'
        })
      },
      tenant: {
        findUnique: async () => ({ id: 'default-tenant' })
      },
      knowledgeBase: {
        findMany: async () => [
          {
            id: 'kb-oauth-repair-existing-binding-1',
            name: 'Default Knowledge Base',
            status: 'active'
          }
        ],
        findFirst: async () => {
          throw new Error('knowledge base should use canonical findMany path');
        },
        create: async () => {
          throw new Error('knowledge base should not be created');
        }
      },
      retrievalProfile: {
        findMany: async () => [
          {
            id: 'rp-oauth-repair-existing-binding-1',
            name: 'Default Retrieval Profile'
          }
        ],
        findFirst: async () => {
          throw new Error(
            'retrieval profile should use canonical findMany path'
          );
        },
        create: async () => {
          throw new Error('retrieval profile should not be created');
        }
      },
      assistant: {
        findMany: async () => [
          {
            id: 'assistant-default-a',
            kbId: 'kb-oauth-repair-existing-binding-1',
            retrievalProfileId: 'rp-stale-1',
            status: 'active',
            name: 'Default Assistant'
          },
          {
            id: 'assistant-default-z',
            kbId: 'kb-oauth-repair-existing-binding-1',
            retrievalProfileId: 'rp-oauth-repair-existing-binding-1',
            status: 'active',
            name: 'Default Assistant'
          }
        ],
        create: async () => {
          throw new Error(
            'assistant should not be created when canonical default already exists'
          );
        },
        update: async ({ where, data }) => {
          calls.assistantUpdate = { where, data };
          return { id: 'assistant-default-a' };
        }
      }
    }),
    {
      exchangeCodeForIdentity: async () => ({
        subject: 'github-subject-repair-existing-binding-1',
        email: 'oauth-repair-existing-binding@example.com',
        profileSnapshot: {
          id: 6999,
          login: 'oauth-repair-existing-binding-user',
          name: 'OAuth Repair Existing Binding User'
        }
      })
    }
  );

  const result = await authService.completeOauthProviderCallback({
    provider: 'github',
    code: 'github-code-repair-existing-binding-1',
    state: 'state-oauth-repair-existing-binding-1',
    expectedState: 'state-oauth-repair-existing-binding-1'
  });

  assert.equal(result.identity.userId, 'user-oauth-repair-existing-binding-1');
  assert.equal(calls.assistantUpdate, null);
});

test('AuthController oauthProviderCallback validates state cookie and writes oauth JWT cookies', async () => {
  const cookies = [];
  const callbackCalls = [];
  const redirects = [];
  const controller = new AuthController({
    completeOauthProviderCallback: async (input) => {
      callbackCalls.push(input);
      return {
        identity: {
          userId: 'user-1',
          tenantId: 'tenant-1',
          role: 'owner',
          sessionId: null,
          authSource: 'github'
        },
        expiresAt: '2030-01-01T00:00:00.000Z',
        accessToken: 'access-token-1',
        accessTokenExpiresAt: '2030-01-01T00:15:00.000Z',
        refreshToken: 'refresh-token-1'
      };
    }
  });

  await controller.oauthProviderCallback(
    {
      provider: 'github'
    },
    {
      code: 'callback-code-1',
      state: 'state-cookie-1'
    },
    {
      headers: {
        cookie: 'other=1; rag_oauth_state=state-cookie-1'
      }
    },
    {
      setHeader: (name, value) => {
        if (name === 'Set-Cookie') {
          cookies.push(value);
        }
      },
      redirect: (statusCode, url) => {
        redirects.push({ statusCode, url });
      }
    }
  );

  assert.deepEqual(callbackCalls, [
    {
      provider: 'github',
      code: 'callback-code-1',
      state: 'state-cookie-1',
      expectedState: 'state-cookie-1'
    }
  ]);
  assert.equal(cookies.length, 1);
  assert.ok(Array.isArray(cookies[0]));
  assert.match(cookies[0][0], /^rag_oauth_state=;/);
  assert.match(cookies[0][1], /^rag_access_token=access-token-1/);
  assert.match(cookies[0][2], /^rag_refresh_token=refresh-token-1/);
  assert.match(cookies[0][3], /^rag_login_provenance=github/);
  assert.deepEqual(redirects, [
    { statusCode: 302, url: 'http://localhost:5173' }
  ]);
});

test('AuthController githubOauthCallback accepts local callback alias with shared cookie/JWT handling', async () => {
  const cookies = [];
  const callbackCalls = [];
  const redirects = [];
  const controller = new AuthController({
    completeOauthProviderCallback: async (input) => {
      callbackCalls.push(input);
      return {
        identity: {
          userId: 'user-gh-alias-1',
          tenantId: 'tenant-gh-alias-1',
          role: 'owner',
          sessionId: null,
          authSource: 'github'
        },
        expiresAt: '2030-01-03T00:00:00.000Z',
        accessToken: 'access-token-gh-alias-1',
        accessTokenExpiresAt: '2030-01-03T00:15:00.000Z',
        refreshToken: 'refresh-token-gh-alias-1'
      };
    }
  });

  await controller.githubOauthCallback(
    {
      code: 'callback-gh-alias-code-1',
      state: 'state-gh-alias-cookie-1'
    },
    {
      headers: {
        cookie: 'other=1; rag_oauth_state=state-gh-alias-cookie-1'
      }
    },
    {
      setHeader: (name, value) => {
        if (name === 'Set-Cookie') {
          cookies.push(value);
        }
      },
      redirect: (statusCode, url) => {
        redirects.push({ statusCode, url });
      }
    }
  );

  assert.deepEqual(callbackCalls, [
    {
      provider: 'github',
      code: 'callback-gh-alias-code-1',
      state: 'state-gh-alias-cookie-1',
      expectedState: 'state-gh-alias-cookie-1'
    }
  ]);
  assert.equal(cookies.length, 1);
  assert.ok(Array.isArray(cookies[0]));
  assert.match(cookies[0][0], /^rag_oauth_state=;/);
  assert.match(cookies[0][1], /^rag_access_token=access-token-gh-alias-1/);
  assert.match(cookies[0][2], /^rag_refresh_token=refresh-token-gh-alias-1/);
  assert.match(cookies[0][3], /^rag_login_provenance=github/);
  assert.deepEqual(redirects, [
    { statusCode: 302, url: 'http://localhost:5173' }
  ]);
});

test('AuthController oauthProviderCallback supports Google callback with shared cookie/JWT handling', async () => {
  const cookies = [];
  const callbackCalls = [];
  const redirects = [];
  const controller = new AuthController({
    completeOauthProviderCallback: async (input) => {
      callbackCalls.push(input);
      return {
        identity: {
          userId: 'user-google-1',
          tenantId: 'tenant-google-1',
          role: 'member',
          sessionId: null,
          authSource: 'google'
        },
        expiresAt: '2030-01-02T00:00:00.000Z',
        accessToken: 'access-token-google-1',
        accessTokenExpiresAt: '2030-01-02T00:15:00.000Z',
        refreshToken: 'refresh-token-google-1'
      };
    }
  });

  await controller.oauthProviderCallback(
    {
      provider: 'google'
    },
    {
      code: 'callback-google-code-1',
      state: 'state-google-cookie-1'
    },
    {
      headers: {
        cookie: 'other=1; rag_oauth_state=state-google-cookie-1'
      }
    },
    {
      setHeader: (name, value) => {
        if (name === 'Set-Cookie') {
          cookies.push(value);
        }
      },
      redirect: (statusCode, url) => {
        redirects.push({ statusCode, url });
      }
    }
  );

  assert.deepEqual(callbackCalls, [
    {
      provider: 'google',
      code: 'callback-google-code-1',
      state: 'state-google-cookie-1',
      expectedState: 'state-google-cookie-1'
    }
  ]);
  assert.equal(cookies.length, 1);
  assert.ok(Array.isArray(cookies[0]));
  assert.match(cookies[0][0], /^rag_oauth_state=;/);
  assert.match(cookies[0][1], /^rag_access_token=access-token-google-1/);
  assert.match(cookies[0][2], /^rag_refresh_token=refresh-token-google-1/);
  assert.match(cookies[0][3], /^rag_login_provenance=google/);
  assert.deepEqual(redirects, [
    { statusCode: 302, url: 'http://localhost:5173' }
  ]);
});

test('AuthController oauthProviderCallback supports OIDC callback with shared cookie/JWT handling', async () => {
  const cookies = [];
  const callbackCalls = [];
  const redirects = [];
  const controller = new AuthController({
    completeOauthProviderCallback: async (input) => {
      callbackCalls.push(input);
      return {
        identity: {
          userId: 'user-oidc-1',
          tenantId: 'tenant-oidc-1',
          role: 'member',
          sessionId: null,
          authSource: 'oidc'
        },
        expiresAt: '2030-01-03T00:00:00.000Z',
        accessToken: 'access-token-oidc-1',
        accessTokenExpiresAt: '2030-01-03T00:15:00.000Z',
        refreshToken: 'refresh-token-oidc-1'
      };
    }
  });

  await controller.oauthProviderCallback(
    {
      provider: 'oidc'
    },
    {
      code: 'callback-oidc-code-1',
      state: 'state-oidc-cookie-1'
    },
    {
      headers: {
        cookie: 'other=1; rag_oauth_state=state-oidc-cookie-1'
      }
    },
    {
      setHeader: (name, value) => {
        if (name === 'Set-Cookie') {
          cookies.push(value);
        }
      },
      redirect: (statusCode, url) => {
        redirects.push({ statusCode, url });
      }
    }
  );

  assert.deepEqual(callbackCalls, [
    {
      provider: 'oidc',
      code: 'callback-oidc-code-1',
      state: 'state-oidc-cookie-1',
      expectedState: 'state-oidc-cookie-1'
    }
  ]);
  assert.equal(cookies.length, 1);
  assert.ok(Array.isArray(cookies[0]));
  assert.match(cookies[0][0], /^rag_oauth_state=;/);
  assert.match(cookies[0][1], /^rag_access_token=access-token-oidc-1/);
  assert.match(cookies[0][2], /^rag_refresh_token=refresh-token-oidc-1/);
  assert.match(cookies[0][3], /^rag_login_provenance=oidc/);
  assert.deepEqual(redirects, [
    { statusCode: 302, url: 'http://localhost:5173' }
  ]);
});

test('AuthService completeOauthProviderCallback rejects mismatched state', async () => {
  const authService = new AuthService(
    {},
    {
      exchangeCodeForIdentity: async () => {
        throw new Error('should not exchange when state is invalid');
      }
    }
  );

  await assert.rejects(
    () =>
      authService.completeOauthProviderCallback({
        provider: 'github',
        code: 'callback-code-2',
        state: 'state-a',
        expectedState: 'state-b'
      }),
    /Invalid OAuth state/
  );
});

test('AuthService login returns JWT identity and logout is stateless', async () => {
  const loginEmail = 'default-user@example.com';
  const loginPassword = 'local-password-1';
  const loginPasswordHash = hashSync(loginPassword, 4);
  const calls = {
    userLookup: null
  };
  const authService = new AuthService({
    user: {
      findUnique: async ({ where }) => {
        calls.userLookup = where;
        return {
          id: 'default-user',
          tenantId: 'tenant-1',
          name: 'Default User',
          displayName: 'Default User',
          email: loginEmail,
          role: 'member',
          status: 'active',
          passwordHash: loginPasswordHash
        };
      }
    }
  });

  const login = await authService.login({
    email: loginEmail,
    password: loginPassword
  });
  assert.equal(login.identity.sessionId, null);
  assert.equal(login.identity.userId, 'default-user');
  assert.equal(login.identity.tenantId, 'tenant-1');
  assert.equal(login.identity.authSource, 'local');
  assert.equal(login.identity.role, 'member');
  assert.deepEqual(login.user, {
    id: 'default-user',
    tenantId: 'tenant-1',
    role: 'member',
    name: 'Default User',
    displayName: 'Default User',
    email: loginEmail
  });
  assert.ok(typeof login.expiresAt === 'string');
  assert.deepEqual(calls.userLookup, { email: loginEmail });
  assert.ok(typeof login.accessToken === 'string');
  assert.ok(typeof login.refreshToken === 'string');

  const logout = await authService.logout();
  assert.deepEqual(logout, { ok: true });
});

test('AuthService login rejects invalid email/password edges', async () => {
  const loginPasswordHash = hashSync('local-password-1', 4);
  const authService = new AuthService({
    user: {
      findUnique: async ({ where }) => {
        if (where.email === 'inactive-user@example.com') {
          return {
            id: 'user-inactive',
            tenantId: 'tenant-1',
            name: 'Inactive User',
            displayName: null,
            email: 'inactive-user@example.com',
            role: 'member',
            status: 'inactive',
            passwordHash: loginPasswordHash
          };
        }

        if (where.email === 'active-user@example.com') {
          return {
            id: 'user-active',
            tenantId: 'tenant-1',
            name: 'Active User',
            displayName: null,
            email: 'active-user@example.com',
            role: 'member',
            status: 'active',
            passwordHash: loginPasswordHash
          };
        }

        return null;
      }
    }
  });

  await assert.rejects(
    () =>
      authService.login({
        email: 'active-user@example.com',
        password: 'wrong-password'
      }),
    /Invalid email or password/,
    'wrong password should fail'
  );

  await assert.rejects(
    () =>
      authService.login({
        email: 'missing-user@example.com',
        password: 'local-password-1'
      }),
    /Invalid email or password/,
    'missing user should fail'
  );

  await assert.rejects(
    () =>
      authService.login({
        email: 'inactive-user@example.com',
        password: 'local-password-1'
      }),
    /Invalid email or password/,
    'inactive user should fail'
  );
});

test('AuthService checkPermission evaluates owner-only resource access for current identity', () => {
  const authService = new AuthService({});

  const allowed = authService.checkPermission({
    authContext: {
      identity: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        sessionId: 'session-1',
        authSource: 'session'
      },
      currentIdentity: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        sessionId: 'session-1',
        authSource: 'session'
      }
    },
    action: 'read',
    resource: {
      kind: 'document',
      resourceId: 'doc-1',
      tenantId: 'tenant-1',
      ownerId: 'user-1'
    }
  });

  assert.equal(allowed.decision.allowed, true);
  assert.equal(allowed.decision.reason, 'owner_match');
  assert.equal(allowed.decision.policy, 'owner_only_v1');

  const denied = authService.checkPermission({
    authContext: {
      identity: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        sessionId: 'session-1',
        authSource: 'session'
      },
      currentIdentity: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        sessionId: 'session-1',
        authSource: 'session'
      }
    },
    action: 'write',
    resource: {
      kind: 'assistant',
      resourceId: 'assistant-1',
      tenantId: 'tenant-1',
      ownerId: 'other-user'
    }
  });

  assert.equal(denied.decision.allowed, false);
  assert.equal(denied.decision.reason, 'owner_mismatch');
  assert.equal(denied.decision.policy, 'owner_only_v1');
});

test('AuthController sets and clears JWT cookies around login and logout', async () => {
  const cookies = [];
  const loginCalls = [];
  const controller = new AuthController({
    login: async (input) => {
      loginCalls.push(input);
      return {
        identity: {
          userId: 'default-user',
          tenantId: 'default-tenant',
          role: 'owner',
          sessionId: null,
          authSource: 'local'
        },
        user: {
          id: 'default-user',
          tenantId: 'default-tenant',
          role: 'owner',
          name: 'Default User',
          displayName: null,
          email: 'default-user@example.com'
        },
        expiresAt: '2030-01-01T00:00:00.000Z',
        accessToken: 'access-token-login-1',
        accessTokenExpiresAt: '2030-01-01T00:15:00.000Z',
        refreshToken: 'refresh-token-login-1'
      };
    },
    logout: async () => ({ ok: true }),
    getMe: () => ({ identity: null, currentIdentity: null })
  });

  const loginResult = await controller.login(
    {
      email: 'default-user@example.com',
      password: 'local-password-1'
    },
    {
      setHeader: (name, value) => {
        if (name === 'Set-Cookie') {
          cookies.push(value);
        }
      }
    }
  );

  assert.equal(loginResult.identity.sessionId, null);
  assert.equal(loginResult.user.email, 'default-user@example.com');
  assert.deepEqual(loginCalls, [
    { email: 'default-user@example.com', password: 'local-password-1' }
  ]);
  assert.ok(Array.isArray(cookies[0]));
  assert.match(cookies[0][0], /rag_access_token=access-token-login-1/);
  assert.match(cookies[0][1], /rag_refresh_token=refresh-token-login-1/);
  assert.match(cookies[0][2], /rag_login_provenance=local/);

  const logoutResult = await controller.logout(
    {
      authContext: {
        identity: null
      }
    },
    {
      setHeader: (name, value) => {
        if (name === 'Set-Cookie') {
          cookies.push(value);
        }
      }
    }
  );

  assert.deepEqual(logoutResult, { ok: true });
  assert.ok(Array.isArray(cookies[1]));
  assert.match(cookies[1][0], /rag_access_token=;/);
  assert.match(cookies[1][1], /rag_refresh_token=;/);
  assert.match(cookies[1][2], /rag_login_provenance=;/);
});

test('AuthController refresh reissues JWT cookies from refresh token cookie', async () => {
  const cookies = [];
  const refreshCalls = [];
  const controller = new AuthController({
    refreshAccessToken: async (input) => {
      refreshCalls.push(input);
      return {
        identity: {
          userId: 'user-refresh-1',
          tenantId: 'tenant-refresh-1',
          role: 'owner',
          sessionId: null,
          authSource: 'local'
        },
        user: {
          id: 'user-refresh-1',
          tenantId: 'tenant-refresh-1',
          role: 'owner',
          name: 'Refresh User',
          displayName: null,
          email: 'refresh-user@example.com'
        },
        accessToken: 'access-token-refresh-1',
        accessTokenExpiresAt: '2030-01-01T00:15:00.000Z',
        refreshToken: 'refresh-token-refresh-1',
        expiresAt: '2030-01-02T00:00:00.000Z'
      };
    }
  });

  const result = await controller.refresh(
    {
      headers: {
        cookie: 'other=1; rag_refresh_token=refresh-token-cookie-1'
      }
    },
    {
      setHeader: (name, value) => {
        if (name === 'Set-Cookie') {
          cookies.push(value);
        }
      }
    }
  );

  assert.deepEqual(refreshCalls, [{ refreshToken: 'refresh-token-cookie-1' }]);
  assert.deepEqual(result, {
    ok: true,
    identity: {
      userId: 'user-refresh-1',
      tenantId: 'tenant-refresh-1',
      role: 'owner',
      sessionId: null,
      authSource: 'local'
    },
    user: {
      id: 'user-refresh-1',
      tenantId: 'tenant-refresh-1',
      role: 'owner',
      name: 'Refresh User',
      displayName: null,
      email: 'refresh-user@example.com'
    },
    expiresAt: '2030-01-01T00:15:00.000Z'
  });
  assert.equal(cookies.length, 1);
  assert.ok(Array.isArray(cookies[0]));
  assert.match(cookies[0][0], /rag_access_token=access-token-refresh-1/);
  assert.match(cookies[0][1], /rag_refresh_token=refresh-token-refresh-1/);
});

test('AuthController me returns local-session provenance by default and oauth-session provenance from cookie hint', () => {
  const meCalls = [];
  const controller = new AuthController({
    getMe: (input) => {
      meCalls.push(input);
      return {
        identity: input.authContext?.identity ?? null,
        currentIdentity: input.authContext?.currentIdentity ?? null,
        loginProvenance: {
          type:
            input.loginProvenanceHint === 'github'
              ? 'oauth_session'
              : 'local_session',
          oauthProvider:
            input.loginProvenanceHint === 'github' ? 'github' : null
        }
      };
    }
  });

  const baseAuthContext = {
    identity: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'owner',
      sessionId: 'session-1',
      authSource: 'session'
    },
    currentIdentity: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'owner',
      sessionId: 'session-1',
      authSource: 'session'
    }
  };

  const localMe = controller.me({
    authContext: baseAuthContext,
    headers: {
      cookie: 'other=1'
    }
  });
  assert.equal(localMe.loginProvenance.type, 'local_session');
  assert.equal(localMe.loginProvenance.oauthProvider, null);

  const oauthMe = controller.me({
    authContext: baseAuthContext,
    headers: {
      cookie: 'other=1; rag_login_provenance=github'
    }
  });
  assert.equal(oauthMe.loginProvenance.type, 'oauth_session');
  assert.equal(oauthMe.loginProvenance.oauthProvider, 'github');

  assert.equal(meCalls.length, 2);
  assert.equal(meCalls[0].loginProvenanceHint, null);
  assert.equal(meCalls[1].loginProvenanceHint, 'github');
});

test('AuthController providers returns local dev credentials and OAuth readiness', () => {
  const controller = new AuthController({
    getAuthProviders: () => ({
      local: {
        enabled: true,
        defaultCredentials: {
          email: 'default-user@example.com',
          password: 'local-password-1'
        }
      },
      oauth: {
        github: {
          configured: false,
          requiredEnv: [
            'AUTH_GITHUB_CLIENT_ID',
            'AUTH_GITHUB_CLIENT_SECRET',
            'AUTH_GITHUB_REDIRECT_URI'
          ]
        },
        google: {
          configured: true,
          requiredEnv: [
            'AUTH_GOOGLE_CLIENT_ID',
            'AUTH_GOOGLE_CLIENT_SECRET',
            'AUTH_GOOGLE_REDIRECT_URI'
          ]
        },
        oidc: {
          configured: false,
          requiredEnv: [
            'AUTH_OIDC_ISSUER',
            'AUTH_OIDC_CLIENT_ID',
            'AUTH_OIDC_CLIENT_SECRET',
            'AUTH_OIDC_REDIRECT_URI'
          ]
        }
      }
    })
  });

  const result = controller.providers();

  assert.deepEqual(result, {
    local: {
      enabled: true,
      defaultCredentials: {
        email: 'default-user@example.com',
        password: 'local-password-1'
      }
    },
    oauth: {
      github: {
        configured: false,
        requiredEnv: [
          'AUTH_GITHUB_CLIENT_ID',
          'AUTH_GITHUB_CLIENT_SECRET',
          'AUTH_GITHUB_REDIRECT_URI'
        ]
      },
      google: {
        configured: true,
        requiredEnv: [
          'AUTH_GOOGLE_CLIENT_ID',
          'AUTH_GOOGLE_CLIENT_SECRET',
          'AUTH_GOOGLE_REDIRECT_URI'
        ]
      },
      oidc: {
        configured: false,
        requiredEnv: [
          'AUTH_OIDC_ISSUER',
          'AUTH_OIDC_CLIENT_ID',
          'AUTH_OIDC_CLIENT_SECRET',
          'AUTH_OIDC_REDIRECT_URI'
        ]
      }
    }
  });
});

test('AuthService getMe resolves oauth-backed and local-session provenance without changing identity payload', () => {
  const authService = new AuthService({});

  const oauthMe = authService.getMe({
    authContext: {
      identity: {
        userId: 'user-oauth',
        tenantId: 'tenant-oauth',
        role: 'member',
        sessionId: 'session-oauth',
        authSource: 'session'
      },
      currentIdentity: {
        userId: 'user-oauth',
        tenantId: 'tenant-oauth',
        role: 'member',
        sessionId: 'session-oauth',
        authSource: 'session'
      }
    },
    loginProvenanceHint: 'google'
  });

  assert.equal(oauthMe.identity.authSource, 'session');
  assert.equal(oauthMe.currentIdentity.authSource, 'session');
  assert.deepEqual(oauthMe.loginProvenance, {
    type: 'oauth_session',
    oauthProvider: 'google'
  });

  const localMe = authService.getMe({
    authContext: {
      identity: {
        userId: 'user-local',
        tenantId: 'tenant-local',
        role: 'owner',
        sessionId: 'session-local',
        authSource: 'session'
      },
      currentIdentity: {
        userId: 'user-local',
        tenantId: 'tenant-local',
        role: 'owner',
        sessionId: 'session-local',
        authSource: 'session'
      }
    }
  });

  assert.deepEqual(localMe.loginProvenance, {
    type: 'local_session',
    oauthProvider: null
  });
});

test('AuthRoutePolicyGuard allows public routes without identity', () => {
  const guard = new AuthRoutePolicyGuard({
    getAllAndOverride: () => 'public'
  });

  const allowed = guard.canActivate({
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({
      getRequest: () => ({ authContext: { identity: null } })
    })
  });

  assert.equal(allowed, true);
});

test('AuthRateLimitGuard allows requests when no auth rate-limit metadata is present', () => {
  const guard = new AuthRateLimitGuard(
    {
      getAllAndOverride: () => undefined
    },
    {
      getConfig: () => ({
        rateLimits: {
          login: { windowMs: 60_000, maxAttempts: 2 },
          oauth_start: { windowMs: 60_000, maxAttempts: 2 },
          oauth_callback: { windowMs: 60_000, maxAttempts: 2 }
        }
      })
    }
  );

  const allowed = guard.canActivate({
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      })
    })
  });

  assert.equal(allowed, true);
});

test('AuthRateLimitGuard throttles repeated login attempts from the same client', () => {
  const guard = new AuthRateLimitGuard(
    {
      getAllAndOverride: () => 'login'
    },
    {
      getConfig: () => ({
        rateLimits: {
          login: { windowMs: 60_000, maxAttempts: 2 },
          oauth_start: { windowMs: 60_000, maxAttempts: 5 },
          oauth_callback: { windowMs: 60_000, maxAttempts: 5 }
        }
      })
    }
  );

  const context = {
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          'x-forwarded-for': '203.0.113.8, 10.0.0.1'
        },
        socket: { remoteAddress: '127.0.0.1' }
      })
    })
  };

  assert.equal(guard.canActivate(context), true);
  assert.equal(guard.canActivate(context), true);
  assert.throws(
    () => guard.canActivate(context),
    /Too many authentication attempts/
  );
});

test('AuthRoutePolicyGuard rejects authenticated routes without session identity', () => {
  const guard = new AuthRoutePolicyGuard({
    getAllAndOverride: () => 'authenticated'
  });

  assert.throws(
    () =>
      guard.canActivate({
        getHandler: () => 'handler',
        getClass: () => 'controller',
        switchToHttp: () => ({
          getRequest: () => ({ authContext: { identity: null } })
        })
      }),
    /Authentication required/
  );
});

test('AuthRoutePolicyGuard allows authenticated routes with session identity', () => {
  const guard = new AuthRoutePolicyGuard({
    getAllAndOverride: () => 'authenticated'
  });

  const allowed = guard.canActivate({
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({
      getRequest: () => ({
        authContext: {
          identity: {
            userId: 'user-1',
            tenantId: 'tenant-1',
            role: 'owner',
            sessionId: 'session-1',
            authSource: 'session'
          }
        }
      })
    })
  });

  assert.equal(allowed, true);
});

test('AuthRoutePolicyGuard invokes ACL guard hook when authenticated route carries ACL hook metadata', () => {
  const observed = [];
  const guard = new AuthRoutePolicyGuard(
    {
      getAllAndOverride: (metadataKey) => {
        if (metadataKey === AUTH_ROUTE_POLICY_KEY) {
          return 'authenticated';
        }

        if (metadataKey === AUTH_ACL_ROUTE_HOOK_KEY) {
          return {
            action: 'write',
            target: 'document'
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
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        sessionId: 'session-1',
        authSource: 'session'
      }
    }
  };

  const allowed = guard.canActivate({
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({
      getRequest: () => request
    })
  });

  assert.equal(allowed, true);
  assert.equal(observed.length, 1);
  assert.equal(observed[0].request, request);
  assert.deepEqual(observed[0].aclHook, {
    action: 'write',
    target: 'document'
  });
});

test('DocumentPermissionHook and ResourcePermissionHook reserve ACL attachment metadata', () => {
  class HookedController {
    readDocument() {}
    writeResource() {}
  }

  const readDescriptor = Object.getOwnPropertyDescriptor(
    HookedController.prototype,
    'readDocument'
  );
  const writeDescriptor = Object.getOwnPropertyDescriptor(
    HookedController.prototype,
    'writeResource'
  );

  DocumentPermissionHook('read')(
    HookedController.prototype,
    'readDocument',
    readDescriptor
  );
  ResourcePermissionHook('write')(
    HookedController.prototype,
    'writeResource',
    writeDescriptor
  );

  assert.deepEqual(
    Reflect.getMetadata(
      AUTH_ACL_ROUTE_HOOK_KEY,
      HookedController.prototype.readDocument
    ),
    {
      action: 'read',
      target: 'document'
    }
  );
  assert.deepEqual(
    Reflect.getMetadata(
      AUTH_ACL_ROUTE_HOOK_KEY,
      HookedController.prototype.writeResource
    ),
    {
      action: 'write',
      target: 'resource'
    }
  );
});

test('owner-scoped business controllers are marked authenticated while auth and health remain public', () => {
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
    assert.equal(
      Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, controller),
      'authenticated'
    );
  }

  assert.equal(
    Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, AuthController),
    'public'
  );
  assert.equal(
    Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, AuthController.prototype.me),
    'authenticated'
  );
  assert.equal(
    Reflect.getMetadata(
      AUTH_ROUTE_POLICY_KEY,
      AuthController.prototype.checkPermission
    ),
    'authenticated'
  );
  assert.equal(
    Reflect.getMetadata(AUTH_RATE_LIMIT_KEY, AuthController.prototype.login),
    'login'
  );
  assert.equal(
    Reflect.getMetadata(
      AUTH_RATE_LIMIT_KEY,
      AuthController.prototype.oauthProviderStart
    ),
    'oauth_start'
  );
  assert.equal(
    Reflect.getMetadata(
      AUTH_RATE_LIMIT_KEY,
      AuthController.prototype.oauthProviderCallback
    ),
    'oauth_callback'
  );
  assert.equal(
    Reflect.getMetadata(
      AUTH_RATE_LIMIT_KEY,
      AuthController.prototype.githubOauthCallback
    ),
    'oauth_callback'
  );
  assert.equal(
    Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, HealthController),
    'public'
  );
});
