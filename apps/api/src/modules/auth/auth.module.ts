import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infra/database/database.module";
import { AuthContextMiddleware } from "./auth-context.middleware";
import { AUTH_IDENTITY_PROVIDER } from "./auth-provider.contract";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionCookieAuthProvider } from "./session-cookie-auth.provider";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    SessionCookieAuthProvider,
    AuthService,
    {
      provide: AUTH_IDENTITY_PROVIDER,
      useExisting: SessionCookieAuthProvider
    },
    AuthContextMiddleware
  ],
  exports: [AUTH_IDENTITY_PROVIDER, AuthContextMiddleware, AuthService]
})
export class AuthModule {}
