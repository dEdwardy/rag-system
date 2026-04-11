import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseModule } from "../../infra/database/database.module";
import { AUTH_ACL_GUARD_HOOK, NOOP_AUTH_ACL_GUARD_HOOK } from "./auth-acl-guard-hook.contract";
import { AuthRateLimitGuard } from "./auth-rate-limit.guard";
import { AuthContextMiddleware } from "./auth-context.middleware";
import { AUTH_IDENTITY_PROVIDER } from "./auth-provider.contract";
import { AUTH_RUNTIME_CONFIG, AuthRuntimeConfigService, resolveAuthRuntimeConfig } from "./auth-runtime-config";
import { AuthController } from "./auth.controller";
import { AccessJwtAuthProvider } from "./access-jwt-auth.provider";
import { CompositeAuthProvider } from "./composite-auth.provider";
import { GOOGLE_OAUTH_PROVIDER, HttpGoogleOauthProvider } from "./google-oauth.provider";
import { GITHUB_OAUTH_PROVIDER, HttpGithubOauthProvider } from "./github-oauth.provider";
import { HttpOidcOauthProvider, OIDC_OAUTH_PROVIDER } from "./oidc-oauth.provider";
import { AuthRoutePolicyGuard } from "./auth-route-policy.guard";
import { AuthService } from "./auth.service";
import { SessionCookieAuthProvider } from "./session-cookie-auth.provider";
import { AUTH_SESSION_STORE, DatabaseAuthSessionStore, RedisAuthSessionStore, type AuthSessionStore } from "./auth-session.store";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    SessionCookieAuthProvider,
    AccessJwtAuthProvider,
    CompositeAuthProvider,
    HttpGithubOauthProvider,
    HttpGoogleOauthProvider,
    HttpOidcOauthProvider,
    AuthRuntimeConfigService,
    {
      provide: AUTH_RUNTIME_CONFIG,
      useFactory: () => resolveAuthRuntimeConfig()
    },
    DatabaseAuthSessionStore,
    RedisAuthSessionStore,
    {
      provide: AUTH_SESSION_STORE,
      inject: [AUTH_RUNTIME_CONFIG, DatabaseAuthSessionStore, RedisAuthSessionStore],
      useFactory: (
        runtimeConfig: ReturnType<typeof resolveAuthRuntimeConfig>,
        databaseStore: DatabaseAuthSessionStore,
        redisStore: RedisAuthSessionStore
      ): AuthSessionStore => runtimeConfig.sessionStoreProvider === "redis" ? redisStore : databaseStore
    },
    AuthService,
    {
      provide: AUTH_IDENTITY_PROVIDER,
      useExisting: CompositeAuthProvider
    },
    {
      provide: GITHUB_OAUTH_PROVIDER,
      useExisting: HttpGithubOauthProvider
    },
    {
      provide: GOOGLE_OAUTH_PROVIDER,
      useExisting: HttpGoogleOauthProvider
    },
    {
      provide: OIDC_OAUTH_PROVIDER,
      useExisting: HttpOidcOauthProvider
    },
    {
      provide: APP_GUARD,
      useClass: AuthRoutePolicyGuard
    },
    {
      provide: APP_GUARD,
      useClass: AuthRateLimitGuard
    },
    {
      provide: AUTH_ACL_GUARD_HOOK,
      useValue: NOOP_AUTH_ACL_GUARD_HOOK
    },
    AuthContextMiddleware
  ],
  exports: [AUTH_IDENTITY_PROVIDER, AUTH_RUNTIME_CONFIG, AuthContextMiddleware, AuthRuntimeConfigService, AuthService]
})
export class AuthModule {}
