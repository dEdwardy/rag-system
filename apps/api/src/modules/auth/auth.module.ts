import { Module } from "@nestjs/common";
import { AuthContextMiddleware } from "./auth-context.middleware";
import { AUTH_IDENTITY_PROVIDER } from "./auth-provider.contract";
import { SessionCookieAuthProvider } from "./session-cookie-auth.provider";

@Module({
  providers: [
    SessionCookieAuthProvider,
    {
      provide: AUTH_IDENTITY_PROVIDER,
      useExisting: SessionCookieAuthProvider
    },
    AuthContextMiddleware
  ],
  exports: [AUTH_IDENTITY_PROVIDER, AuthContextMiddleware]
})
export class AuthModule {}
