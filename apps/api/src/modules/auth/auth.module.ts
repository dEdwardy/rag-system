import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseModule } from "../../infra/database/database.module";
import { AUTH_ACL_GUARD_HOOK, NOOP_AUTH_ACL_GUARD_HOOK } from "./auth-acl-guard-hook.contract";
import { AuthContextMiddleware } from "./auth-context.middleware";
import { AUTH_IDENTITY_PROVIDER } from "./auth-provider.contract";
import { AuthController } from "./auth.controller";
import { GOOGLE_OAUTH_PROVIDER, HttpGoogleOauthProvider } from "./google-oauth.provider";
import { GITHUB_OAUTH_PROVIDER, HttpGithubOauthProvider } from "./github-oauth.provider";
import { AuthRoutePolicyGuard } from "./auth-route-policy.guard";
import { AuthService } from "./auth.service";
import { SessionCookieAuthProvider } from "./session-cookie-auth.provider";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    SessionCookieAuthProvider,
    HttpGithubOauthProvider,
    HttpGoogleOauthProvider,
    AuthService,
    {
      provide: AUTH_IDENTITY_PROVIDER,
      useExisting: SessionCookieAuthProvider
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
      provide: APP_GUARD,
      useClass: AuthRoutePolicyGuard
    },
    {
      provide: AUTH_ACL_GUARD_HOOK,
      useValue: NOOP_AUTH_ACL_GUARD_HOOK
    },
    AuthContextMiddleware
  ],
  exports: [AUTH_IDENTITY_PROVIDER, AuthContextMiddleware, AuthService]
})
export class AuthModule {}
